
-- ====== ENUMS ======
CREATE TYPE public.app_role AS ENUM ('admin', 'cashier', 'technician');
CREATE TYPE public.repair_status AS ENUM (
  'received','inspecting','waiting_parts','repairing','testing','done','picked_up','closed','cancelled'
);
CREATE TYPE public.item_category AS ENUM (
  'part','accessory','tool','phone_new','phone_used'
);
CREATE TYPE public.movement_type AS ENUM (
  'purchase','repair_use','adjustment','sale','return'
);

-- ====== PROFILES ======
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====== USER ROLES ======
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

-- Auto-create profile on signup; first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cashier');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====== CUSTOMERS ======
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_customers_name ON public.customers(name);

-- ====== DEVICES ======
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  imei TEXT,
  color TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_devices_customer ON public.devices(customer_id);

-- ====== INVENTORY ======
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  category item_category NOT NULL DEFAULT 'part',
  description TEXT,
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  sell_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inventory_name ON public.inventory_items(name);
CREATE INDEX idx_inventory_category ON public.inventory_items(category);

-- ====== REPAIR TICKETS ======
CREATE OR REPLACE FUNCTION public.gen_ticket_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  code TEXT;
BEGIN
  code := 'TK' || to_char(now(),'YYMMDD') || lpad(floor(random()*10000)::text, 4, '0');
  RETURN code;
END;
$$;

CREATE TABLE public.repair_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code TEXT NOT NULL UNIQUE DEFAULT public.gen_ticket_code(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  device_brand TEXT NOT NULL,
  device_model TEXT NOT NULL,
  device_imei TEXT,
  device_color TEXT,
  problem_description TEXT NOT NULL,
  lock_code TEXT,
  accessories TEXT[] DEFAULT '{}',
  photo_urls TEXT[] DEFAULT '{}',
  signature_url TEXT,
  status repair_status NOT NULL DEFAULT 'received',
  technician_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  estimated_price NUMERIC(14,2),
  final_price NUMERIC(14,2),
  labor_cost NUMERIC(14,2) DEFAULT 0,
  warranty_days INTEGER NOT NULL DEFAULT 7,
  warranty_until DATE,
  internal_notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  picked_up_at TIMESTAMPTZ
);
CREATE INDEX idx_tickets_status ON public.repair_tickets(status);
CREATE INDEX idx_tickets_customer ON public.repair_tickets(customer_id);
CREATE INDEX idx_tickets_technician ON public.repair_tickets(technician_id);

CREATE TABLE public.repair_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.repair_tickets(id) ON DELETE CASCADE,
  status repair_status NOT NULL,
  note TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_status_history_ticket ON public.repair_status_history(ticket_id);

-- Auto record initial status + on status change
CREATE OR REPLACE FUNCTION public.record_ticket_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.repair_status_history(ticket_id, status, changed_by)
    VALUES (NEW.id, NEW.status, NEW.created_by);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.repair_status_history(ticket_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
    IF NEW.status = 'picked_up' AND NEW.picked_up_at IS NULL THEN
      NEW.picked_up_at := now();
      IF NEW.warranty_until IS NULL THEN
        NEW.warranty_until := (now() + (NEW.warranty_days || ' days')::interval)::date;
      END IF;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ticket_status BEFORE INSERT OR UPDATE ON public.repair_tickets
FOR EACH ROW EXECUTE FUNCTION public.record_ticket_status_change();

-- ====== STOCK MOVEMENTS ======
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL,
  type movement_type NOT NULL,
  ref_ticket_id UUID REFERENCES public.repair_tickets(id) ON DELETE SET NULL,
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_movements_item ON public.stock_movements(item_id);

-- Apply qty change to inventory
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.inventory_items
  SET stock_qty = stock_qty + NEW.qty,
      updated_at = now()
  WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_stock AFTER INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- ====== REPAIR PARTS USED ======
CREATE TABLE public.repair_parts_used (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.repair_tickets(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_parts_ticket ON public.repair_parts_used(ticket_id);

CREATE OR REPLACE FUNCTION public.deduct_stock_on_part_use()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.stock_movements(item_id, qty, type, ref_ticket_id, note, created_by)
  VALUES (NEW.item_id, -NEW.qty, 'repair_use', NEW.ticket_id, 'ໃຊ້ໃນການສ້ອມ', NEW.created_by);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_part_used AFTER INSERT ON public.repair_parts_used
FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_part_use();

-- ====== UPDATED_AT TRIGGERS ======
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_inventory_updated BEFORE UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ====== RLS ======
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_parts_used ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "staff read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "self update profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "admin manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- user_roles
CREATE POLICY "staff read roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- customers (all staff CRUD)
CREATE POLICY "staff manage customers" ON public.customers FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- devices
CREATE POLICY "staff manage devices" ON public.devices FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- inventory: all staff read; admin/cashier write
CREATE POLICY "staff read inventory" ON public.inventory_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin cashier write inventory" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier'));
CREATE POLICY "admin cashier update inventory" ON public.inventory_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier'));
CREATE POLICY "admin delete inventory" ON public.inventory_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- stock movements
CREATE POLICY "staff read movements" ON public.stock_movements FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert movements" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- repair tickets
CREATE POLICY "staff read tickets" ON public.repair_tickets FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin cashier create tickets" ON public.repair_tickets FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier'));
CREATE POLICY "staff update tickets" ON public.repair_tickets FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cashier') OR (public.has_role(auth.uid(),'technician') AND technician_id = auth.uid())
);
CREATE POLICY "admin delete tickets" ON public.repair_tickets FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- status history
CREATE POLICY "staff read history" ON public.repair_status_history FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- parts used
CREATE POLICY "staff read parts" ON public.repair_parts_used FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert parts" ON public.repair_parts_used FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- ====== STORAGE BUCKETS ======
INSERT INTO storage.buckets (id, name, public) VALUES ('repair-photos','repair-photos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures','signatures', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read repair-photos" ON storage.objects FOR SELECT USING (bucket_id = 'repair-photos');
CREATE POLICY "staff upload repair-photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'repair-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "staff delete repair-photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'repair-photos' AND public.is_staff(auth.uid()));

CREATE POLICY "public read signatures" ON storage.objects FOR SELECT USING (bucket_id = 'signatures');
CREATE POLICY "staff upload signatures" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'signatures' AND public.is_staff(auth.uid()));

-- ====== PUBLIC TRACKING RPC ======
-- ສຳລັບໜ້າຕິດຕາມສາທາລະນະ /track/$code (ບໍ່ຕ້ອງລ໋ອກອິນ)
CREATE OR REPLACE FUNCTION public.track_ticket(_code TEXT)
RETURNS TABLE (
  ticket_code TEXT,
  device_brand TEXT,
  device_model TEXT,
  status repair_status,
  created_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  warranty_until DATE,
  history JSONB
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.ticket_code, t.device_brand, t.device_model, t.status, t.created_at, t.picked_up_at, t.warranty_until,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('status', h.status, 'changed_at', h.changed_at, 'note', h.note) ORDER BY h.changed_at)
       FROM public.repair_status_history h WHERE h.ticket_id = t.id), '[]'::jsonb)
  FROM public.repair_tickets t WHERE t.ticket_code = _code;
$$;

GRANT EXECUTE ON FUNCTION public.track_ticket(TEXT) TO anon, authenticated;
