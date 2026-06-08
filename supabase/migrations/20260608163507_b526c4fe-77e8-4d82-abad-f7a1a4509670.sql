
CREATE TABLE public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.repair_tickets(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('sms','whatsapp')),
  recipient text NOT NULL,
  message text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent','failed')),
  error text,
  provider_sid text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_logs_ticket ON public.notification_logs(ticket_id, created_at DESC);

GRANT SELECT, INSERT ON public.notification_logs TO authenticated;
GRANT ALL ON public.notification_logs TO service_role;

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view notification logs"
  ON public.notification_logs FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert notification logs"
  ON public.notification_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
