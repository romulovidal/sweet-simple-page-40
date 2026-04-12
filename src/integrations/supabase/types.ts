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
      admin_plan_readings: {
        Row: {
          book_abbrev: string
          chapter: number
          created_at: string
          day_number: number
          id: string
          plan_id: string
          title: string | null
          verse_end: number | null
          verse_start: number | null
        }
        Insert: {
          book_abbrev: string
          chapter: number
          created_at?: string
          day_number: number
          id?: string
          plan_id: string
          title?: string | null
          verse_end?: number | null
          verse_start?: number | null
        }
        Update: {
          book_abbrev?: string
          chapter?: number
          created_at?: string
          day_number?: number
          id?: string
          plan_id?: string
          title?: string | null
          verse_end?: number | null
          verse_start?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_plan_readings_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "admin_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_plans: {
        Row: {
          category: string
          created_at: string
          description: string
          devotional: string | null
          id: string
          image_emoji: string
          is_active: boolean
          sort_order: number
          title: string
          total_days: number | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          devotional?: string | null
          id?: string
          image_emoji?: string
          is_active?: boolean
          sort_order?: number
          title: string
          total_days?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          devotional?: string | null
          id?: string
          image_emoji?: string
          is_active?: boolean
          sort_order?: number
          title?: string
          total_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_posts: {
        Row: {
          bible_reference: string | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          published_at: string
          sort_order: number
          title: string
          type: string
          updated_at: string
          youtube_url: string | null
        }
        Insert: {
          bible_reference?: string | null
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          published_at?: string
          sort_order?: number
          title: string
          type?: string
          updated_at?: string
          youtube_url?: string | null
        }
        Update: {
          bible_reference?: string | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          published_at?: string
          sort_order?: number
          title?: string
          type?: string
          updated_at?: string
          youtube_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_plan_progress: {
        Row: {
          completed_days: number[]
          id: string
          plan_id: string
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_days?: number[]
          id?: string
          plan_id: string
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_days?: number[]
          id?: string
          plan_id?: string
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_plan_progress_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "admin_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_saved_verses: {
        Row: {
          book_abbrev: string | null
          chapter: number | null
          created_at: string
          id: string
          reference: string
          text: string
          user_id: string
          verse: number | null
        }
        Insert: {
          book_abbrev?: string | null
          chapter?: number | null
          created_at?: string
          id?: string
          reference: string
          text: string
          user_id: string
          verse?: number | null
        }
        Update: {
          book_abbrev?: string | null
          chapter?: number | null
          created_at?: string
          id?: string
          reference?: string
          text?: string
          user_id?: string
          verse?: number | null
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          current_streak: number
          history: string[]
          id: string
          last_read_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          history?: string[]
          id?: string
          last_read_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          history?: string[]
          id?: string
          last_read_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
