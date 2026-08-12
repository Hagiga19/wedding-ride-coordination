ALTER TABLE public.weddings
  ADD COLUMN IF NOT EXISTS wedding_date date,
  ADD COLUMN IF NOT EXISTS wedding_time text,
  ADD COLUMN IF NOT EXISTS wedding_location text;