GRANT DELETE ON public.weddings TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can delete weddings" ON public.weddings;
CREATE POLICY "Anyone can delete weddings"
  ON public.weddings
  FOR DELETE
  USING (true);
