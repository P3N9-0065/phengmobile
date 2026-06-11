
ALTER TABLE public.repair_tickets
  ADD COLUMN IF NOT EXISTS before_repair_photo_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS after_repair_photo_urls text[] NOT NULL DEFAULT '{}';
