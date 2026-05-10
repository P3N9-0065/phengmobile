
-- Fix search_path on remaining functions
ALTER FUNCTION public.gen_ticket_code() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- Revoke anon execute on internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.record_ticket_status_change() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.apply_stock_movement() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.deduct_stock_on_part_use() FROM anon, authenticated, public;
