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
      admin_activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
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
      admin_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      badges: {
        Row: {
          category: string | null
          created_at: string | null
          description: string
          icon: string
          id: string
          name: string
          requirement_days: number
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description: string
          icon: string
          id?: string
          name: string
          requirement_days: number
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string
          icon?: string
          id?: string
          name?: string
          requirement_days?: number
        }
        Relationships: []
      }
      culto_reminders: {
        Row: {
          created_at: string
          id: string
          last_sent: string | null
          message: string
          minutes_before: number | null
          schedule_id: string
          scheduled_at: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_sent?: string | null
          message?: string
          minutes_before?: number | null
          schedule_id: string
          scheduled_at?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_sent?: string | null
          message?: string
          minutes_before?: number | null
          schedule_id?: string
          scheduled_at?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "culto_reminders_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "culto_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      culto_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          id: string
          is_active: boolean
          last_reminder_sent: string | null
          name: string
          reminder_minutes_before: number
          time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          id?: string
          is_active?: boolean
          last_reminder_sent?: string | null
          name: string
          reminder_minutes_before?: number
          time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          id?: string
          is_active?: boolean
          last_reminder_sent?: string | null
          name?: string
          reminder_minutes_before?: number
          time?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_verse_queue: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          scheduled_date: string
          verse_ref: string
          verse_text: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          scheduled_date: string
          verse_ref: string
          verse_text: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          scheduled_date?: string
          verse_ref?: string
          verse_text?: string
        }
        Relationships: []
      }
      device_streaks: {
        Row: {
          created_at: string
          current_streak: number
          device_id: string
          history: string[]
          last_seen_date: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          current_streak?: number
          device_id: string
          history?: string[]
          last_seen_date?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          current_streak?: number
          device_id?: string
          history?: string[]
          last_seen_date?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      historia_favorites: {
        Row: {
          created_at: string
          id: string
          kind: string
          ref_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          ref_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          ref_id?: string
          user_id?: string
        }
        Relationships: []
      }
      historia_plan_progress: {
        Row: {
          completed_at: string
          day_index: number
          id: string
          plan_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          day_index: number
          id?: string
          plan_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          day_index?: number
          id?: string
          plan_id?: string
          user_id?: string
        }
        Relationships: []
      }
      historia_quiz_attempts: {
        Row: {
          answers: Json
          created_at: string
          duration_ms: number
          id: string
          quiz_id: string
          score: number
          total: number
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          duration_ms?: number
          id?: string
          quiz_id: string
          score: number
          total: number
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          duration_ms?: number
          id?: string
          quiz_id?: string
          score?: number
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      prayer_reactions: {
        Row: {
          created_at: string
          id: string
          request_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_reactions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "prayer_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_requests: {
        Row: {
          content: string
          created_at: string
          id: string
          is_answered: boolean
          is_public: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_answered?: boolean
          is_public?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_answered?: boolean
          is_public?: boolean
          updated_at?: string
          user_id?: string
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
      push_log: {
        Row: {
          body: string
          id: string
          sent_at: string
          sent_by: string | null
          title: string
          total_failed: number
          total_sent: number
        }
        Insert: {
          body: string
          id?: string
          sent_at?: string
          sent_by?: string | null
          title: string
          total_failed?: number
          total_sent?: number
        }
        Update: {
          body?: string
          id?: string
          sent_at?: string
          sent_by?: string | null
          title?: string
          total_failed?: number
          total_sent?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string | null
        }
        Relationships: []
      }
      reading_goals: {
        Row: {
          completed_chapters: Json
          created_at: string
          id: string
          target_chapters: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          completed_chapters?: Json
          created_at?: string
          id?: string
          target_chapters?: number
          updated_at?: string
          user_id: string
          year?: number
        }
        Update: {
          completed_chapters?: Json
          created_at?: string
          id?: string
          target_chapters?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notes: {
        Row: {
          book_abbrev: string
          chapter: number
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          verse: number | null
        }
        Insert: {
          book_abbrev: string
          chapter: number
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          verse?: number | null
        }
        Update: {
          book_abbrev?: string
          chapter?: number
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          verse?: number | null
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
      user_sync_state: {
        Row: {
          id: string
          state: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          state?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          state?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      current_daily_verse: {
        Row: {
          created_at: string | null
          id: string | null
          scheduled_date: string | null
          verse_ref: string | null
          verse_text: string | null
        }
        Relationships: []
      }
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
