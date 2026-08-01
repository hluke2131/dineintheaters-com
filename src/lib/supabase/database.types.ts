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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      chains: {
        Row: {
          id: string
          known_sub_brands: string[] | null
          locator_url: string | null
          name: string
        }
        Insert: {
          id?: string
          known_sub_brands?: string[] | null
          locator_url?: string | null
          name: string
        }
        Update: {
          id?: string
          known_sub_brands?: string[] | null
          locator_url?: string | null
          name?: string
        }
        Relationships: []
      }
      field_verification: {
        Row: {
          confirmed_count: number
          disputed_count: number
          field_name: string
          id: string
          location_id: string
        }
        Insert: {
          confirmed_count?: number
          disputed_count?: number
          field_name: string
          id?: string
          location_id: string
        }
        Update: {
          confirmed_count?: number
          disputed_count?: number
          field_name?: string
          id?: string
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_verification_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          accessibility_notes: string | null
          address: string
          age_restricted_auditoriums: boolean | null
          alcohol_served: string
          amenities: string[] | null
          chain_id: string | null
          city: string
          created_at: string
          delivery_style: string
          description: string
          fsq_id: string | null
          hours: Json | null
          id: string
          is_sponsored: boolean
          last_verified_date: string | null
          lat: number
          lng: number
          menu_price_range: string | null
          name: string
          parking_notes: string | null
          phone: string | null
          photos: string[] | null
          place_id: string | null
          reserved_recliners: boolean | null
          safety_notes: string | null
          slug: string
          state: string
          status: string
          sub_brand: string | null
          ticketing_url: string | null
          updated_at: string
          website_url: string | null
          zip: string | null
        }
        Insert: {
          accessibility_notes?: string | null
          address: string
          age_restricted_auditoriums?: boolean | null
          alcohol_served?: string
          amenities?: string[] | null
          chain_id?: string | null
          city: string
          created_at?: string
          delivery_style?: string
          description?: string
          fsq_id?: string | null
          hours?: Json | null
          id?: string
          is_sponsored?: boolean
          last_verified_date?: string | null
          lat: number
          lng: number
          menu_price_range?: string | null
          name: string
          parking_notes?: string | null
          phone?: string | null
          photos?: string[] | null
          place_id?: string | null
          reserved_recliners?: boolean | null
          safety_notes?: string | null
          slug: string
          state: string
          status?: string
          sub_brand?: string | null
          ticketing_url?: string | null
          updated_at?: string
          website_url?: string | null
          zip?: string | null
        }
        Update: {
          accessibility_notes?: string | null
          address?: string
          age_restricted_auditoriums?: boolean | null
          alcohol_served?: string
          amenities?: string[] | null
          chain_id?: string | null
          city?: string
          created_at?: string
          delivery_style?: string
          description?: string
          fsq_id?: string | null
          hours?: Json | null
          id?: string
          is_sponsored?: boolean
          last_verified_date?: string | null
          lat?: number
          lng?: number
          menu_price_range?: string | null
          name?: string
          parking_notes?: string | null
          phone?: string | null
          photos?: string[] | null
          place_id?: string | null
          reserved_recliners?: boolean | null
          safety_notes?: string | null
          slug?: string
          state?: string
          status?: string
          sub_brand?: string | null
          ticketing_url?: string | null
          updated_at?: string
          website_url?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          created_at: string
          id: string
          location_id: string
          rating: number
          review_text: string
          reviewer_email: string
          reviewer_name: string | null
          title: string | null
          visit_date: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          rating: number
          review_text: string
          reviewer_email: string
          reviewer_name?: string | null
          title?: string | null
          visit_date?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          rating?: number
          review_text?: string
          reviewer_email?: string
          reviewer_name?: string | null
          title?: string | null
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsorships: {
        Row: {
          billing_interval: string | null
          claimant_email: string
          claimant_name: string
          claimant_phone: string | null
          created_at: string
          current_period_end: string | null
          id: string
          location_id: string
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          updated_at: string
          verification_method: string
          verification_status: string | null
        }
        Insert: {
          billing_interval?: string | null
          claimant_email: string
          claimant_name: string
          claimant_phone?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          location_id: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
          verification_method: string
          verification_status?: string | null
        }
        Update: {
          billing_interval?: string | null
          claimant_email?: string
          claimant_name?: string
          claimant_phone?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          location_id?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
          verification_method?: string
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsorships_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          created_at: string
          id: string
          location_id: string | null
          status: string | null
          submitted_fields: Json
          submitter_email: string
          submitter_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          location_id?: string | null
          status?: string | null
          submitted_fields: Json
          submitter_email: string
          submitter_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string | null
          status?: string | null
          submitted_fields?: Json
          submitter_email?: string
          submitter_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
