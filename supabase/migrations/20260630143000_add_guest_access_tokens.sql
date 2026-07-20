ALTER TABLE public.weddings
  ADD COLUMN IF NOT EXISTS guest_token text;

UPDATE public.weddings
SET guest_token = replace(gen_random_uuid()::text, '-', '')
WHERE guest_token IS NULL OR guest_token = '';

ALTER TABLE public.weddings
  ALTER COLUMN guest_token SET DEFAULT replace(gen_random_uuid()::text, '-', ''),
  ALTER COLUMN guest_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS weddings_guest_token_key ON public.weddings(guest_token);

DROP FUNCTION IF EXISTS public.get_wedding_by_slug(text);
DROP FUNCTION IF EXISTS public.get_cars_for_wedding(uuid);
DROP FUNCTION IF EXISTS public.create_car_for_wedding(uuid, text, text, text, text, int, text, text, text);
DROP FUNCTION IF EXISTS public.update_car_for_wedding(uuid, uuid, text, text, text, text, int, text, text, text);
DROP FUNCTION IF EXISTS public.delete_car_for_wedding(uuid, uuid);
DROP FUNCTION IF EXISTS public.delete_passenger_for_wedding(uuid, uuid);
DROP FUNCTION IF EXISTS public.join_car_with_password(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.has_wedding_access(
  p_wedding_id uuid,
  p_access_key text,
  p_admin_key text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_wedding_admin(p_admin_key)
    OR EXISTS (
      SELECT 1
      FROM public.weddings
      WHERE id = p_wedding_id
        AND guest_token = trim(coalesce(p_access_key, ''))
    );
$$;

REVOKE ALL ON FUNCTION public.has_wedding_access(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_wedding_access(uuid, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.join_car_with_password(
  p_car_id uuid,
  p_access_key text,
  p_admin_key text,
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

  IF NOT public.has_wedding_access(target_car.wedding_id, p_access_key, p_admin_key) THEN
    RAISE EXCEPTION 'Wedding access required' USING ERRCODE = '28000';
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

REVOKE ALL ON FUNCTION public.join_car_with_password(uuid, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_car_with_password(uuid, text, text, text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_wedding_by_slug(
  p_slug text,
  p_access_key text,
  p_admin_key text DEFAULT NULL
)
RETURNS SETOF public.weddings
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.weddings
  WHERE slug = trim(p_slug)
    AND (
      guest_token = trim(coalesce(p_access_key, ''))
      OR public.is_wedding_admin(p_admin_key)
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_wedding_by_slug(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wedding_by_slug(text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_weddings_admin(p_admin_key text)
RETURNS SETOF public.weddings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_wedding_admin(p_admin_key);

  RETURN QUERY
  SELECT *
  FROM public.weddings
  ORDER BY created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_weddings_admin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_weddings_admin(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_cars_for_wedding(
  p_wedding_id uuid,
  p_access_key text,
  p_admin_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_wedding_access(p_wedding_id, p_access_key, p_admin_key) THEN
    RAISE EXCEPTION 'Wedding access required' USING ERRCODE = '28000';
  END IF;

  RETURN (
    SELECT coalesce(
      jsonb_agg(
        to_jsonb(c) || jsonb_build_object(
          'passengers',
          coalesce(
            (
              SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at)
              FROM public.passengers AS p
              WHERE p.car_id = c.id
            ),
            '[]'::jsonb
          )
        )
        ORDER BY c.created_at
      ),
      '[]'::jsonb
    )
    FROM public.cars AS c
    WHERE c.wedding_id = p_wedding_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_cars_for_wedding(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cars_for_wedding(uuid, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_car_for_wedding(
  p_wedding_id uuid,
  p_access_key text,
  p_admin_key text,
  p_driver_name text,
  p_driver_phone text,
  p_from_location text,
  p_to_location text,
  p_seats_total int,
  p_password text,
  p_departure_time text,
  p_notes text
)
RETURNS SETOF public.cars
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_wedding_access(p_wedding_id, p_access_key, p_admin_key) THEN
    RAISE EXCEPTION 'Wedding access required' USING ERRCODE = '28000';
  END IF;

  IF char_length(trim(coalesce(p_driver_name, ''))) = 0
    OR char_length(trim(coalesce(p_driver_phone, ''))) < 7
    OR char_length(trim(coalesce(p_from_location, ''))) = 0
    OR char_length(trim(coalesce(p_to_location, ''))) = 0 THEN
    RAISE EXCEPTION 'Invalid car details' USING ERRCODE = '22023';
  END IF;

  IF p_seats_total < 1 OR p_seats_total > 20 THEN
    RAISE EXCEPTION 'Invalid seat count' USING ERRCODE = '23514';
  END IF;

  IF char_length(trim(coalesce(p_password, ''))) <> 4 THEN
    RAISE EXCEPTION 'Invalid car password' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  INSERT INTO public.cars (
    wedding_id,
    driver_name,
    driver_phone,
    direction,
    from_location,
    to_location,
    seats_total,
    password,
    departure_time,
    notes
  )
  VALUES (
    p_wedding_id,
    trim(p_driver_name),
    trim(p_driver_phone),
    'to',
    trim(p_from_location),
    trim(p_to_location),
    p_seats_total,
    trim(p_password),
    nullif(trim(coalesce(p_departure_time, '')), ''),
    nullif(trim(coalesce(p_notes, '')), '')
  )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.create_car_for_wedding(uuid, text, text, text, text, text, text, int, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_car_for_wedding(uuid, text, text, text, text, text, text, int, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_car_for_wedding(
  p_wedding_id uuid,
  p_car_id uuid,
  p_access_key text,
  p_admin_key text,
  p_driver_name text,
  p_driver_phone text,
  p_from_location text,
  p_to_location text,
  p_seats_total int,
  p_password text,
  p_departure_time text,
  p_notes text
)
RETURNS SETOF public.cars
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_wedding_access(p_wedding_id, p_access_key, p_admin_key) THEN
    RAISE EXCEPTION 'Wedding access required' USING ERRCODE = '28000';
  END IF;

  IF char_length(trim(coalesce(p_driver_name, ''))) = 0
    OR char_length(trim(coalesce(p_driver_phone, ''))) < 7
    OR char_length(trim(coalesce(p_from_location, ''))) = 0
    OR char_length(trim(coalesce(p_to_location, ''))) = 0 THEN
    RAISE EXCEPTION 'Invalid car details' USING ERRCODE = '22023';
  END IF;

  IF p_seats_total < 1 OR p_seats_total > 20 THEN
    RAISE EXCEPTION 'Invalid seat count' USING ERRCODE = '23514';
  END IF;

  IF char_length(trim(coalesce(p_password, ''))) <> 4 THEN
    RAISE EXCEPTION 'Invalid car password' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  UPDATE public.cars
  SET
    driver_name = trim(p_driver_name),
    driver_phone = trim(p_driver_phone),
    from_location = trim(p_from_location),
    to_location = trim(p_to_location),
    seats_total = p_seats_total,
    password = trim(p_password),
    departure_time = nullif(trim(coalesce(p_departure_time, '')), ''),
    notes = nullif(trim(coalesce(p_notes, '')), '')
  WHERE id = p_car_id
    AND wedding_id = p_wedding_id
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.update_car_for_wedding(uuid, uuid, text, text, text, text, text, text, int, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_car_for_wedding(uuid, uuid, text, text, text, text, text, text, int, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_car_for_wedding(
  p_wedding_id uuid,
  p_car_id uuid,
  p_access_key text,
  p_admin_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_id uuid;
BEGIN
  IF NOT public.has_wedding_access(p_wedding_id, p_access_key, p_admin_key) THEN
    RAISE EXCEPTION 'Wedding access required' USING ERRCODE = '28000';
  END IF;

  DELETE FROM public.cars
  WHERE id = p_car_id
    AND wedding_id = p_wedding_id
  RETURNING id INTO deleted_id;

  IF deleted_id IS NULL THEN
    RAISE EXCEPTION 'Car not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN deleted_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_car_for_wedding(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_car_for_wedding(uuid, uuid, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_passenger_for_wedding(
  p_wedding_id uuid,
  p_passenger_id uuid,
  p_access_key text,
  p_admin_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_id uuid;
BEGIN
  IF NOT public.has_wedding_access(p_wedding_id, p_access_key, p_admin_key) THEN
    RAISE EXCEPTION 'Wedding access required' USING ERRCODE = '28000';
  END IF;

  DELETE FROM public.passengers
  WHERE id = p_passenger_id
    AND wedding_id = p_wedding_id
  RETURNING id INTO deleted_id;

  IF deleted_id IS NULL THEN
    RAISE EXCEPTION 'Passenger not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN deleted_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_passenger_for_wedding(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_passenger_for_wedding(uuid, uuid, text, text) TO anon, authenticated;
