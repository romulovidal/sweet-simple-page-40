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
      analytics_events: {
        Row: {
          created_at: string
          device_id: string | null
          event_name: string
          id: string
          path: string | null
          props: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          event_name: string
          id?: string
          path?: string | null
          props?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          event_name?: string
          id?: string
          path?: string | null
          props?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      atis_birthdays: {
        Row: {
          active: boolean
          birth_date: string
          created_at: string
          group_id: string | null
          id: string
          message_template: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          birth_date: string
          created_at?: string
          group_id?: string | null
          id?: string
          message_template?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          birth_date?: string
          created_at?: string
          group_id?: string | null
          id?: string
          message_template?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atis_birthdays_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "atis_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      atis_broadcasts: {
        Row: {
          body: string
          content_type: string
          created_at: string
          error: string | null
          id: string
          recurrence: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: string
          target_ref: string | null
          target_type: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          content_type?: string
          created_at?: string
          error?: string | null
          id?: string
          recurrence?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          target_ref?: string | null
          target_type: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          content_type?: string
          created_at?: string
          error?: string | null
          id?: string
          recurrence?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          target_ref?: string | null
          target_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      atis_config: {
        Row: {
          active: boolean
          avatar_url: string | null
          bot_name: string
          bot_number: string | null
          commands: Json
          evolution_instance: string | null
          evolution_url: string | null
          id: number
          mention_only_default: boolean
          persona: string | null
          timezone: string
          trigger_words: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          bot_name?: string
          bot_number?: string | null
          commands?: Json
          evolution_instance?: string | null
          evolution_url?: string | null
          id?: number
          mention_only_default?: boolean
          persona?: string | null
          timezone?: string
          trigger_words?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          bot_name?: string
          bot_number?: string | null
          commands?: Json
          evolution_instance?: string | null
          evolution_url?: string | null
          id?: number
          mention_only_default?: boolean
          persona?: string | null
          timezone?: string
          trigger_words?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      atis_contacts: {
        Row: {
          birthday: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          opt_in: boolean
          phone: string
          tags: string[]
          updated_at: string
          welcomed_at: string | null
        }
        Insert: {
          birthday?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          opt_in?: boolean
          phone: string
          tags?: string[]
          updated_at?: string
          welcomed_at?: string | null
        }
        Update: {
          birthday?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          opt_in?: boolean
          phone?: string
          tags?: string[]
          updated_at?: string
          welcomed_at?: string | null
        }
        Relationships: []
      }
      atis_crisis_alerts: {
        Row: {
          contact_name: string | null
          contact_phone: string
          created_at: string
          handled: boolean
          handled_at: string | null
          handled_by: string | null
          id: string
          matched_keywords: string[]
          pastor_notified: boolean
          severity: string
          snippet: string | null
        }
        Insert: {
          contact_name?: string | null
          contact_phone: string
          created_at?: string
          handled?: boolean
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          matched_keywords?: string[]
          pastor_notified?: boolean
          severity?: string
          snippet?: string | null
        }
        Update: {
          contact_name?: string | null
          contact_phone?: string
          created_at?: string
          handled?: boolean
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          matched_keywords?: string[]
          pastor_notified?: boolean
          severity?: string
          snippet?: string | null
        }
        Relationships: []
      }
      atis_crisis_mutes: {
        Row: {
          contact_phone: string
          created_at: string
          id: string
          pastor_phone: string
        }
        Insert: {
          contact_phone: string
          created_at?: string
          id?: string
          pastor_phone: string
        }
        Update: {
          contact_phone?: string
          created_at?: string
          id?: string
          pastor_phone?: string
        }
        Relationships: []
      }
      atis_groups: {
        Row: {
          active: boolean
          created_at: string
          forward_notifications: boolean
          id: string
          name: string
          notification_times: Json
          notification_types: string[]
          respond_mode: string
          updated_at: string
          wa_group_id: string | null
          welcome_message: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          forward_notifications?: boolean
          id?: string
          name: string
          notification_times?: Json
          notification_types?: string[]
          respond_mode?: string
          updated_at?: string
          wa_group_id?: string | null
          welcome_message?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          forward_notifications?: boolean
          id?: string
          name?: string
          notification_times?: Json
          notification_types?: string[]
          respond_mode?: string
          updated_at?: string
          wa_group_id?: string | null
          welcome_message?: string | null
        }
        Relationships: []
      }
      atis_messages_log: {
        Row: {
          body: string | null
          command: string | null
          created_at: string
          direction: string
          error: string | null
          id: string
          raw: Json | null
          status: string | null
          wa_from: string | null
          wa_group_id: string | null
          wa_to: string | null
        }
        Insert: {
          body?: string | null
          command?: string | null
          created_at?: string
          direction: string
          error?: string | null
          id?: string
          raw?: Json | null
          status?: string | null
          wa_from?: string | null
          wa_group_id?: string | null
          wa_to?: string | null
        }
        Update: {
          body?: string | null
          command?: string | null
          created_at?: string
          direction?: string
          error?: string | null
          id?: string
          raw?: Json | null
          status?: string | null
          wa_from?: string | null
          wa_group_id?: string | null
          wa_to?: string | null
        }
        Relationships: []
      }
      atis_plan_subscribers: {
        Row: {
          active: boolean
          contact_id: string | null
          created_at: string
          current_day: number
          id: string
          last_sent_date: string | null
          name: string | null
          phone: string
          plan_id: string
          send_time: string
          started_at: string
        }
        Insert: {
          active?: boolean
          contact_id?: string | null
          created_at?: string
          current_day?: number
          id?: string
          last_sent_date?: string | null
          name?: string | null
          phone: string
          plan_id: string
          send_time?: string
          started_at?: string
        }
        Update: {
          active?: boolean
          contact_id?: string | null
          created_at?: string
          current_day?: number
          id?: string
          last_sent_date?: string | null
          name?: string | null
          phone?: string
          plan_id?: string
          send_time?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atis_plan_subscribers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "atis_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atis_plan_subscribers_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "admin_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      atis_series: {
        Row: {
          active: boolean
          ai_commentary: boolean
          created_at: string
          group_ids: string[]
          id: string
          items: Json
          mention_all: boolean
          name: string
          send_time: string
          theme: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          ai_commentary?: boolean
          created_at?: string
          group_ids?: string[]
          id?: string
          items?: Json
          mention_all?: boolean
          name: string
          send_time?: string
          theme?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          ai_commentary?: boolean
          created_at?: string
          group_ids?: string[]
          id?: string
          items?: Json
          mention_all?: boolean
          name?: string
          send_time?: string
          theme?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      atis_series_group_progress: {
        Row: {
          active: boolean
          current_day: number
          group_id: string
          id: string
          last_sent_date: string | null
          series_id: string
          started_at: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          current_day?: number
          group_id: string
          id?: string
          last_sent_date?: string | null
          series_id: string
          started_at?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          current_day?: number
          group_id?: string
          id?: string
          last_sent_date?: string | null
          series_id?: string
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atis_series_group_progress_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "atis_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atis_series_group_progress_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "atis_series"
            referencedColumns: ["id"]
          },
        ]
      }
      atis_series_subscribers: {
        Row: {
          active: boolean
          contact_id: string | null
          created_at: string
          current_day: number
          id: string
          last_sent_date: string | null
          name: string | null
          phone: string
          series_id: string
          started_at: string
        }
        Insert: {
          active?: boolean
          contact_id?: string | null
          created_at?: string
          current_day?: number
          id?: string
          last_sent_date?: string | null
          name?: string | null
          phone: string
          series_id: string
          started_at?: string
        }
        Update: {
          active?: boolean
          contact_id?: string | null
          created_at?: string
          current_day?: number
          id?: string
          last_sent_date?: string | null
          name?: string | null
          phone?: string
          series_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atis_series_subscribers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "atis_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atis_series_subscribers_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "atis_series"
            referencedColumns: ["id"]
          },
        ]
      }
      atis_studies: {
        Row: {
          base_text: string
          created_at: string
          id: string
          published: boolean
          questions: string[]
          refs: string[]
          theme: string | null
          title: string
          updated_at: string
        }
        Insert: {
          base_text: string
          created_at?: string
          id?: string
          published?: boolean
          questions?: string[]
          refs?: string[]
          theme?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          base_text?: string
          created_at?: string
          id?: string
          published?: boolean
          questions?: string[]
          refs?: string[]
          theme?: string | null
          title?: string
          updated_at?: string
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
      canticos: {
        Row: {
          capotraste: number | null
          categoria: string | null
          created_at: string
          created_by: string | null
          historico_execucao: Json
          id: string
          letra_json: Json
          letra_raw: string
          momentos_sugeridos: string[]
          numero: number
          playbacks: Json
          publicado: boolean
          referencia_biblica: string | null
          titulo: string
          tom: string | null
          updated_at: string
        }
        Insert: {
          capotraste?: number | null
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          historico_execucao?: Json
          id?: string
          letra_json?: Json
          letra_raw: string
          momentos_sugeridos?: string[]
          numero: number
          playbacks?: Json
          publicado?: boolean
          referencia_biblica?: string | null
          titulo: string
          tom?: string | null
          updated_at?: string
        }
        Update: {
          capotraste?: number | null
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          historico_execucao?: Json
          id?: string
          letra_json?: Json
          letra_raw?: string
          momentos_sugeridos?: string[]
          numero?: number
          playbacks?: Json
          publicado?: boolean
          referencia_biblica?: string | null
          titulo?: string
          tom?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      canticos_ministros: {
        Row: {
          ativo: boolean
          created_at: string
          foto_url: string | null
          id: string
          nome: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          foto_url?: string | null
          id?: string
          nome: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          foto_url?: string | null
          id?: string
          nome?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      canticos_ministros_link: {
        Row: {
          cantico_id: string
          created_at: string
          ministro_id: string
        }
        Insert: {
          cantico_id: string
          created_at?: string
          ministro_id: string
        }
        Update: {
          cantico_id?: string
          created_at?: string
          ministro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canticos_ministros_link_cantico_id_fkey"
            columns: ["cantico_id"]
            isOneToOne: false
            referencedRelation: "canticos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canticos_ministros_link_ministro_id_fkey"
            columns: ["ministro_id"]
            isOneToOne: false
            referencedRelation: "canticos_ministros"
            referencedColumns: ["id"]
          },
        ]
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
      culto_selections: {
        Row: {
          created_at: string
          created_by: string | null
          culto_date: string
          id: string
          is_active: boolean
          items: Json
          schedule_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          culto_date: string
          id?: string
          is_active?: boolean
          items?: Json
          schedule_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          culto_date?: string
          id?: string
          is_active?: boolean
          items?: Json
          schedule_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "culto_selections_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "culto_schedules"
            referencedColumns: ["id"]
          },
        ]
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
      harpa_reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          hino_number: number
          hino_title: string
          id: string
          message: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          hino_number: number
          hino_title: string
          id?: string
          message: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          hino_number?: number
          hino_title?: string
          id?: string
          message?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
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
          atis_welcomed_at: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
          whatsapp: string | null
          whatsapp_opt_in: boolean
        }
        Insert: {
          atis_welcomed_at?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
          whatsapp?: string | null
          whatsapp_opt_in?: boolean
        }
        Update: {
          atis_welcomed_at?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
          whatsapp_opt_in?: boolean
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
      rate_limits: {
        Row: {
          count: number
          endpoint: string
          identifier: string
          window_start: string
        }
        Insert: {
          count?: number
          endpoint: string
          identifier: string
          window_start: string
        }
        Update: {
          count?: number
          endpoint?: string
          identifier?: string
          window_start?: string
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
      verse_shares: {
        Row: {
          book_abbrev: string
          book_name: string | null
          chapter: number
          created_at: string
          slug: string
          text_snippet: string | null
          verses: number[]
          version: string | null
        }
        Insert: {
          book_abbrev: string
          book_name?: string | null
          chapter: number
          created_at?: string
          slug: string
          text_snippet?: string | null
          verses?: number[]
          version?: string | null
        }
        Update: {
          book_abbrev?: string
          book_name?: string | null
          chapter?: number
          created_at?: string
          slug?: string
          text_snippet?: string | null
          verses?: number[]
          version?: string | null
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
      check_and_increment_rate_limit: {
        Args: {
          _endpoint: string
          _identifier: string
          _max: number
          _window_seconds: number
        }
        Returns: Json
      }
      cleanup_old_data: { Args: never; Returns: Json }
      get_analytics_summary: { Args: { _days_back?: number }; Returns: Json }
      get_prayer_author_names: {
        Args: { _user_ids: string[] }
        Returns: {
          display_name: string
          user_id: string
        }[]
      }
      get_retention_metrics: { Args: { _days_back?: number }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_cantico_numero: { Args: never; Returns: number }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
