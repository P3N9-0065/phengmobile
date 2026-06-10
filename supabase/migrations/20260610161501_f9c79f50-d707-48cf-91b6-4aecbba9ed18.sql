
CREATE POLICY "anyone_upload_slip" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'payment-slips');

CREATE POLICY "staff_read_slips" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-slips' AND public.is_staff(auth.uid()));
