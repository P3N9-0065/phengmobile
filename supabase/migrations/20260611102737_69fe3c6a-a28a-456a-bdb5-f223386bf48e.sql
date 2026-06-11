-- OCR slip fields
ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS slip_hash text,
  ADD COLUMN IF NOT EXISTS slip_ocr jsonb,
  ADD COLUMN IF NOT EXISTS slip_amount numeric,
  ADD COLUMN IF NOT EXISTS slip_ref text,
  ADD COLUMN IF NOT EXISTS slip_bank text,
  ADD COLUMN IF NOT EXISTS slip_date timestamptz,
  ADD COLUMN IF NOT EXISTS slip_verify_status text,
  ADD COLUMN IF NOT EXISTS slip_verify_note text,
  ADD COLUMN IF NOT EXISTS slip_verified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_shop_orders_slip_hash ON public.shop_orders(slip_hash) WHERE slip_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shop_orders_slip_ref ON public.shop_orders(slip_ref) WHERE slip_ref IS NOT NULL;

-- Shop bank account settings
CREATE TABLE IF NOT EXISTS public.shop_bank_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  bank_name text,
  account_name text,
  account_number text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton_shop_bank CHECK (id = 1)
);

GRANT SELECT ON public.shop_bank_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shop_bank_settings TO authenticated;
GRANT ALL ON public.shop_bank_settings TO service_role;

ALTER TABLE public.shop_bank_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_view_shop_bank" ON public.shop_bank_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_manage_shop_bank" ON public.shop_bank_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.shop_bank_settings(id) VALUES (1) ON CONFLICT DO NOTHING;