-- POS sales schema
CREATE TYPE public.payment_method AS ENUM ('cash','qr','transfer','card');
CREATE TYPE public.currency_code AS ENUM ('LAK','THB','USD');

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_code TEXT NOT NULL UNIQUE DEFAULT ('SL'||to_char(now(),'YYMMDD')||lpad(floor(random()*10000)::text,4,'0')),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  cashier_id UUID,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  currency_paid currency_code NOT NULL DEFAULT 'LAK',
  exchange_rate NUMERIC NOT NULL DEFAULT 1,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  change_lak NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  name_snapshot TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX idx_sales_created ON public.sales(created_at DESC);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read sales" ON public.sales FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "admin cashier insert sales" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'cashier'));
CREATE POLICY "admin delete sales" ON public.sales FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

CREATE POLICY "staff read sale_items" ON public.sale_items FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "admin cashier insert sale_items" ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'cashier'));

-- Auto-deduct stock on sale_items insert
CREATE OR REPLACE FUNCTION public.deduct_stock_on_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.stock_movements(item_id, qty, type, note, created_by)
  VALUES (NEW.item_id, -NEW.qty, 'sale', 'POS '||(SELECT sale_code FROM sales WHERE id=NEW.sale_id), NEW.created_by);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sale_items_deduct
AFTER INSERT ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_sale();

-- Award loyalty points (1 pt per 10000 LAK)
CREATE OR REPLACE FUNCTION public.award_sale_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET points = points + GREATEST(0, floor(NEW.total/10000)::int)
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sales_award_points
AFTER INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.award_sale_points();