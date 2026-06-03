
-- Suppliers
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  contact_person text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "admin warehouse insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'warehouse'));
CREATE POLICY "admin warehouse update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'warehouse'));
CREATE POLICY "admin delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE TRIGGER set_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Status enum
CREATE TYPE public.po_status AS ENUM ('draft','received','cancelled');

-- PO code generator
CREATE OR REPLACE FUNCTION public.gen_po_code()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RETURN 'PO' || to_char(now(),'YYMMDD') || lpad(floor(random()*10000)::text, 4, '0');
END;
$$;

-- Purchase orders
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_code text NOT NULL UNIQUE DEFAULT gen_po_code(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  status po_status NOT NULL DEFAULT 'draft',
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  received_by uuid,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read po" ON public.purchase_orders FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "admin warehouse insert po" ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'warehouse'));
CREATE POLICY "admin warehouse update po" ON public.purchase_orders FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'warehouse'));
CREATE POLICY "admin delete po" ON public.purchase_orders FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE TRIGGER set_po_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PO items
CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  qty integer NOT NULL CHECK (qty > 0),
  unit_cost numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read po items" ON public.purchase_order_items FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "admin warehouse write po items" ON public.purchase_order_items FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'warehouse'));
CREATE POLICY "admin warehouse update po items" ON public.purchase_order_items FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'warehouse'));
CREATE POLICY "admin warehouse delete po items" ON public.purchase_order_items FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'warehouse'));

CREATE INDEX idx_po_items_po ON public.purchase_order_items(po_id);
CREATE INDEX idx_po_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX idx_po_status ON public.purchase_orders(status);

-- Receive PO function: creates stock movements and updates cost_price on items
CREATE OR REPLACE FUNCTION public.receive_purchase_order(_po_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _status po_status;
  _uid uuid := auth.uid();
  r record;
BEGIN
  IF NOT (has_role(_uid,'admin') OR has_role(_uid,'warehouse')) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  SELECT status INTO _status FROM purchase_orders WHERE id = _po_id FOR UPDATE;
  IF _status IS NULL THEN RAISE EXCEPTION 'PO not found'; END IF;
  IF _status <> 'draft' THEN RAISE EXCEPTION 'PO already %', _status; END IF;

  FOR r IN SELECT item_id, qty, unit_cost FROM purchase_order_items WHERE po_id = _po_id LOOP
    INSERT INTO stock_movements(item_id, qty, type, note, created_by)
    VALUES (r.item_id, r.qty, 'purchase', 'PO ' || (SELECT po_code FROM purchase_orders WHERE id=_po_id), _uid);
    -- Update cost price to latest
    UPDATE inventory_items SET cost_price = r.unit_cost, updated_at = now()
      WHERE id = r.item_id AND r.unit_cost > 0;
  END LOOP;

  UPDATE purchase_orders
    SET status='received', received_at=now(), received_by=_uid, updated_at=now()
    WHERE id = _po_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid) TO authenticated;
