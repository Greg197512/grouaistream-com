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
          cover_url: string | null
          created_at: string
          description: string
          generated_by_ai: boolean
          id: string
          is_published: boolean
          slug: string
          tags: string[] | null
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          category?: string
          content: string
          cover_url?: string | null
          created_at?: string
          description: string
          generated_by_ai?: boolean
          id?: string
          is_published?: boolean
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          category?: string
          content?: string
          cover_url?: string | null
          created_at?: string
          description?: string
          generated_by_ai?: boolean
          id?: string
          is_published?: boolean
          slug?: string
          tags?: string[] | null
          title?: string
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
          cover_url: string | null
          created_at: string
          duration: number
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
          video_url: string | null
        }
        Insert: {
          album?: string | null
          artist: string
          audio_url?: string | null
          boost_expires_at?: string | null
          cover_url?: string | null
          created_at?: string
          duration?: number
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
          video_url?: string | null
        }
        Update: {
          album?: string | null
          artist?: string
          audio_url?: string | null
          boost_expires_at?: string | null
          cover_url?: string | null
          created_at?: string
          duration?: number
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
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
      get_tip_wallet: { Args: never; Returns: Json }
      get_user_generation_count: { Args: { _user_id: string }; Returns: number }
      get_user_id_by_email: { Args: { _email: string }; Returns: string }
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
