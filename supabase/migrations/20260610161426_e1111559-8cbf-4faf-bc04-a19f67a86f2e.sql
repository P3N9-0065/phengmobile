
CREATE TYPE public.shop_order_status AS ENUM ('pending','confirmed','ready','completed','cancelled');
CREATE TYPE public.shop_delivery_method AS ENUM ('pickup','delivery');

CREATE OR REPLACE FUNCTION public.gen_shop_order_code()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RETURN 'SO' || to_char(now(),'YYMMDD') || lpad(floor(random()*10000)::text, 4, '0');
END;
$$;

CREATE TABLE public.shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code text NOT NULL UNIQUE DEFAULT public.gen_shop_order_code(),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  delivery_method public.shop_delivery_method NOT NULL DEFAULT 'pickup',
  address text,
  note text,
  subtotal numeric NOT NULL DEFAULT 0,
  status public.shop_order_status NOT NULL DEFAULT 'pending',
  slip_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.shop_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  name_snapshot text NOT NULL,
  unit_price numeric NOT NULL,
  qty integer NOT NULL,
  line_total numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shop_orders_created_at ON public.shop_orders(created_at DESC);
CREATE INDEX idx_shop_orders_status ON public.shop_orders(status);
CREATE INDEX idx_shop_order_items_order ON public.shop_order_items(order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_orders TO authenticated;
GRANT INSERT ON public.shop_orders TO anon;
GRANT ALL ON public.shop_orders TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_order_items TO authenticated;
GRANT INSERT ON public.shop_order_items TO anon;
GRANT ALL ON public.shop_order_items TO service_role;

ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can create an order
CREATE POLICY "anyone_can_create_order" ON public.shop_orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anyone_can_create_order_items" ON public.shop_order_items FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Staff can view all orders
CREATE POLICY "staff_view_orders" ON public.shop_orders FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff_view_order_items" ON public.shop_order_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Staff can update orders (status changes)
CREATE POLICY "staff_update_orders" ON public.shop_orders FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Admin can delete
CREATE POLICY "admin_delete_orders" ON public.shop_orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER set_shop_orders_updated_at
  BEFORE UPDATE ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
