
-- Loyalty settings (singleton row, id = 1)
CREATE TABLE public.loyalty_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  earn_rate_lak NUMERIC NOT NULL DEFAULT 10000,       -- spend X kip => 1 point
  redeem_value_lak NUMERIC NOT NULL DEFAULT 100,      -- 1 point = Y kip discount
  bronze_threshold INT NOT NULL DEFAULT 0,
  silver_threshold INT NOT NULL DEFAULT 100,
  gold_threshold INT NOT NULL DEFAULT 500,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loyalty_settings TO authenticated;
GRANT ALL ON public.loyalty_settings TO service_role;
ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read loyalty settings" ON public.loyalty_settings
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "admin update loyalty settings" ON public.loyalty_settings
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "admin insert loyalty settings" ON public.loyalty_settings
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

INSERT INTO public.loyalty_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Point transactions log
CREATE TYPE public.point_txn_type AS ENUM ('earn', 'redeem', 'adjust', 'expire');

CREATE TABLE public.point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  type public.point_txn_type NOT NULL,
  points INT NOT NULL, -- positive=earn, negative=redeem/expire
  ref_sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_point_txn_customer ON public.point_transactions(customer_id, created_at DESC);
GRANT SELECT, INSERT ON public.point_transactions TO authenticated;
GRANT ALL ON public.point_transactions TO service_role;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read points" ON public.point_transactions
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "staff insert points" ON public.point_transactions
  FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()));

-- Sales: track points used per sale
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS points_redeemed INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_discount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_earned INT NOT NULL DEFAULT 0;

-- Replace award trigger: use configurable rate, log to point_transactions, handle redeem
CREATE OR REPLACE FUNCTION public.award_sale_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cfg public.loyalty_settings%ROWTYPE;
  earned INT := 0;
BEGIN
  IF NEW.customer_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO cfg FROM public.loyalty_settings WHERE id = 1;
  IF cfg IS NULL OR NOT cfg.enabled THEN RETURN NEW; END IF;

  -- Redeem first (deduct points)
  IF NEW.points_redeemed > 0 THEN
    UPDATE public.customers SET points = GREATEST(0, points - NEW.points_redeemed)
      WHERE id = NEW.customer_id;
    INSERT INTO public.point_transactions(customer_id, type, points, ref_sale_id, note, created_by)
    VALUES (NEW.customer_id, 'redeem', -NEW.points_redeemed, NEW.id,
            'ໃຊ້ແຕ້ມແລກສ່ວນຫຼຸດ ' || NEW.sale_code, NEW.cashier_id);
  END IF;

  -- Earn from total spent
  IF cfg.earn_rate_lak > 0 THEN
    earned := GREATEST(0, FLOOR(NEW.total / cfg.earn_rate_lak)::INT);
  END IF;
  IF earned > 0 THEN
    UPDATE public.customers SET points = points + earned WHERE id = NEW.customer_id;
    INSERT INTO public.point_transactions(customer_id, type, points, ref_sale_id, note, created_by)
    VALUES (NEW.customer_id, 'earn', earned, NEW.id,
            'ສະສົມຈາກບິນ ' || NEW.sale_code, NEW.cashier_id);
    NEW.points_earned := earned;
  END IF;
  RETURN NEW;
END $function$;

-- Ensure trigger exists (BEFORE so we can set NEW.points_earned)
DROP TRIGGER IF EXISTS award_points_after_sale ON public.sales;
DROP TRIGGER IF EXISTS award_points_before_sale ON public.sales;
CREATE TRIGGER award_points_before_sale
  BEFORE INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.award_sale_points();
