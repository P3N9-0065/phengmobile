
-- 1. Public view exposing only safe columns for the shop
CREATE OR REPLACE VIEW public.public_shop_items
WITH (security_invoker = true) AS
SELECT id, name, category, sell_price, image_url, description,
       (stock_qty > 0) AS in_stock
FROM public.inventory_items
WHERE is_featured = true;

GRANT SELECT ON public.public_shop_items TO anon, authenticated;

-- 2. Remove anon access to base inventory table
DROP POLICY IF EXISTS "anon read featured inventory" ON public.inventory_items;

-- Re-create for authenticated staff only (keep existing behavior for staff via other policies)
-- (Other staff-read policies on inventory_items remain unchanged.)

-- 3. Tighten payment-slips upload policy: path must start with a real order_code
DROP POLICY IF EXISTS "anyone_upload_slip" ON storage.objects;

CREATE POLICY "upload_slip_for_valid_order"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'payment-slips'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.shop_orders so
    WHERE so.order_code = (storage.foldername(name))[1]
  )
);
