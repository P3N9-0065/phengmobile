
CREATE TYPE public.account_signup_type AS ENUM ('email', 'apple_id', 'google', 'other');

CREATE TABLE public.account_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name_snapshot text NOT NULL,
  customer_phone_snapshot text,
  account_type public.account_signup_type NOT NULL DEFAULT 'email',
  account_email text NOT NULL,
  account_password text,
  recovery_email text,
  recovery_phone text,
  birthdate date,
  service_fee numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_account_signups_customer ON public.account_signups(customer_id);
CREATE INDEX idx_account_signups_created_at ON public.account_signups(created_at DESC);

ALTER TABLE public.account_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read signups" ON public.account_signups
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "staff insert signups" ON public.account_signups
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "staff update signups" ON public.account_signups
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "admin delete signups" ON public.account_signups
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_account_signups_updated
  BEFORE UPDATE ON public.account_signups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
