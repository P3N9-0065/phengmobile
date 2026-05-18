CREATE POLICY "warehouse update inventory"
ON public.inventory_items FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'warehouse'));

CREATE POLICY "warehouse insert inventory"
ON public.inventory_items FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'warehouse'));