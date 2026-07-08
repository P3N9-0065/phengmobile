
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
  WHERE t.tracking_token = _token OR t.ticket_code = _token
  LIMIT 1;
$$;
