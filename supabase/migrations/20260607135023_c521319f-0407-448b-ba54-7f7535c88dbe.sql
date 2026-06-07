
CREATE TABLE public.return_policy_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  old_values jsonb,
  new_values jsonb
);

GRANT SELECT ON public.return_policy_audit TO authenticated;
GRANT ALL ON public.return_policy_audit TO service_role;

ALTER TABLE public.return_policy_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins view audit" ON public.return_policy_audit
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.log_return_policy_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.return_policy_audit(changed_by, old_values, new_values)
  VALUES (
    auth.uid(),
    CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_return_policy_audit ON public.return_policy_settings;
CREATE TRIGGER trg_return_policy_audit
AFTER INSERT OR UPDATE ON public.return_policy_settings
FOR EACH ROW EXECUTE FUNCTION public.log_return_policy_change();
