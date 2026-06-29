-- Harden anonymous write paths while preserving the public wedding-board flow.

ALTER TABLE public.cars
  ADD CONSTRAINT cars_seats_total_range CHECK (seats_total BETWEEN 1 AND 20) NOT VALID,
  ADD CONSTRAINT cars_password_length CHECK (char_length(password) = 4) NOT VALID;

ALTER TABLE public.passengers
  ADD COLUMN wedding_id uuid REFERENCES public.weddings(id) ON DELETE CASCADE;

UPDATE public.passengers AS p
SET wedding_id = c.wedding_id
FROM public.cars AS c
WHERE p.car_id = c.id
  AND p.wedding_id IS NULL;

ALTER TABLE public.passengers
  ALTER COLUMN wedding_id SET NOT NULL;

CREATE INDEX passengers_wedding_id_idx ON public.passengers(wedding_id);

CREATE OR REPLACE FUNCTION public.set_passenger_wedding_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_wedding_id uuid;
BEGIN
  SELECT wedding_id
  INTO target_wedding_id
  FROM public.cars
  WHERE id = NEW.car_id;

  IF target_wedding_id IS NULL THEN
    RAISE EXCEPTION 'Car not found' USING ERRCODE = '23503';
  END IF;

  NEW.wedding_id := target_wedding_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_passenger_wedding_id() FROM PUBLIC;

CREATE TRIGGER set_passenger_wedding_id
  BEFORE INSERT OR UPDATE OF car_id ON public.passengers
  FOR EACH ROW EXECUTE FUNCTION public.set_passenger_wedding_id();

CREATE OR REPLACE FUNCTION public.guard_car_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  passenger_count int;
BEGIN
  NEW.wedding_id := OLD.wedding_id;

  IF NEW.seats_total IS DISTINCT FROM OLD.seats_total THEN
    SELECT count(*)
    INTO passenger_count
    FROM public.passengers
    WHERE car_id = OLD.id;

    IF NEW.seats_total < passenger_count THEN
      RAISE EXCEPTION 'Seats cannot be lower than current passengers' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_car_update() FROM PUBLIC;

CREATE TRIGGER guard_car_update
  BEFORE UPDATE ON public.cars
  FOR EACH ROW EXECUTE FUNCTION public.guard_car_update();

CREATE OR REPLACE FUNCTION public.join_car_with_password(
  p_car_id uuid,
  p_password text,
  p_name text,
  p_phone text,
  p_address text
)
RETURNS public.passengers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_car public.cars%ROWTYPE;
  passenger_count int;
  inserted_passenger public.passengers%ROWTYPE;
BEGIN
  SELECT *
  INTO target_car
  FROM public.cars
  WHERE id = p_car_id
  FOR UPDATE;

  IF target_car.id IS NULL THEN
    RAISE EXCEPTION 'Car not found' USING ERRCODE = 'P0002';
  END IF;

  IF char_length(trim(coalesce(p_name, ''))) = 0
    OR char_length(trim(coalesce(p_phone, ''))) < 7
    OR char_length(trim(coalesce(p_address, ''))) = 0 THEN
    RAISE EXCEPTION 'Invalid passenger details' USING ERRCODE = '22023';
  END IF;

  IF char_length(trim(coalesce(p_password, ''))) <> 4
    OR trim(p_password) <> target_car.password THEN
    RAISE EXCEPTION 'Invalid car password' USING ERRCODE = '28000';
  END IF;

  SELECT count(*)
  INTO passenger_count
  FROM public.passengers
  WHERE car_id = p_car_id;

  IF passenger_count >= target_car.seats_total THEN
    RAISE EXCEPTION 'Car is full' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.passengers (car_id, wedding_id, name, phone, address)
  VALUES (
    target_car.id,
    target_car.wedding_id,
    trim(p_name),
    trim(p_phone),
    trim(p_address)
  )
  RETURNING * INTO inserted_passenger;

  RETURN inserted_passenger;
END;
$$;

REVOKE ALL ON FUNCTION public.join_car_with_password(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_car_with_password(uuid, text, text, text, text) TO anon, authenticated;

REVOKE INSERT, UPDATE ON public.passengers FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.weddings FROM anon, authenticated;
