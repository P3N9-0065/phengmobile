
-- Add secure tracking token for public QR-code repair status page
ALTER TABLE public.repair_tickets
  ADD COLUMN IF NOT EXISTS tracking_token TEXT UNIQUE
  DEFAULT encode(gen_random_bytes(16), 'hex');

-- Backfill any existing rows that lack a token
UPDATE public.repair_tickets
  SET tracking_token = encode(gen_random_bytes(16), 'hex')
  WHERE tracking_token IS NULL;

ALTER TABLE public.repair_tickets
  ALTER COLUMN tracking_token SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_tracking_token
  ON public.repair_tickets(tracking_token);

-- Public tracking RPC keyed by tracking_token only.
-- Returns limited, privacy-safe fields (IMEI last 4 digits only).
CREATE OR REPLACE FUNCTION public.track_repair_public(_token TEXT)
RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ticket_code', t.ticket_code,
    'device_brand', t.device_brand,
    'device_model', t.device_model,
    'device_color', t.device_color,
    'imei_last4', CASE
      WHEN t.device_imei IS NULL OR length(t.device_imei) < 4 THEN NULL
      ELSE right(t.device_imei, 4)
    END,
    'problem_description', t.problem_description,
    'status', t.status,
    'estimated_price', t.estimated_price,
    'warranty_days', t.warranty_days,
    'warranty_until', t.warranty_until,
    'created_at', t.created_at,
    'updated_at', t.updated_at,
    'picked_up_at', t.picked_up_at,
    'history', COALESCE((
      SELECT jsonb_agg(
               jsonb_build_object(
                 'status', h.status,
                 'changed_at', h.changed_at,
                 'note', h.note
               ) ORDER BY h.changed_at
             )
      FROM public.repair_status_history h
      WHERE h.ticket_id = t.id
    ), '[]'::jsonb)
  )
  FROM public.repair_tickets t
  WHERE t.tracking_token = _token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.track_repair_public(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_repair_public(TEXT) TO anon, authenticated;
