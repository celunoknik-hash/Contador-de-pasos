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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      coin_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          idempotency_key: string
          local_date: string | null
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          idempotency_key: string
          local_date?: string | null
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          idempotency_key?: string
          local_date?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_steps: {
        Row: {
          device_id: string
          goal: number
          local_date: string
          partial: boolean
          revision: number
          source: string
          steps: number
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          device_id: string
          goal: number
          local_date: string
          partial: boolean
          revision: number
          source: string
          steps: number
          timezone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          device_id?: string
          goal?: number
          local_date?: string
          partial?: boolean
          revision?: number
          source?: string
          steps?: number
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_steps_user_id_device_id_fkey"
            columns: ["user_id", "device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["user_id", "device_id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string
          device_id: string
          platform: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          platform?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          platform?: string
          user_id?: string
        }
        Relationships: []
      }
      explored_cells: {
        Row: {
          cell_id: string
          discovered_at: string
          grid_version: number
          user_id: string
        }
        Insert: {
          cell_id: string
          discovered_at?: string
          grid_version?: number
          user_id: string
        }
        Update: {
          cell_id?: string
          discovered_at?: string
          grid_version?: number
          user_id?: string
        }
        Relationships: []
      }
      preferences: {
        Row: {
          daily_goal: number
          stride_meters: number
          theme: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          daily_goal?: number
          stride_meters?: number
          theme?: string
          user_id: string
          weight_kg?: number
        }
        Update: {
          daily_goal?: number
          stride_meters?: number
          theme?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_key: string
          created_at: string
          display_name: string
          user_id: string
        }
        Insert: {
          avatar_key?: string
          created_at?: string
          display_name?: string
          user_id: string
        }
        Update: {
          avatar_key?: string
          created_at?: string
          display_name?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_state: {
        Row: {
          amount: number
          reward_key: string
          user_id: string
          version: number
        }
        Insert: {
          amount: number
          reward_key: string
          user_id: string
          version: number
        }
        Update: {
          amount?: number
          reward_key?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      step_submissions: {
        Row: {
          anomalies: number
          client_event_id: string
          device_id: string
          local_date: string
          partial: boolean
          received_at: string
          revision: number
          source: string
          steps: number
          timezone: string
          user_id: string
        }
        Insert: {
          anomalies?: number
          client_event_id: string
          device_id: string
          local_date: string
          partial: boolean
          received_at?: string
          revision: number
          source: string
          steps: number
          timezone: string
          user_id: string
        }
        Update: {
          anomalies?: number
          client_event_id?: string
          device_id?: string
          local_date?: string
          partial?: boolean
          received_at?: string
          revision?: number
          source?: string
          steps?: number
          timezone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "step_submissions_user_id_device_id_fkey"
            columns: ["user_id", "device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["user_id", "device_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      sync_walkworld: {
        Args: {
          p_cells: string[]
          p_days: Json
          p_device: string
          p_edit_preferences: boolean
          p_preferences: Json
          p_user: string
        }
        Returns: Json
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

