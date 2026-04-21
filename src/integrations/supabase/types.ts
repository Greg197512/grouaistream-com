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
      ad_campaigns: {
        Row: {
          ad_description: string
          ad_image_url: string | null
          ad_title: string
          ad_url: string
          amount_eur: number
          blog_post_id: string | null
          company_name: string
          contact_email: string
          created_at: string
          expires_at: string
          id: string
          industry: string | null
          lead_id: string | null
          metadata: Json | null
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          payment_deadline: string
          payment_reference: string | null
          payment_status: string
          publish_status: string
          updated_at: string
        }
        Insert: {
          ad_description: string
          ad_image_url?: string | null
          ad_title: string
          ad_url: string
          amount_eur?: number
          blog_post_id?: string | null
          company_name: string
          contact_email: string
          created_at?: string
          expires_at?: string
          id?: string
          industry?: string | null
          lead_id?: string | null
          metadata?: Json | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_deadline?: string
          payment_reference?: string | null
          payment_status?: string
          publish_status?: string
          updated_at?: string
        }
        Update: {
          ad_description?: string
          ad_image_url?: string | null
          ad_title?: string
          ad_url?: string
          amount_eur?: number
          blog_post_id?: string | null
          company_name?: string
          contact_email?: string
          created_at?: string
          expires_at?: string
          id?: string
          industry?: string | null
          lead_id?: string | null
          metadata?: Json | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_deadline?: string
          payment_reference?: string | null
          payment_status?: string
          publish_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "seo_blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_campaigns_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "ad_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_leads: {
        Row: {
          company_name: string | null
          contacted_at: string | null
          country: string | null
          created_at: string
          email: string
          id: string
          industry: string | null
          metadata: Json | null
          notes: string | null
          outreach_token: string
          reply_received_at: string | null
          source: string
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          company_name?: string | null
          contacted_at?: string | null
          country?: string | null
          created_at?: string
          email: string
          id?: string
          industry?: string | null
          metadata?: Json | null
          notes?: string | null
          outreach_token?: string
          reply_received_at?: string | null
          source?: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          company_name?: string | null
          contacted_at?: string | null
          country?: string | null
          created_at?: string
          email?: string
          id?: string
          industry?: string | null
          metadata?: Json | null
          notes?: string | null
          outreach_token?: string
          reply_received_at?: string | null
          source?: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      admin_marquee_messages: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          is_active: boolean
          message: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean
          message: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean
          message?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          id: number
          n8n_webhook_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          n8n_webhook_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          n8n_webhook_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      agent_decisions: {
        Row: {
          action_taken: Json
          agent_name: string
          created_at: string
          decision_type: string
          event_ids: string[] | null
          executed: boolean
          executed_at: string | null
          id: string
          reasoning: string | null
          rejected: boolean
          rejected_at: string | null
          rejected_by: string | null
        }
        Insert: {
          action_taken?: Json
          agent_name: string
          created_at?: string
          decision_type: string
          event_ids?: string[] | null
          executed?: boolean
          executed_at?: string | null
          id?: string
          reasoning?: string | null
          rejected?: boolean
          rejected_at?: string | null
          rejected_by?: string | null
        }
        Update: {
          action_taken?: Json
          agent_name?: string
          created_at?: string
          decision_type?: string
          event_ids?: string[] | null
          executed?: boolean
          executed_at?: string | null
          id?: string
          reasoning?: string | null
          rejected?: boolean
          rejected_at?: string | null
          rejected_by?: string | null
        }
        Relationships: []
      }
      agent_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
          priority: number
          processed_at: string | null
          processed_by_brain: boolean
          source: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          priority?: number
          processed_at?: string | null
          processed_by_brain?: boolean
          source: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          priority?: number
          processed_at?: string | null
          processed_by_brain?: boolean
          source?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      agent_registry: {
        Row: {
          created_at: string
          cron_schedule: string | null
          description: string | null
          enabled: boolean
          error_count: number
          id: string
          last_error: string | null
          last_run_at: string | null
          last_status: string | null
          name: string
          success_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          cron_schedule?: string | null
          description?: string | null
          enabled?: boolean
          error_count?: number
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          name: string
          success_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          cron_schedule?: string | null
          description?: string | null
          enabled?: boolean
          error_count?: number
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          name?: string
          success_count?: number
          updated_at?: string
        }
        Relationships: []
      }
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
      audio_features: {
        Row: {
          acousticness: number | null
          analyzed_by: string | null
          bpm: number | null
          catalog_id: string
          created_at: string
          danceability: number | null
          energy: number | null
          id: string
          instrumentalness: number | null
          liveness: number | null
          loudness_db: number | null
          music_key: string | null
          music_mode: string | null
          speechiness: number | null
          tempo_confidence: number | null
          time_signature: string | null
          valence: number | null
        }
        Insert: {
          acousticness?: number | null
          analyzed_by?: string | null
          bpm?: number | null
          catalog_id: string
          created_at?: string
          danceability?: number | null
          energy?: number | null
          id?: string
          instrumentalness?: number | null
          liveness?: number | null
          loudness_db?: number | null
          music_key?: string | null
          music_mode?: string | null
          speechiness?: number | null
          tempo_confidence?: number | null
          time_signature?: string | null
          valence?: number | null
        }
        Update: {
          acousticness?: number | null
          analyzed_by?: string | null
          bpm?: number | null
          catalog_id?: string
          created_at?: string
          danceability?: number | null
          energy?: number | null
          id?: string
          instrumentalness?: number | null
          liveness?: number | null
          loudness_db?: number | null
          music_key?: string | null
          music_mode?: string | null
          speechiness?: number | null
          tempo_confidence?: number | null
          time_signature?: string | null
          valence?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_features_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: true
            referencedRelation: "song_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_affiliate_links: {
        Row: {
          brand: string
          category: string
          click_count: number
          created_at: string
          description: string | null
          display_text: string
          id: string
          is_active: boolean
          keywords: string[]
          priority: number
          updated_at: string
          url: string
        }
        Insert: {
          brand: string
          category?: string
          click_count?: number
          created_at?: string
          description?: string | null
          display_text: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          priority?: number
          updated_at?: string
          url: string
        }
        Update: {
          brand?: string
          category?: string
          click_count?: number
          created_at?: string
          description?: string | null
          display_text?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          priority?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      blog_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_hidden: boolean
          parent_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          parent_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          parent_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "blog_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "seo_blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_newsletter_log: {
        Row: {
          created_at: string
          error_count: number
          id: string
          metadata: Json | null
          post_id: string | null
          recipients_count: number
          status: string
          success_count: number
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          error_count?: number
          id?: string
          metadata?: Json | null
          post_id?: string | null
          recipients_count?: number
          status?: string
          success_count?: number
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          error_count?: number
          id?: string
          metadata?: Json | null
          post_id?: string | null
          recipients_count?: number
          status?: string
          success_count?: number
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_newsletter_log_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "seo_blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_newsletter_subscribers: {
        Row: {
          confirmed: boolean
          created_at: string
          email: string
          id: string
          source: string
          unsubscribed_at: string | null
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          email: string
          id?: string
          source?: string
          unsubscribed_at?: string | null
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          email?: string
          id?: string
          source?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      blog_post_hooks: {
        Row: {
          created_at: string
          email_hook: string | null
          email_subject: string | null
          id: string
          post_id: string
          telegram_hook: string | null
          x_hook: string | null
        }
        Insert: {
          created_at?: string
          email_hook?: string | null
          email_subject?: string | null
          id?: string
          post_id: string
          telegram_hook?: string | null
          x_hook?: string | null
        }
        Update: {
          created_at?: string
          email_hook?: string | null
          email_subject?: string | null
          id?: string
          post_id?: string
          telegram_hook?: string | null
          x_hook?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_hooks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "seo_blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "seo_blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_saves: {
        Row: {
          id: string
          post_id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          id?: string
          post_id: string
          saved_at?: string
          user_id: string
        }
        Update: {
          id?: string
          post_id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "seo_blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_external_sources: {
        Row: {
          created_at: string
          enabled: boolean
          filter_keywords: string[] | null
          id: string
          items_ingested_total: number
          last_error: string | null
          last_fetched_at: string | null
          last_status: string | null
          name: string
          source_type: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          filter_keywords?: string[] | null
          id?: string
          items_ingested_total?: number
          last_error?: string | null
          last_fetched_at?: string | null
          last_status?: string | null
          name: string
          source_type: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          filter_keywords?: string[] | null
          id?: string
          items_ingested_total?: number
          last_error?: string | null
          last_fetched_at?: string | null
          last_status?: string | null
          name?: string
          source_type?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      brain_ingest_dedup: {
        Row: {
          expires_at: string
          ingested_at: string
          source_name: string | null
          url_hash: string
        }
        Insert: {
          expires_at?: string
          ingested_at?: string
          source_name?: string | null
          url_hash: string
        }
        Update: {
          expires_at?: string
          ingested_at?: string
          source_name?: string | null
          url_hash?: string
        }
        Relationships: []
      }
      brain_memory: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          expires_at: string | null
          id: string
          importance: number
          memory_type: string
          metadata: Json
          source_url: string | null
          summary: string | null
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          expires_at?: string | null
          id?: string
          importance?: number
          memory_type: string
          metadata?: Json
          source_url?: string | null
          summary?: string | null
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          expires_at?: string | null
          id?: string
          importance?: number
          memory_type?: string
          metadata?: Json
          source_url?: string | null
          summary?: string | null
          title?: string
        }
        Relationships: []
      }
      creator_earnings: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          earning_type: string
          id: string
          track_id: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          earning_type?: string
          id?: string
          track_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          earning_type?: string
          id?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_earnings_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_milestone_bonuses: {
        Row: {
          amount: number
          bonus_type: string
          granted_at: string
          id: string
          user_id: string
        }
        Insert: {
          amount?: number
          bonus_type: string
          granted_at?: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          bonus_type?: string
          granted_at?: string
          id?: string
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          generation_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          generation_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          generation_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
      generations: {
        Row: {
          audio_url: string | null
          created_at: string
          genre: string
          id: string
          instrumental: boolean
          prompt: string
          replicate_id: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          genre?: string
          id?: string
          instrumental?: boolean
          prompt: string
          replicate_id?: string | null
          status?: string
          title?: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          genre?: string
          id?: string
          instrumental?: boolean
          prompt?: string
          replicate_id?: string | null
          status?: string
          title?: string
          user_id?: string
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
      melody_embeddings: {
        Row: {
          catalog_id: string
          created_at: string
          embedding: string | null
          embedding_model: string | null
          embedding_source: string | null
          id: string
        }
        Insert: {
          catalog_id: string
          created_at?: string
          embedding?: string | null
          embedding_model?: string | null
          embedding_source?: string | null
          id?: string
        }
        Update: {
          catalog_id?: string
          created_at?: string
          embedding?: string | null
          embedding_model?: string | null
          embedding_source?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "melody_embeddings_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: true
            referencedRelation: "song_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      mix_preferences: {
        Row: {
          created_at: string
          id: string
          mix_style: string
          rating: number | null
          track_a_genre: string | null
          track_a_id: string | null
          track_a_title: string
          track_b_genre: string | null
          track_b_id: string | null
          track_b_title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mix_style?: string
          rating?: number | null
          track_a_genre?: string | null
          track_a_id?: string | null
          track_a_title: string
          track_b_genre?: string | null
          track_b_id?: string | null
          track_b_title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mix_style?: string
          rating?: number | null
          track_a_genre?: string | null
          track_a_id?: string | null
          track_a_title?: string
          track_b_genre?: string | null
          track_b_id?: string | null
          track_b_title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mix_preferences_track_a_id_fkey"
            columns: ["track_a_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mix_preferences_track_b_id_fkey"
            columns: ["track_b_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_analysis_bonuses: {
        Row: {
          amount: number
          granted_at: string
          id: string
          user_id: string
        }
        Insert: {
          amount?: number
          granted_at?: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          granted_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
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
      n8n_ingest_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          label: string
          last_used_at: string | null
          rate_limit_per_hour: number | null
          source_type: string
          token: string
          total_ingests: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          last_used_at?: string | null
          rate_limit_per_hour?: number | null
          source_type: string
          token?: string
          total_ingests?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          last_used_at?: string | null
          rate_limit_per_hour?: number | null
          source_type?: string
          token?: string
          total_ingests?: number | null
        }
        Relationships: []
      }
      one_time_purchases: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          environment: string
          id: string
          paddle_customer_id: string | null
          paddle_transaction_id: string
          price_id: string
          product_id: string
          recipient_track_id: string | null
          recipient_user_id: string | null
          refunded_at: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          environment?: string
          id?: string
          paddle_customer_id?: string | null
          paddle_transaction_id: string
          price_id: string
          product_id: string
          recipient_track_id?: string | null
          recipient_user_id?: string | null
          refunded_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          environment?: string
          id?: string
          paddle_customer_id?: string | null
          paddle_transaction_id?: string
          price_id?: string
          product_id?: string
          recipient_track_id?: string | null
          recipient_user_id?: string | null
          refunded_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "one_time_purchases_recipient_track_id_fkey"
            columns: ["recipient_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_costs: {
        Row: {
          billing_day: number
          created_at: string
          id: string
          is_active: boolean
          monthly_amount: number
          notes: string | null
          service_name: string
          updated_at: string
        }
        Insert: {
          billing_day?: number
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_amount: number
          notes?: string | null
          service_name: string
          updated_at?: string
        }
        Update: {
          billing_day?: number
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_amount?: number
          notes?: string | null
          service_name?: string
          updated_at?: string
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
      payout_details: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          amount: number
          bank_account: string
          city: string
          created_at: string
          full_name: string
          id: string
          payout_request_id: string | null
          user_id: string
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          amount: number
          bank_account: string
          city: string
          created_at?: string
          full_name: string
          id?: string
          payout_request_id?: string | null
          user_id: string
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          amount?: number
          bank_account?: string
          city?: string
          created_at?: string
          full_name?: string
          id?: string
          payout_request_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_details_payout_request_id_fkey"
            columns: ["payout_request_id"]
            isOneToOne: false
            referencedRelation: "payout_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          amount: number
          id: string
          processed_at: string | null
          requested_at: string
          status: string
          stripe_payout_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          id?: string
          processed_at?: string | null
          requested_at?: string
          status?: string
          stripe_payout_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          id?: string
          processed_at?: string | null
          requested_at?: string
          status?: string
          stripe_payout_id?: string | null
          user_id?: string
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
          blog_newsletter_opt_out: boolean
          created_at: string
          display_name: string | null
          first_login_completed: boolean | null
          id: string
          role: string
          subscription_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          blog_newsletter_opt_out?: boolean
          created_at?: string
          display_name?: string | null
          first_login_completed?: boolean | null
          id?: string
          role?: string
          subscription_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          blog_newsletter_opt_out?: boolean
          created_at?: string
          display_name?: string | null
          first_login_completed?: boolean | null
          id?: string
          role?: string
          subscription_status?: string
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
      seo_activity_log: {
        Row: {
          action_type: string
          created_at: string
          id: string
          level: string
          message: string
          metadata: Json | null
          triggered_by: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          level?: string
          message: string
          metadata?: Json | null
          triggered_by?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          triggered_by?: string
        }
        Relationships: []
      }
      seo_blog_posts: {
        Row: {
          category: string
          content: string
          content_en: string | null
          content_nl: string | null
          content_ua: string | null
          cover_url: string | null
          created_at: string
          description: string
          description_en: string | null
          description_nl: string | null
          description_ua: string | null
          generated_by_ai: boolean
          id: string
          is_published: boolean
          slug: string
          tags: string[] | null
          title: string
          title_en: string | null
          title_nl: string | null
          title_ua: string | null
          translation_status: string | null
          translations_updated_at: string | null
          updated_at: string
          view_count: number
        }
        Insert: {
          category?: string
          content: string
          content_en?: string | null
          content_nl?: string | null
          content_ua?: string | null
          cover_url?: string | null
          created_at?: string
          description: string
          description_en?: string | null
          description_nl?: string | null
          description_ua?: string | null
          generated_by_ai?: boolean
          id?: string
          is_published?: boolean
          slug: string
          tags?: string[] | null
          title: string
          title_en?: string | null
          title_nl?: string | null
          title_ua?: string | null
          translation_status?: string | null
          translations_updated_at?: string | null
          updated_at?: string
          view_count?: number
        }
        Update: {
          category?: string
          content?: string
          content_en?: string | null
          content_nl?: string | null
          content_ua?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string
          description_en?: string | null
          description_nl?: string | null
          description_ua?: string | null
          generated_by_ai?: boolean
          id?: string
          is_published?: boolean
          slug?: string
          tags?: string[] | null
          title?: string
          title_en?: string | null
          title_nl?: string | null
          title_ua?: string | null
          translation_status?: string | null
          translations_updated_at?: string | null
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      seo_keywords: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          keyword: string
          last_checked_at: string | null
          last_position: number | null
          priority: number
          total_clicks: number
          total_impressions: number
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keyword: string
          last_checked_at?: string | null
          last_position?: number | null
          priority?: number
          total_clicks?: number
          total_impressions?: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keyword?: string
          last_checked_at?: string | null
          last_position?: number | null
          priority?: number
          total_clicks?: number
          total_impressions?: number
        }
        Relationships: []
      }
      seo_settings: {
        Row: {
          auto_blog_enabled: boolean
          auto_indexnow_enabled: boolean
          auto_meta_enabled: boolean
          auto_sitemap_enabled: boolean
          blog_frequency_days: number
          id: number
          last_blog_at: string | null
          last_indexnow_at: string | null
          last_sitemap_at: string | null
          ping_frequency_hours: number
          updated_at: string
        }
        Insert: {
          auto_blog_enabled?: boolean
          auto_indexnow_enabled?: boolean
          auto_meta_enabled?: boolean
          auto_sitemap_enabled?: boolean
          blog_frequency_days?: number
          id?: number
          last_blog_at?: string | null
          last_indexnow_at?: string | null
          last_sitemap_at?: string | null
          ping_frequency_hours?: number
          updated_at?: string
        }
        Update: {
          auto_blog_enabled?: boolean
          auto_indexnow_enabled?: boolean
          auto_meta_enabled?: boolean
          auto_sitemap_enabled?: boolean
          blog_frequency_days?: number
          id?: number
          last_blog_at?: string | null
          last_indexnow_at?: string | null
          last_sitemap_at?: string | null
          ping_frequency_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      song_catalog: {
        Row: {
          artist: string
          audio_url: string | null
          cover_url: string | null
          created_at: string
          duration_seconds: number | null
          external_id: string | null
          genre: string | null
          id: string
          ingested_by: string | null
          is_training_eligible: boolean | null
          language: string | null
          license: string | null
          lyrics: string | null
          metadata: Json | null
          moderation_status: string | null
          mood: string | null
          source: string
          source_url: string | null
          subgenre: string | null
          title: string
          updated_at: string
        }
        Insert: {
          artist: string
          audio_url?: string | null
          cover_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          external_id?: string | null
          genre?: string | null
          id?: string
          ingested_by?: string | null
          is_training_eligible?: boolean | null
          language?: string | null
          license?: string | null
          lyrics?: string | null
          metadata?: Json | null
          moderation_status?: string | null
          mood?: string | null
          source?: string
          source_url?: string | null
          subgenre?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          artist?: string
          audio_url?: string | null
          cover_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          external_id?: string | null
          genre?: string | null
          id?: string
          ingested_by?: string | null
          is_training_eligible?: boolean | null
          language?: string | null
          license?: string | null
          lyrics?: string | null
          metadata?: Json | null
          moderation_status?: string | null
          mood?: string | null
          source?: string
          source_url?: string | null
          subgenre?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      stream_events: {
        Row: {
          counted: boolean
          country: string | null
          duration_played: number
          id: string
          source: string | null
          streamed_at: string
          track_id: string
          user_id: string
        }
        Insert: {
          counted?: boolean
          country?: string | null
          duration_played?: number
          id?: string
          source?: string | null
          streamed_at?: string
          track_id: string
          user_id: string
        }
        Update: {
          counted?: boolean
          country?: string | null
          duration_played?: number
          id?: string
          source?: string | null
          streamed_at?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_events_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_chat_messages: {
        Row: {
          ai_model: string | null
          content: string
          created_at: string
          generation_id: string | null
          id: string
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          ai_model?: string | null
          content: string
          created_at?: string
          generation_id?: string | null
          id?: string
          metadata?: Json | null
          role: string
          user_id: string
        }
        Update: {
          ai_model?: string | null
          content?: string
          created_at?: string
          generation_id?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      studio_generations: {
        Row: {
          ai_model: string
          audio_url: string | null
          bpm: number | null
          completed_at: string | null
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          genre: string | null
          id: string
          lyrics: string | null
          metadata: Json | null
          mood: string | null
          music_key: string | null
          platform_track_id: string | null
          prompt: string
          reference_audio_url: string | null
          status: string | null
          stem_bass_url: string | null
          stem_drums_url: string | null
          stem_other_url: string | null
          stem_vocals_url: string | null
          structure: Json | null
          subgenre: string | null
          time_signature: string | null
          title: string | null
          uploaded_to_platform: boolean | null
          user_id: string
          vocal_url: string | null
          voice_clone_id: string | null
        }
        Insert: {
          ai_model: string
          audio_url?: string | null
          bpm?: number | null
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          genre?: string | null
          id?: string
          lyrics?: string | null
          metadata?: Json | null
          mood?: string | null
          music_key?: string | null
          platform_track_id?: string | null
          prompt: string
          reference_audio_url?: string | null
          status?: string | null
          stem_bass_url?: string | null
          stem_drums_url?: string | null
          stem_other_url?: string | null
          stem_vocals_url?: string | null
          structure?: Json | null
          subgenre?: string | null
          time_signature?: string | null
          title?: string | null
          uploaded_to_platform?: boolean | null
          user_id: string
          vocal_url?: string | null
          voice_clone_id?: string | null
        }
        Update: {
          ai_model?: string
          audio_url?: string | null
          bpm?: number | null
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          genre?: string | null
          id?: string
          lyrics?: string | null
          metadata?: Json | null
          mood?: string | null
          music_key?: string | null
          platform_track_id?: string | null
          prompt?: string
          reference_audio_url?: string | null
          status?: string | null
          stem_bass_url?: string | null
          stem_drums_url?: string | null
          stem_other_url?: string | null
          stem_vocals_url?: string | null
          structure?: Json | null
          subgenre?: string | null
          time_signature?: string | null
          title?: string | null
          uploaded_to_platform?: boolean | null
          user_id?: string
          vocal_url?: string | null
          voice_clone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_generations_platform_track_id_fkey"
            columns: ["platform_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tiktok_artists_pool: {
        Row: {
          created_at: string
          era: string | null
          genre: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          story_hook: string | null
          used_count: number
        }
        Insert: {
          created_at?: string
          era?: string | null
          genre?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          story_hook?: string | null
          used_count?: number
        }
        Update: {
          created_at?: string
          era?: string | null
          genre?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          story_hook?: string | null
          used_count?: number
        }
        Relationships: []
      }
      tiktok_reel_templates: {
        Row: {
          app_route: string | null
          created_at: string
          duration_seconds: number
          feature_name: string
          hook: string
          id: string
          is_active: boolean
          last_used_at: string | null
          outro: string
          queue_order: number
          screenshot_paths: string[]
          slug: string
          title: string
          updated_at: string
          used_count: number
          voiceover_script: string
        }
        Insert: {
          app_route?: string | null
          created_at?: string
          duration_seconds?: number
          feature_name: string
          hook: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          outro?: string
          queue_order?: number
          screenshot_paths?: string[]
          slug: string
          title: string
          updated_at?: string
          used_count?: number
          voiceover_script: string
        }
        Update: {
          app_route?: string | null
          created_at?: string
          duration_seconds?: number
          feature_name?: string
          hook?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          outro?: string
          queue_order?: number
          screenshot_paths?: string[]
          slug?: string
          title?: string
          updated_at?: string
          used_count?: number
          voiceover_script?: string
        }
        Relationships: []
      }
      tiktok_reels: {
        Row: {
          audio_url: string | null
          captions: Json
          created_at: string
          duration_seconds: number
          feature_name: string
          generated_by: string | null
          id: string
          language: string
          metadata: Json | null
          screenshot_urls: string[]
          status: string
          template_id: string | null
          title: string
          updated_at: string
          video_url: string | null
          voiceover_script: string
        }
        Insert: {
          audio_url?: string | null
          captions?: Json
          created_at?: string
          duration_seconds?: number
          feature_name: string
          generated_by?: string | null
          id?: string
          language?: string
          metadata?: Json | null
          screenshot_urls?: string[]
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
          voiceover_script: string
        }
        Update: {
          audio_url?: string | null
          captions?: Json
          created_at?: string
          duration_seconds?: number
          feature_name?: string
          generated_by?: string | null
          id?: string
          language?: string
          metadata?: Json | null
          screenshot_urls?: string[]
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
          voiceover_script?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_reels_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "tiktok_reel_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_stories: {
        Row: {
          artist_name: string
          audio_url: string | null
          blog_post_id: string | null
          captions: Json
          created_at: string
          duration_seconds: number
          era: string | null
          generated_by_ai: boolean
          genre: string | null
          hook: string
          id: string
          image_urls: Json
          metadata: Json
          outro: string
          published_youtube_at: string | null
          script: string
          status: string
          updated_at: string
          video_url: string | null
          views_estimate: number
          voice_id: string
          youtube_video_id: string | null
        }
        Insert: {
          artist_name: string
          audio_url?: string | null
          blog_post_id?: string | null
          captions?: Json
          created_at?: string
          duration_seconds?: number
          era?: string | null
          generated_by_ai?: boolean
          genre?: string | null
          hook: string
          id?: string
          image_urls?: Json
          metadata?: Json
          outro?: string
          published_youtube_at?: string | null
          script: string
          status?: string
          updated_at?: string
          video_url?: string | null
          views_estimate?: number
          voice_id?: string
          youtube_video_id?: string | null
        }
        Update: {
          artist_name?: string
          audio_url?: string | null
          blog_post_id?: string | null
          captions?: Json
          created_at?: string
          duration_seconds?: number
          era?: string | null
          generated_by_ai?: boolean
          genre?: string | null
          hook?: string
          id?: string
          image_urls?: Json
          metadata?: Json
          outro?: string
          published_youtube_at?: string | null
          script?: string
          status?: string
          updated_at?: string
          video_url?: string | null
          views_estimate?: number
          voice_id?: string
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_stories_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "seo_blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      tip_transactions: {
        Row: {
          amount: number
          artist_amount: number
          created_at: string
          id: string
          platform_fee: number
          recipient_id: string
          sender_id: string
          track_id: string | null
          tx_type: string
        }
        Insert: {
          amount: number
          artist_amount: number
          created_at?: string
          id?: string
          platform_fee: number
          recipient_id: string
          sender_id: string
          track_id?: string | null
          tx_type?: string
        }
        Update: {
          amount?: number
          artist_amount?: number
          created_at?: string
          id?: string
          platform_fee?: number
          recipient_id?: string
          sender_id?: string
          track_id?: string | null
          tx_type?: string
        }
        Relationships: []
      }
      tip_wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          total_received: number
          total_sent: number
          updated_at: string
          user_id: string
          welcome_seen: boolean
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          total_received?: number
          total_sent?: number
          updated_at?: string
          user_id: string
          welcome_seen?: boolean
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          total_received?: number
          total_sent?: number
          updated_at?: string
          user_id?: string
          welcome_seen?: boolean
        }
        Relationships: []
      }
      track_boosts: {
        Row: {
          amount_paid: number
          created_at: string
          expires_at: string
          id: string
          impressions_total: number
          impressions_used: number
          is_active: boolean
          package_type: string
          track_id: string
          user_id: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          expires_at?: string
          id?: string
          impressions_total?: number
          impressions_used?: number
          is_active?: boolean
          package_type?: string
          track_id: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          expires_at?: string
          id?: string
          impressions_total?: number
          impressions_used?: number
          is_active?: boolean
          package_type?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_boosts_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      track_ratings: {
        Row: {
          created_at: string
          id: string
          listened_seconds: number
          stars: number
          track_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listened_seconds?: number
          stars: number
          track_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listened_seconds?: number
          stars?: number
          track_id?: string
          user_id?: string
        }
        Relationships: []
      }
      track_submissions: {
        Row: {
          created_at: string
          description: string | null
          genre: string
          id: string
          moderated_at: string | null
          moderation_result: Json | null
          moderator_notes: string | null
          rejection_reasons: string[] | null
          score_length: number | null
          score_lyrics: number | null
          score_originality: number | null
          score_production: number | null
          score_vocal: number | null
          status: string
          suno_link: string
          title: string
          total_score: number | null
          user_email: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          genre: string
          id?: string
          moderated_at?: string | null
          moderation_result?: Json | null
          moderator_notes?: string | null
          rejection_reasons?: string[] | null
          score_length?: number | null
          score_lyrics?: number | null
          score_originality?: number | null
          score_production?: number | null
          score_vocal?: number | null
          status?: string
          suno_link: string
          title: string
          total_score?: number | null
          user_email: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          genre?: string
          id?: string
          moderated_at?: string | null
          moderation_result?: Json | null
          moderator_notes?: string | null
          rejection_reasons?: string[] | null
          score_length?: number | null
          score_lyrics?: number | null
          score_originality?: number | null
          score_production?: number | null
          score_vocal?: number | null
          status?: string
          suno_link?: string
          title?: string
          total_score?: number | null
          user_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tracks: {
        Row: {
          album: string | null
          artist: string
          audio_url: string | null
          boost_expires_at: string | null
          bpm: number | null
          cover_url: string | null
          created_at: string
          danceability: number | null
          duration: number
          energy: number | null
          features_analyzed_at: string | null
          genre: string | null
          id: string
          is_boosted: boolean
          is_monetized: boolean
          monetization_enabled_at: string | null
          mood: string | null
          title: string
          total_earnings: number
          total_streams: number
          user_id: string | null
          valence: number | null
          video_url: string | null
        }
        Insert: {
          album?: string | null
          artist: string
          audio_url?: string | null
          boost_expires_at?: string | null
          bpm?: number | null
          cover_url?: string | null
          created_at?: string
          danceability?: number | null
          duration?: number
          energy?: number | null
          features_analyzed_at?: string | null
          genre?: string | null
          id?: string
          is_boosted?: boolean
          is_monetized?: boolean
          monetization_enabled_at?: string | null
          mood?: string | null
          title: string
          total_earnings?: number
          total_streams?: number
          user_id?: string | null
          valence?: number | null
          video_url?: string | null
        }
        Update: {
          album?: string | null
          artist?: string
          audio_url?: string | null
          boost_expires_at?: string | null
          bpm?: number | null
          cover_url?: string | null
          created_at?: string
          danceability?: number | null
          duration?: number
          energy?: number | null
          features_analyzed_at?: string | null
          genre?: string | null
          id?: string
          is_boosted?: boolean
          is_monetized?: boolean
          monetization_enabled_at?: string | null
          mood?: string | null
          title?: string
          total_earnings?: number
          total_streams?: number
          user_id?: string | null
          valence?: number | null
          video_url?: string | null
        }
        Relationships: []
      }
      training_dataset: {
        Row: {
          audio_url: string
          catalog_id: string
          created_at: string
          duration_seconds: number | null
          export_batch: string | null
          exported_at: string | null
          id: string
          opt_in: boolean | null
          prompt_text: string
          quality_score: number | null
        }
        Insert: {
          audio_url: string
          catalog_id: string
          created_at?: string
          duration_seconds?: number | null
          export_batch?: string | null
          exported_at?: string | null
          id?: string
          opt_in?: boolean | null
          prompt_text: string
          quality_score?: number | null
        }
        Update: {
          audio_url?: string
          catalog_id?: string
          created_at?: string
          duration_seconds?: number | null
          export_batch?: string | null
          exported_at?: string | null
          id?: string
          opt_in?: boolean | null
          prompt_text?: string
          quality_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_dataset_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: true
            referencedRelation: "song_catalog"
            referencedColumns: ["id"]
          },
        ]
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
      user_preferences: {
        Row: {
          ai_profile_summary: string | null
          avoid_genres: string[]
          avoid_moods: string[]
          created_at: string
          daily_patterns: Json
          genre_weights: Json
          id: string
          last_analyzed_at: string | null
          mood_weights: Json
          preferred_energy: string
          preferred_tempo: string
          total_tracks_analyzed: number
          updated_at: string
          user_id: string
          weekly_patterns: Json
        }
        Insert: {
          ai_profile_summary?: string | null
          avoid_genres?: string[]
          avoid_moods?: string[]
          created_at?: string
          daily_patterns?: Json
          genre_weights?: Json
          id?: string
          last_analyzed_at?: string | null
          mood_weights?: Json
          preferred_energy?: string
          preferred_tempo?: string
          total_tracks_analyzed?: number
          updated_at?: string
          user_id: string
          weekly_patterns?: Json
        }
        Update: {
          ai_profile_summary?: string | null
          avoid_genres?: string[]
          avoid_moods?: string[]
          created_at?: string
          daily_patterns?: Json
          genre_weights?: Json
          id?: string
          last_analyzed_at?: string | null
          mood_weights?: Json
          preferred_energy?: string
          preferred_tempo?: string
          total_tracks_analyzed?: number
          updated_at?: string
          user_id?: string
          weekly_patterns?: Json
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
      user_voices: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          label: string
          user_id: string
          voice_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          user_id: string
          voice_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          user_id?: string
          voice_id?: string
        }
        Relationships: []
      }
      weekend_challenge_claims: {
        Row: {
          amount: number
          challenge_id: string
          claimed_at: string
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          challenge_id: string
          claimed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          challenge_id?: string
          claimed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekend_challenge_claims_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "weekend_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      weekend_challenges: {
        Row: {
          activity_type: string
          created_at: string
          created_by: string | null
          description: string
          ends_at: string
          generated_by_ai: boolean
          id: string
          is_active: boolean
          reward_amount: number
          starts_at: string
          target_count: number
          title: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          created_by?: string | null
          description: string
          ends_at: string
          generated_by_ai?: boolean
          id?: string
          is_active?: boolean
          reward_amount: number
          starts_at?: string
          target_count: number
          title: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string
          generated_by_ai?: boolean
          id?: string
          is_active?: boolean
          reward_amount?: number
          starts_at?: string
          target_count?: number
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      acknowledge_payout: { Args: { _detail_id: string }; Returns: Json }
      ad_outreach_daily_count: { Args: never; Returns: number }
      add_to_song_catalog: {
        Args: {
          _artist: string
          _audio_url?: string
          _duration?: number
          _external_id?: string
          _genre?: string
          _ingested_by?: string
          _license?: string
          _lyrics?: string
          _metadata?: Json
          _mood?: string
          _source: string
          _title: string
        }
        Returns: string
      }
      admin_confirm_ad_payment: {
        Args: { _campaign_id: string; _reference?: string }
        Returns: Json
      }
      admin_create_weekend_challenge: {
        Args: {
          _activity_type: string
          _description: string
          _duration_hours?: number
          _reward_amount: number
          _target_count: number
          _title: string
        }
        Returns: Json
      }
      admin_remove_ad_campaign: {
        Args: { _campaign_id: string }
        Returns: Json
      }
      admin_topup_tip_credits: {
        Args: { _amount: number; _user_id: string }
        Returns: Json
      }
      claim_likes_milestone_bonus: { Args: never; Returns: Json }
      claim_mood_analysis_bonus: { Args: never; Returns: Json }
      claim_mood_sessions_milestone_bonus: { Args: never; Returns: Json }
      claim_ratings_50_milestone_bonus: { Args: never; Returns: Json }
      claim_studio_milestone_bonus: { Args: never; Returns: Json }
      claim_upload_milestone_bonus: { Args: never; Returns: Json }
      claim_weekend_challenge: {
        Args: { _challenge_id: string }
        Returns: Json
      }
      cleanup_brain_ingest_dedup: { Args: never; Returns: number }
      cleanup_expired_brain_memory: { Args: never; Returns: number }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      emit_agent_event: {
        Args: {
          _actor_user_id?: string
          _event_type: string
          _payload?: Json
          _priority?: number
          _source: string
          _target_id?: string
          _target_type?: string
        }
        Returns: string
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_profile_for_user: {
        Args: { _display_name?: string; _user_id: string }
        Returns: {
          display_name: string
          role: string
          subscription_status: string
        }[]
      }
      expire_unpaid_ad_campaigns: { Args: never; Returns: number }
      get_active_weekend_challenge: { Args: never; Returns: Json }
      get_admin_cost_overview: { Args: never; Returns: Json }
      get_admin_financial_overview: { Args: never; Returns: Json }
      get_admin_likes_overview: { Args: never; Returns: Json }
      get_admin_stats: { Args: never; Returns: Json }
      get_admin_tip_overview: { Args: never; Returns: Json }
      get_all_ratings_for_admin: {
        Args: { _only_suspicious?: boolean }
        Returns: Json
      }
      get_all_users_bonus_progress: { Args: never; Returns: Json }
      get_all_users_for_admin: { Args: never; Returns: Json }
      get_my_likes_stats: { Args: never; Returns: Json }
      get_pending_payouts: { Args: never; Returns: Json }
      get_random_tippable_track: {
        Args: never
        Returns: {
          owner_user_id: string
          track_id: string
        }[]
      }
      get_seo_dashboard_stats: { Args: never; Returns: Json }
      get_similar_tracks_by_embedding: {
        Args: { _limit?: number; _query_embedding: string }
        Returns: {
          artist: string
          catalog_id: string
          genre: string
          similarity: number
          title: string
        }[]
      }
      get_tip_wallet: { Args: never; Returns: Json }
      get_user_audio_fingerprint: { Args: never; Returns: Json }
      get_user_generation_count: { Args: { _user_id: string }; Returns: number }
      get_user_id_by_email: { Args: { _email: string }; Returns: string }
      get_user_top_tracks_for_ai: { Args: { _user_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_blog_view: { Args: { _post_id: string }; Returns: undefined }
      log_seo_activity: {
        Args: {
          _action_type: string
          _level: string
          _message: string
          _metadata?: Json
          _triggered_by?: string
        }
        Returns: string
      }
      mark_tip_welcome_seen: { Args: never; Returns: Json }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      purchase_boost: {
        Args: { _package?: string; _track_id: string }
        Returns: Json
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_stream:
        | {
            Args: {
              _duration_played: number
              _track_id: string
              _user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _duration_played: number
              _source?: string
              _track_id: string
              _user_id: string
            }
            Returns: undefined
          }
      search_brain_memory: {
        Args: {
          _match_count?: number
          _memory_types?: string[]
          _min_importance?: number
          _query_embedding: string
        }
        Returns: {
          content: string
          created_at: string
          id: string
          importance: number
          memory_type: string
          metadata: Json
          similarity: number
          source_url: string
          summary: string
          title: string
        }[]
      }
      send_tip: { Args: { _amount: number; _track_id: string }; Returns: Json }
      submit_payout_request: {
        Args: { _bank_account: string; _city: string; _full_name: string }
        Returns: Json
      }
      submit_rating_with_like: {
        Args: { _listened_seconds: number; _stars: number; _track_id: string }
        Returns: Json
      }
      sync_profile_membership: {
        Args: { _user_id: string }
        Returns: {
          role: string
          subscription_status: string
        }[]
      }
      verify_unlock_code: { Args: { candidate: string }; Returns: boolean }
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
