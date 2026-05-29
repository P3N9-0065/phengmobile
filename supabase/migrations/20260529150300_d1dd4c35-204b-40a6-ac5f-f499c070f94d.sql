
-- Set buckets to private
UPDATE storage.buckets SET public = false WHERE id IN ('repair-photos', 'signatures');

-- Drop existing broad SELECT policies for these buckets
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
  LOOP
    -- no-op placeholder; we drop specific ones below
    NULL;
  END LOOP;
END $$;

-- Drop any existing select policies on these buckets that might be public
DROP POLICY IF EXISTS "Public read repair photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read signatures" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view repair photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view signatures" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- Staff-only SELECT for these buckets
CREATE POLICY "staff read repair photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'repair-photos' AND public.is_staff(auth.uid()));

CREATE POLICY "staff read signatures select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'signatures' AND public.is_staff(auth.uid()));
