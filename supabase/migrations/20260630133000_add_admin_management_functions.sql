CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.app_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;

CREATE OR REPLACE FUNCTION public.is_wedding_admin(p_admin_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_key text;
BEGIN
  SELECT value
  INTO stored_key
  FROM public.app_settings
  WHERE key = 'admin_passcode';

  RETURN stored_key IS NOT NULL
    AND char_length(trim(coalesce(p_admin_key, ''))) > 0
    AND trim(p_admin_key) = stored_key;
END;
$$;

REVOKE ALL ON FUNCTION public.is_wedding_admin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_wedding_admin(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.require_wedding_admin(p_admin_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_wedding_admin(p_admin_key) THEN
    RAISE EXCEPTION 'Admin permission required' USING ERRCODE = '28000';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.require_wedding_admin(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_wedding_by_slug(p_slug text)
RETURNS SETOF public.weddings
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.weddings
  WHERE slug = trim(p_slug)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_wedding_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wedding_by_slug(text) TO anon, authenticated;

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

CREATE OR REPLACE FUNCTION public.create_wedding_admin(
  p_admin_key text,
  p_name text,
  p_slug text,
  p_venue_name text,
  p_venue_address text
)
RETURNS SETOF public.weddings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_wedding_admin(p_admin_key);

  IF char_length(trim(coalesce(p_name, ''))) = 0 THEN
    RAISE EXCEPTION 'Wedding name is required' USING ERRCODE = '22023';
  END IF;

  IF trim(coalesce(p_slug, '')) !~ '^[a-z0-9-]{2,40}$' THEN
    RAISE EXCEPTION 'Invalid wedding slug' USING ERRCODE = '22023';
  END IF;

  IF char_length(trim(coalesce(p_venue_name, ''))) = 0
    OR char_length(trim(coalesce(p_venue_address, ''))) = 0 THEN
    RAISE EXCEPTION 'Wedding venue is required' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  INSERT INTO public.weddings (name, slug, venue_name, venue_address)
  VALUES (
    trim(p_name),
    trim(p_slug),
    trim(p_venue_name),
    trim(p_venue_address)
  )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.create_wedding_admin(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_wedding_admin(text, text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_wedding_admin(p_admin_key text, p_wedding_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_id uuid;
BEGIN
  PERFORM public.require_wedding_admin(p_admin_key);

  DELETE FROM public.weddings
  WHERE id = p_wedding_id
  RETURNING id INTO deleted_id;

  IF deleted_id IS NULL THEN
    RAISE EXCEPTION 'Wedding not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN deleted_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_wedding_admin(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_wedding_admin(text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_cars_for_wedding(p_wedding_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE c.wedding_id = p_wedding_id;
$$;

REVOKE ALL ON FUNCTION public.get_cars_for_wedding(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cars_for_wedding(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_car_for_wedding(
  p_wedding_id uuid,
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
  IF NOT EXISTS (SELECT 1 FROM public.weddings WHERE id = p_wedding_id) THEN
    RAISE EXCEPTION 'Wedding not found' USING ERRCODE = 'P0002';
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

REVOKE ALL ON FUNCTION public.create_car_for_wedding(uuid, text, text, text, text, int, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_car_for_wedding(uuid, text, text, text, text, int, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_car_for_wedding(
  p_wedding_id uuid,
  p_car_id uuid,
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

REVOKE ALL ON FUNCTION public.update_car_for_wedding(uuid, uuid, text, text, text, text, int, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_car_for_wedding(uuid, uuid, text, text, text, text, int, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_car_for_wedding(p_wedding_id uuid, p_car_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_id uuid;
BEGIN
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

REVOKE ALL ON FUNCTION public.delete_car_for_wedding(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_car_for_wedding(uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_passenger_for_wedding(p_wedding_id uuid, p_passenger_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_id uuid;
BEGIN
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

REVOKE ALL ON FUNCTION public.delete_passenger_for_wedding(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_passenger_for_wedding(uuid, uuid) TO anon, authenticated;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.weddings FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.cars FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.passengers FROM anon, authenticated;
