
CREATE TABLE public.weddings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weddings TO anon, authenticated;
GRANT ALL ON public.weddings TO service_role;
ALTER TABLE public.weddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view weddings" ON public.weddings FOR SELECT USING (true);
CREATE POLICY "Anyone can add weddings" ON public.weddings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update weddings" ON public.weddings FOR UPDATE USING (true) WITH CHECK (true);

-- Add slug format check
ALTER TABLE public.weddings ADD CONSTRAINT weddings_slug_format CHECK (slug ~ '^[a-z0-9-]{2,40}$');

-- Default wedding for existing cars
INSERT INTO public.weddings (slug, name) VALUES ('my-wedding', 'My Wedding');

-- Add wedding_id to cars
ALTER TABLE public.cars ADD COLUMN wedding_id uuid REFERENCES public.weddings(id) ON DELETE CASCADE;
UPDATE public.cars SET wedding_id = (SELECT id FROM public.weddings WHERE slug = 'my-wedding');
ALTER TABLE public.cars ALTER COLUMN wedding_id SET NOT NULL;
CREATE INDEX cars_wedding_id_idx ON public.cars(wedding_id);
