ALTER TABLE public.weddings
  ADD COLUMN venue_name text NOT NULL DEFAULT '',
  ADD COLUMN venue_address text NOT NULL DEFAULT '';
