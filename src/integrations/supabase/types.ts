export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cars: {
        Row: {
          created_at: string
          departure_time: string | null
          direction: Database["public"]["Enums"]["trip_direction"]
          driver_name: string
          driver_phone: string
          from_location: string
          id: string
          notes: string | null
          password: string
          seats_total: number
          to_location: string
          updated_at: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          departure_time?: string | null
          direction: Database["public"]["Enums"]["trip_direction"]
          driver_name: string
          driver_phone: string
          from_location: string
          id?: string
          notes?: string | null
          password: string
          seats_total: number
          to_location: string
          updated_at?: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          departure_time?: string | null
          direction?: Database["public"]["Enums"]["trip_direction"]
          driver_name?: string
          driver_phone?: string
          from_location?: string
          id?: string
          notes?: string | null
          password?: string
          seats_total?: number
          to_location?: string
          updated_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cars_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      passengers: {
        Row: {
          address: string
          car_id: string
          created_at: string
          id: string
          name: string
          phone: string
          wedding_id: string
        }
        Insert: {
          address: string
          car_id: string
          created_at?: string
          id?: string
          name: string
          phone: string
          wedding_id?: string
        }
        Update: {
          address?: string
          car_id?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "passengers_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passengers_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      weddings: {
        Row: {
          created_at: string
          guest_token: string
          id: string
          name: string
          slug: string
          venue_address: string
          venue_name: string
        }
        Insert: {
          created_at?: string
          guest_token?: string
          id?: string
          name: string
          slug: string
          venue_address?: string
          venue_name?: string
        }
        Update: {
          created_at?: string
          guest_token?: string
          id?: string
          name?: string
          slug?: string
          venue_address?: string
          venue_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_car_for_wedding: {
        Args: {
          p_access_key: string
          p_admin_key: string | null
          p_departure_time: string | null
          p_direction: Database["public"]["Enums"]["trip_direction"]
          p_driver_name: string
          p_driver_phone: string
          p_from_location: string
          p_notes: string | null
          p_password: string
          p_seats_total: number
          p_to_location: string
          p_wedding_id: string
        }
        Returns: Database["public"]["Tables"]["cars"]["Row"][]
      }
      create_wedding_admin: {
        Args: {
          p_admin_key: string
          p_name: string
          p_slug: string
          p_venue_address: string
          p_venue_name: string
        }
        Returns: Database["public"]["Tables"]["weddings"]["Row"][]
      }
      delete_car_for_wedding: {
        Args: {
          p_access_key: string
          p_admin_key: string | null
          p_car_id: string
          p_wedding_id: string
        }
        Returns: string
      }
      delete_passenger_for_wedding: {
        Args: {
          p_access_key: string
          p_admin_key: string | null
          p_passenger_id: string
          p_wedding_id: string
        }
        Returns: string
      }
      delete_wedding_admin: {
        Args: { p_admin_key: string; p_wedding_id: string }
        Returns: string
      }
      get_cars_for_wedding: {
        Args: {
          p_access_key: string
          p_admin_key: string | null
          p_wedding_id: string
        }
        Returns: Json
      }
      get_wedding_by_slug: {
        Args: {
          p_access_key: string
          p_admin_key: string | null
          p_slug: string
        }
        Returns: Database["public"]["Tables"]["weddings"]["Row"][]
      }
      has_wedding_access: {
        Args: {
          p_access_key: string
          p_admin_key?: string | null
          p_wedding_id: string
        }
        Returns: boolean
      }
      is_wedding_admin: {
        Args: { p_admin_key: string }
        Returns: boolean
      }
      join_car_with_password: {
        Args: {
          p_access_key: string
          p_admin_key: string | null
          p_address: string
          p_car_id: string
          p_name: string
          p_password: string
          p_phone: string
        }
        Returns: Database["public"]["Tables"]["passengers"]["Row"]
      }
      list_weddings_admin: {
        Args: { p_admin_key: string }
        Returns: Database["public"]["Tables"]["weddings"]["Row"][]
      }
      update_car_for_wedding: {
        Args: {
          p_access_key: string
          p_admin_key: string | null
          p_car_id: string
          p_departure_time: string | null
          p_direction: Database["public"]["Enums"]["trip_direction"]
          p_driver_name: string
          p_driver_phone: string
          p_from_location: string
          p_notes: string | null
          p_password: string
          p_seats_total: number
          p_to_location: string
          p_wedding_id: string
        }
        Returns: Database["public"]["Tables"]["cars"]["Row"][]
      }
    }
    Enums: {
      trip_direction: "to" | "from"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      trip_direction: ["to", "from"],
    },
  },
} as const
