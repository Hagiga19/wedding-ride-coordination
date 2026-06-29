
CREATE TYPE public.trip_direction AS ENUM ('to', 'from');

CREATE TABLE public.cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_name TEXT NOT NULL,
  driver_phone TEXT NOT NULL,
  direction public.trip_direction NOT NULL,
  from_location TEXT NOT NULL,
  to_location TEXT NOT NULL,
  seats_total INT NOT NULL CHECK (seats_total > 0),
  password TEXT NOT NULL,
  departure_time TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.passengers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_passengers_car_id ON public.passengers(car_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cars TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passengers TO anon, authenticated;
GRANT ALL ON public.cars TO service_role;
GRANT ALL ON public.passengers TO service_role;

ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passengers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view cars" ON public.cars FOR SELECT USING (true);
CREATE POLICY "Anyone can add cars" ON public.cars FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update cars" ON public.cars FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete cars" ON public.cars FOR DELETE USING (true);

CREATE POLICY "Anyone can view passengers" ON public.passengers FOR SELECT USING (true);
CREATE POLICY "Anyone can add passengers" ON public.passengers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update passengers" ON public.passengers FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete passengers" ON public.passengers FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_cars_updated_at
  BEFORE UPDATE ON public.cars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.cars;
ALTER PUBLICATION supabase_realtime ADD TABLE public.passengers;
ALTER TABLE public.cars REPLICA IDENTITY FULL;
ALTER TABLE public.passengers REPLICA IDENTITY FULL;
