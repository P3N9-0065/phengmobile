
-- 1. Add columns to shop_orders
ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS shipping_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_deducted boolean NOT NULL DEFAULT false;

UPDATE public.shop_orders SET total = subtotal + shipping_fee WHERE total = 0;

-- 2. Shipping settings (single row id=1)
CREATE TABLE IF NOT EXISTS public.shipping_settings (
  id int PRIMARY KEY DEFAULT 1,
  flat_rate numeric NOT NULL DEFAULT 20000,
  free_threshold numeric NOT NULL DEFAULT 500000,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shipping_settings_single CHECK (id = 1)
);

GRANT SELECT ON public.shipping_settings TO anon, authenticated;
GRANT ALL ON public.shipping_settings TO service_role;
GRANT UPDATE, INSERT ON public.shipping_settings TO authenticated;

ALTER TABLE public.shipping_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shipping_read_all" ON public.shipping_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "shipping_admin_write" ON public.shipping_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

INSERT INTO public.shipping_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 3. Staff notifications inbox
CREATE TABLE IF NOT EXISTS public.staff_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  ref_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_notif_created ON public.staff_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_notif_read ON public.staff_notifications (read) WHERE read = false;

GRANT SELECT, UPDATE ON public.staff_notifications TO authenticated;
GRANT ALL ON public.staff_notifications TO service_role;

ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_staff_read" ON public.staff_notifications FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "notif_staff_update" ON public.staff_notifications FOR UPDATE TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

-- 4. Trigger: on new shop_orders -> insert notification
CREATE OR REPLACE FUNCTION public.notify_new_shop_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.staff_notifications(type, title, body, link, ref_id)
  VALUES (
    'new_order',
    'ໃບສັ່ງຊື້ໃໝ່: ' || NEW.order_code,
    NEW.customer_name || ' • ' || NEW.customer_phone,
    '/orders',
    NEW.id
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_new_shop_order ON public.shop_orders;
CREATE TRIGGER trg_notify_new_shop_order
  AFTER INSERT ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_shop_order();

-- 5. Trigger: status change -> deduct/restore stock
CREATE OR REPLACE FUNCTION public.apply_shop_order_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  it record;
BEGIN
  -- Deduct when transitioning into confirmed/ready/completed for the first time
  IF NEW.status IN ('confirmed','ready','completed')
     AND COALESCE(OLD.stock_deducted,false) = false
     AND NEW.stock_deducted = false THEN
    FOR it IN SELECT item_id, qty FROM public.shop_order_items WHERE order_id = NEW.id AND item_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(item_id, qty, type, note, created_by)
      VALUES (it.item_id, -it.qty, 'sale', 'ສັ່ງຊື້ອອນລາຍ ' || NEW.order_code, NULL);
    END LOOP;
    NEW.stock_deducted := true;
  END IF;

  -- Restore when cancelling an order that already deducted stock
  IF NEW.status = 'cancelled' AND COALESCE(OLD.stock_deducted,false) = true AND NEW.stock_deducted = true THEN
    FOR it IN SELECT item_id, qty FROM public.shop_order_items WHERE order_id = NEW.id AND item_id IS NOT NULL LOOP
      INSERT INTO public.stock_movements(item_id, qty, type, note, created_by)
      VALUES (it.item_id, it.qty, 'return', 'ຍົກເລີກສັ່ງຊື້ ' || NEW.order_code, NULL);
    END LOOP;
    NEW.stock_deducted := false;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_apply_shop_order_stock ON public.shop_orders;
CREATE TRIGGER trg_apply_shop_order_stock
  BEFORE UPDATE OF status ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.apply_shop_order_stock();

-- 6. Public order tracking RPC
CREATE OR REPLACE FUNCTION public.track_shop_order(_code text)
RETURNS TABLE (
  order_code text,
  customer_name text,
  status shop_order_status,
  delivery_method shop_delivery_method,
  address text,
  subtotal numeric,
  shipping_fee numeric,
  total numeric,
  created_at timestamptz,
  items jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT o.order_code, o.customer_name, o.status, o.delivery_method, o.address,
         o.subtotal, o.shipping_fee, o.total, o.created_at,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object('name', i.name_snapshot, 'qty', i.qty, 'unit_price', i.unit_price, 'line_total', i.line_total))
           FROM public.shop_order_items i WHERE i.order_id = o.id
         ), '[]'::jsonb)
  FROM public.shop_orders o
  WHERE o.order_code = _code;
$$;

GRANT EXECUTE ON FUNCTION public.track_shop_order(text) TO anon, authenticated;
