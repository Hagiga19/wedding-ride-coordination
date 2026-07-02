DROP FUNCTION IF EXISTS public.create_car_for_wedding(uuid, text, text, text, text, text, text, int, text, text, text);
DROP FUNCTION IF EXISTS public.update_car_for_wedding(uuid, uuid, text, text, text, text, text, text, int, text, text, text);

CREATE OR REPLACE FUNCTION public.create_car_for_wedding(
  p_wedding_id uuid,
  p_access_key text,
  p_admin_key text,
  p_driver_name text,
  p_driver_phone text,
  p_direction public.trip_direction,
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

  IF p_direction IS NULL
    OR char_length(trim(coalesce(p_driver_name, ''))) = 0
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
    p_direction,
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

REVOKE ALL ON FUNCTION public.create_car_for_wedding(uuid, text, text, text, text, public.trip_direction, text, text, int, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_car_for_wedding(uuid, text, text, text, text, public.trip_direction, text, text, int, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_car_for_wedding(
  p_wedding_id uuid,
  p_car_id uuid,
  p_access_key text,
  p_admin_key text,
  p_driver_name text,
  p_driver_phone text,
  p_direction public.trip_direction,
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

  IF p_direction IS NULL
    OR char_length(trim(coalesce(p_driver_name, ''))) = 0
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
    direction = p_direction,
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

REVOKE ALL ON FUNCTION public.update_car_for_wedding(uuid, uuid, text, text, text, text, public.trip_direction, text, text, int, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_car_for_wedding(uuid, uuid, text, text, text, text, public.trip_direction, text, text, int, text, text, text) TO anon, authenticated;
