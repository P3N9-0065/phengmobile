
-- 1. image_url on inventory_items
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS image_url text;

-- 2. product-images bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "product images public read" ON storage.objects;
CREATE POLICY "product images public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product images staff write" ON storage.objects;
CREATE POLICY "product images staff write" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "product images staff update" ON storage.objects;
CREATE POLICY "product images staff update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'product-images' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "product images staff delete" ON storage.objects;
CREATE POLICY "product images staff delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'product-images' AND public.is_staff(auth.uid()));

-- 3. Public-safe track function for account signups (no password)
CREATE OR REPLACE FUNCTION public.track_signup(_id uuid)
RETURNS TABLE(
  id uuid,
  customer_name text,
  customer_phone text,
  account_type text,
  account_email text,
  recovery_email text,
  recovery_phone text,
  service_fee numeric,
  notes text,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    s.id,
    s.customer_name_snapshot,
    s.customer_phone_snapshot,
    s.account_type::text,
    s.account_email,
    s.recovery_email,
    s.recovery_phone,
    s.service_fee,
    s.notes,
    s.created_at
  FROM public.account_signups s
  WHERE s.id = _id;
$$;

GRANT EXECUTE ON FUNCTION public.track_signup(uuid) TO anon, authenticated;
