
-- 1) PRIVILEGE_ESCALATION: restrict is_staff to known staff roles only
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','cashier','technician','warehouse')
  )
$$;

-- 2) MISSING_RLS: allow staff to insert repair_status_history (trigger uses SECURITY DEFINER so it already works,
-- but explicit policy lets the API path work if ever needed)
CREATE POLICY "staff insert history"
ON public.repair_status_history
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

-- 3) MISSING_RLS: signatures bucket - staff DELETE / UPDATE
CREATE POLICY "staff update signatures"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'signatures' AND public.is_staff(auth.uid()))
WITH CHECK (bucket_id = 'signatures' AND public.is_staff(auth.uid()));

CREATE POLICY "staff delete signatures"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'signatures' AND public.is_staff(auth.uid()));

-- 4) SECURITY DEFINER executable by anon/authenticated: revoke EXECUTE from public exposure
-- for internal helpers. Keep track_ticket and track_signup callable (used by public tracking pages).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.apply_stock_movement() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.deduct_stock_on_part_use() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.deduct_stock_on_sale() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.award_sale_points() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_ticket_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.record_ticket_status_change() FROM anon, authenticated, public;
