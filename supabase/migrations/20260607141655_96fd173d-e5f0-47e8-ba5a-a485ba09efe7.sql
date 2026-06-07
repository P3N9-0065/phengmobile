
-- 1. Remove public storage SELECT policies for private buckets
DROP POLICY IF EXISTS "public read repair-photos" ON storage.objects;
DROP POLICY IF EXISTS "public read signatures" ON storage.objects;

-- 2. Revoke EXECUTE on trigger-only SECURITY DEFINER functions from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.apply_stock_movement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_stock_on_part_use() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deduct_stock_on_sale() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_ticket_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_ticket_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_sale_points() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_return_policy_change() FROM PUBLIC, anon, authenticated;

-- 3. Revoke EXECUTE from anon on admin/staff-only RPCs (keep authenticated; they enforce role checks internally)
REVOKE EXECUTE ON FUNCTION public.return_sale_items(uuid, jsonb, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.void_sale(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.receive_purchase_order(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.receive_purchase_order_partial(uuid, jsonb) FROM PUBLIC, anon;

-- 4. Helper functions used inside RLS should not be directly callable by anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;

-- Note: public.track_ticket(text) and public.track_signup(uuid) remain executable by anon
-- because they power public order/signup tracking pages by design.
