export type Direction = "to" | "from";

export interface Wedding {
  id: string;
  slug: string;
  name: string;
  wedding_date: string | null;
  wedding_time: string | null;
  wedding_location: string | null;
  created_at: string;
}

export interface Passenger {
  id: string;
  car_id: string;
  name: string;
  phone: string;
  address: string;
  created_at: string;
}

export interface Car {
  id: string;
  driver_name: string;
  driver_phone: string;
  direction: Direction;
  from_location: string;
  to_location: string;
  seats_total: number;
  password: string;
  departure_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CarWithPassengers extends Car {
  passengers: Passenger[];
}
