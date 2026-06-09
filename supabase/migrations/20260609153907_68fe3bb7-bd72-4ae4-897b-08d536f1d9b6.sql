
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_inventory_featured ON public.inventory_items(is_featured) WHERE is_featured;

GRANT SELECT ON public.inventory_items TO anon;

CREATE POLICY "anon read featured inventory" ON public.inventory_items
  FOR SELECT TO anon
  USING (is_featured = true);
