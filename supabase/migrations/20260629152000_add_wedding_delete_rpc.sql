CREATE OR REPLACE FUNCTION public.delete_wedding_by_slug(
  p_slug text,
  p_confirm_slug text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF trim(coalesce(p_slug, '')) = ''
    OR trim(coalesce(p_confirm_slug, '')) = ''
    OR trim(p_slug) <> trim(p_confirm_slug) THEN
    RAISE EXCEPTION 'Wedding slug confirmation does not match' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.weddings
  WHERE slug = trim(p_slug);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wedding not found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_wedding_by_slug(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_wedding_by_slug(text, text) TO anon, authenticated;
