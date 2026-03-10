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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_assistant_config: {
        Row: {
          assistant_name: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assistant_name?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assistant_name?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dj_session_guests: {
        Row: {
          guest_name: string | null
          id: string
          joined_at: string
          last_reaction: string | null
          last_reaction_at: string | null
          session_id: string
          user_id: string | null
        }
        Insert: {
          guest_name?: string | null
          id?: string
          joined_at?: string
          last_reaction?: string | null
          last_reaction_at?: string | null
          session_id: string
          user_id?: string | null
        }
        Update: {
          guest_name?: string | null
          id?: string
          joined_at?: string
          last_reaction?: string | null
          last_reaction_at?: string | null
          session_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dj_session_guests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "dj_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      dj_session_votes: {
        Row: {
          created_at: string
          guest_id: string | null
          id: string
          session_id: string
          vote_type: string
          vote_value: string
        }
        Insert: {
          created_at?: string
          guest_id?: string | null
          id?: string
          session_id: string
          vote_type?: string
          vote_value: string
        }
        Update: {
          created_at?: string
          guest_id?: string | null
          id?: string
          session_id?: string
          vote_type?: string
          vote_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "dj_session_votes_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "dj_session_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dj_session_votes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "dj_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      dj_sessions: {
        Row: {
          bpm: number | null
          created_at: string
          genre: string | null
          host_user_id: string
          id: string
          is_active: boolean
          max_guests: number | null
          session_code: string
          session_name: string
          updated_at: string
        }
        Insert: {
          bpm?: number | null
          created_at?: string
          genre?: string | null
          host_user_id: string
          id?: string
          is_active?: boolean
          max_guests?: number | null
          session_code?: string
          session_name?: string
          updated_at?: string
        }
        Update: {
          bpm?: number | null
          created_at?: string
          genre?: string | null
          host_user_id?: string
          id?: string
          is_active?: boolean
          max_guests?: number | null
          session_code?: string
          session_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      liked_songs: {
        Row: {
          id: string
          liked_at: string
          track_id: string
          user_id: string
        }
        Insert: {
          id?: string
          liked_at?: string
          track_id: string
          user_id: string
        }
        Update: {
          id?: string
          liked_at?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "liked_songs_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      listening_history: {
        Row: {
          duration_played: number | null
          id: string
          mood_detected: string | null
          played_at: string
          skipped: boolean | null
          track_id: string
          user_id: string
        }
        Insert: {
          duration_played?: number | null
          id?: string
          mood_detected?: string | null
          played_at?: string
          skipped?: boolean | null
          track_id: string
          user_id: string
        }
        Update: {
          duration_played?: number | null
          id?: string
          mood_detected?: string | null
          played_at?: string
          skipped?: boolean | null
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listening_history_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_sessions: {
        Row: {
          confidence: number | null
          detected_at: string
          id: string
          mood: string
          source: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          detected_at?: string
          id?: string
          mood: string
          source?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          detected_at?: string
          id?: string
          mood?: string
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      movies: {
        Row: {
          category: string
          country: string | null
          created_at: string
          description: string | null
          director: string
          duration_minutes: number | null
          genre: string | null
          id: string
          language: string | null
          original_title: string | null
          poster_url: string | null
          rating: number | null
          title: string
          video_url: string | null
          year: number | null
        }
        Insert: {
          category?: string
          country?: string | null
          created_at?: string
          description?: string | null
          director: string
          duration_minutes?: number | null
          genre?: string | null
          id?: string
          language?: string | null
          original_title?: string | null
          poster_url?: string | null
          rating?: number | null
          title: string
          video_url?: string | null
          year?: number | null
        }
        Update: {
          category?: string
          country?: string | null
          created_at?: string
          description?: string | null
          director?: string
          duration_minutes?: number | null
          genre?: string | null
          id?: string
          language?: string | null
          original_title?: string | null
          poster_url?: string | null
          rating?: number | null
          title?: string
          video_url?: string | null
          year?: number | null
        }
        Relationships: []
      }
      party_commands: {
        Row: {
          command: string
          command_type: string
          created_at: string
          guest_label: string
          id: string
          room_id: string
        }
        Insert: {
          command: string
          command_type?: string
          created_at?: string
          guest_label?: string
          id?: string
          room_id: string
        }
        Update: {
          command?: string
          command_type?: string
          created_at?: string
          guest_label?: string
          id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_commands_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "party_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      party_rooms: {
        Row: {
          created_at: string
          expires_at: string
          guest_count: number
          host_user_id: string
          id: string
          is_active: boolean
          room_code: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          guest_count?: number
          host_user_id: string
          id?: string
          is_active?: boolean
          room_code?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          guest_count?: number
          host_user_id?: string
          id?: string
          is_active?: boolean
          room_code?: string
        }
        Relationships: []
      }
      playlist_tracks: {
        Row: {
          added_at: string
          id: string
          playlist_id: string
          position: number
          track_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          playlist_id: string
          position?: number
          track_id: string
        }
        Update: {
          added_at?: string
          id?: string
          playlist_id?: string
          position?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_tracks_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_tracks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          gradient: string | null
          id: string
          is_ai_generated: boolean | null
          is_public: boolean | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          gradient?: string | null
          id?: string
          is_ai_generated?: boolean | null
          is_public?: boolean | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          gradient?: string | null
          id?: string
          is_ai_generated?: boolean | null
          is_public?: boolean | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          first_login_completed: boolean | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          first_login_completed?: boolean | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          first_login_completed?: boolean | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      radio_config: {
        Row: {
          end_time: string | null
          id: string
          is_active: boolean
          mode: string
          start_time: string | null
          started_at: string | null
          station_name: string
          updated_at: string
        }
        Insert: {
          end_time?: string | null
          id?: string
          is_active?: boolean
          mode?: string
          start_time?: string | null
          started_at?: string | null
          station_name?: string
          updated_at?: string
        }
        Update: {
          end_time?: string | null
          id?: string
          is_active?: boolean
          mode?: string
          start_time?: string | null
          started_at?: string | null
          station_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      radio_likes: {
        Row: {
          created_at: string
          id: string
          track_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          track_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "radio_likes_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      radio_messages: {
        Row: {
          created_at: string
          display_name: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      radio_schedule: {
        Row: {
          added_at: string
          custom_audio_url: string | null
          custom_duration: number
          custom_title: string | null
          id: string
          item_type: string
          position: number
          track_id: string | null
        }
        Insert: {
          added_at?: string
          custom_audio_url?: string | null
          custom_duration?: number
          custom_title?: string | null
          id?: string
          item_type?: string
          position?: number
          track_id?: string | null
        }
        Update: {
          added_at?: string
          custom_audio_url?: string | null
          custom_duration?: number
          custom_title?: string | null
          id?: string
          item_type?: string
          position?: number
          track_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radio_schedule_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          album: string | null
          artist: string
          audio_url: string | null
          cover_url: string | null
          created_at: string
          duration: number
          genre: string | null
          id: string
          mood: string | null
          title: string
          video_url: string | null
        }
        Insert: {
          album?: string | null
          artist: string
          audio_url?: string | null
          cover_url?: string | null
          created_at?: string
          duration?: number
          genre?: string | null
          id?: string
          mood?: string | null
          title: string
          video_url?: string | null
        }
        Update: {
          album?: string | null
          artist?: string
          audio_url?: string | null
          cover_url?: string | null
          created_at?: string
          duration?: number
          genre?: string | null
          id?: string
          mood?: string | null
          title?: string
          video_url?: string | null
        }
        Relationships: []
      }
      unlock_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          label: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          status: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: string
          trial_ends_at?: string | null
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
      get_admin_stats: { Args: never; Returns: Json }
      get_user_id_by_email: { Args: { _email: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      subscription_plan: "free" | "pro" | "ultimate"
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
      app_role: ["admin", "moderator", "user"],
      subscription_plan: ["free", "pro", "ultimate"],
    },
  },
} as const
