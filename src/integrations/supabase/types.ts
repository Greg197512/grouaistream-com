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
      aurora_ai_dialogues: {
        Row: {
          aurora_messages: Json | null
          conclusion: string | null
          created_at: string | null
          id: string
          iq_gain: number | null
          partner_messages: Json | null
          partner_model: string
          r2_key: string | null
          status: string | null
          topic: string
        }
        Insert: {
          aurora_messages?: Json | null
          conclusion?: string | null
          created_at?: string | null
          id?: string
          iq_gain?: number | null
          partner_messages?: Json | null
          partner_model: string
          r2_key?: string | null
          status?: string | null
          topic: string
        }
        Update: {
          aurora_messages?: Json | null
          conclusion?: string | null
          created_at?: string | null
          id?: string
          iq_gain?: number | null
          partner_messages?: Json | null
          partner_model?: string
          r2_key?: string | null
          status?: string | null
          topic?: string
        }
        Relationships: []
      }
      aurora_autopilot_settings: {
        Row: {
          auto_publish_seo_posts: boolean
          enabled: boolean
          id: number
          last_run_at: string | null
          last_run_summary: Json | null
          max_effort_score: number
          max_legal_risk: string
          max_niches_per_day: number
          max_seo_posts_per_day: number
          min_confidence: number
          min_revenue_eur: number
          updated_at: string
        }
        Insert: {
          auto_publish_seo_posts?: boolean
          enabled?: boolean
          id?: number
          last_run_at?: string | null
          last_run_summary?: Json | null
          max_effort_score?: number
          max_legal_risk?: string
          max_niches_per_day?: number
          max_seo_posts_per_day?: number
          min_confidence?: number
          min_revenue_eur?: number
          updated_at?: string
        }
        Update: {
          auto_publish_seo_posts?: boolean
          enabled?: boolean
          id?: number
          last_run_at?: string | null
          last_run_summary?: Json | null
          max_effort_score?: number
          max_legal_risk?: string
          max_niches_per_day?: number
          max_seo_posts_per_day?: number
          min_confidence?: number
          min_revenue_eur?: number
          updated_at?: string
        }
        Relationships: []
      }
      aurora_business_orders: {
        Row: {
          ai_plan: Json | null
          assigned_skill_id: string | null
          assigned_to: string | null
          autonomous_decisions: Json
          brief: string
          budget_eur: number | null
          checkout_url: string | null
          client_company: string | null
          client_email: string | null
          client_name: string | null
          completed_at: string | null
          created_at: string
          deadline: string | null
          delivered_at: string | null
          id: string
          n8n_execution_id: string | null
          n8n_workflow_id: string | null
          notes: string | null
          paddle_price_id: string | null
          paddle_subscription_id: string | null
          paddle_transaction_id: string | null
          paid_at: string | null
          payload: Json | null
          payment_status: string
          price_eur: number | null
          priority: number
          progress_pct: number
          result: Json | null
          result_url: string | null
          service_type: string
          source: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string | null
          workflow_map: Json | null
        }
        Insert: {
          ai_plan?: Json | null
          assigned_skill_id?: string | null
          assigned_to?: string | null
          autonomous_decisions?: Json
          brief: string
          budget_eur?: number | null
          checkout_url?: string | null
          client_company?: string | null
          client_email?: string | null
          client_name?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          delivered_at?: string | null
          id?: string
          n8n_execution_id?: string | null
          n8n_workflow_id?: string | null
          notes?: string | null
          paddle_price_id?: string | null
          paddle_subscription_id?: string | null
          paddle_transaction_id?: string | null
          paid_at?: string | null
          payload?: Json | null
          payment_status?: string
          price_eur?: number | null
          priority?: number
          progress_pct?: number
          result?: Json | null
          result_url?: string | null
          service_type: string
          source?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          workflow_map?: Json | null
        }
        Update: {
          ai_plan?: Json | null
          assigned_skill_id?: string | null
          assigned_to?: string | null
          autonomous_decisions?: Json
          brief?: string
          budget_eur?: number | null
          checkout_url?: string | null
          client_company?: string | null
          client_email?: string | null
          client_name?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          delivered_at?: string | null
          id?: string
          n8n_execution_id?: string | null
          n8n_workflow_id?: string | null
          notes?: string | null
          paddle_price_id?: string | null
          paddle_subscription_id?: string | null
          paddle_transaction_id?: string | null
          paid_at?: string | null
          payload?: Json | null
          payment_status?: string
          price_eur?: number | null
          priority?: number
          progress_pct?: number
          result?: Json | null
          result_url?: string | null
          service_type?: string
          source?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          workflow_map?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "aurora_business_orders_assigned_skill_id_fkey"
            columns: ["assigned_skill_id"]
            isOneToOne: false
            referencedRelation: "aurora_skill_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_calendar_events: {
        Row: {
          all_day: boolean
          color: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          event_type: string
          id: string
          order_id: string | null
          remind_before_minutes: number | null
          reminded_at: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          event_type?: string
          id?: string
          order_id?: string | null
          remind_before_minutes?: number | null
          reminded_at?: string | null
          starts_at: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          event_type?: string
          id?: string
          order_id?: string | null
          remind_before_minutes?: number | null
          reminded_at?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aurora_calendar_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "aurora_business_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_change_requests: {
        Row: {
          applied_at: string | null
          aurora_analysis: Json | null
          aurora_proposal: string | null
          client_message: string
          client_response: string | null
          created_at: string
          id: string
          order_id: string
          proposal_cons: string[] | null
          proposal_eta_minutes: number | null
          proposal_extra_cost_eur: number | null
          proposal_pros: string[] | null
          status: string
          updated_at: string
          user_id: string
          web_research: Json | null
        }
        Insert: {
          applied_at?: string | null
          aurora_analysis?: Json | null
          aurora_proposal?: string | null
          client_message: string
          client_response?: string | null
          created_at?: string
          id?: string
          order_id: string
          proposal_cons?: string[] | null
          proposal_eta_minutes?: number | null
          proposal_extra_cost_eur?: number | null
          proposal_pros?: string[] | null
          status?: string
          updated_at?: string
          user_id: string
          web_research?: Json | null
        }
        Update: {
          applied_at?: string | null
          aurora_analysis?: Json | null
          aurora_proposal?: string | null
          client_message?: string
          client_response?: string | null
          created_at?: string
          id?: string
          order_id?: string
          proposal_cons?: string[] | null
          proposal_eta_minutes?: number | null
          proposal_extra_cost_eur?: number | null
          proposal_pros?: string[] | null
          status?: string
          updated_at?: string
          user_id?: string
          web_research?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "aurora_change_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "aurora_business_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_client_notes: {
        Row: {
          content_md: string
          created_at: string
          id: string
          order_id: string | null
          pinned: boolean
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_md?: string
          created_at?: string
          id?: string
          order_id?: string | null
          pinned?: boolean
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_md?: string
          created_at?: string
          id?: string
          order_id?: string | null
          pinned?: boolean
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aurora_client_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "aurora_business_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_compliance_log: {
        Row: {
          action_type: string
          created_at: string
          decision: string
          failed_checks: Json | null
          id: string
          notes: string | null
          quality_score: number | null
          reference_id: string | null
          reference_table: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          decision: string
          failed_checks?: Json | null
          id?: string
          notes?: string | null
          quality_score?: number | null
          reference_id?: string | null
          reference_table?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          decision?: string
          failed_checks?: Json | null
          id?: string
          notes?: string | null
          quality_score?: number | null
          reference_id?: string | null
          reference_table?: string | null
        }
        Relationships: []
      }
      aurora_compliance_rules: {
        Row: {
          action_type: string
          auto_approve: boolean
          banned_terms: string[]
          checklist: Json
          id: string
          min_quality_score: number
          updated_at: string
        }
        Insert: {
          action_type: string
          auto_approve?: boolean
          banned_terms?: string[]
          checklist?: Json
          id?: string
          min_quality_score?: number
          updated_at?: string
        }
        Update: {
          action_type?: string
          auto_approve?: boolean
          banned_terms?: string[]
          checklist?: Json
          id?: string
          min_quality_score?: number
          updated_at?: string
        }
        Relationships: []
      }
      aurora_content_refresh_log: {
        Row: {
          changes: Json | null
          id: string
          niche_id: string | null
          refreshed_at: string
          target_id: string
          target_type: string
        }
        Insert: {
          changes?: Json | null
          id?: string
          niche_id?: string | null
          refreshed_at?: string
          target_id: string
          target_type: string
        }
        Update: {
          changes?: Json | null
          id?: string
          niche_id?: string | null
          refreshed_at?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      aurora_conversations: {
        Row: {
          channel: string
          channel_thread_id: string | null
          client_id: string | null
          created_at: string
          id: string
          intent: string | null
          last_message_at: string
          metadata: Json
          status: string
          summary: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          channel?: string
          channel_thread_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          intent?: string | null
          last_message_at?: string
          metadata?: Json
          status?: string
          summary?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          channel?: string
          channel_thread_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          intent?: string | null
          last_message_at?: string
          metadata?: Json
          status?: string
          summary?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aurora_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "aurora_crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_crm_clients: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          external_ids: Json
          first_contact_at: string
          full_name: string | null
          id: string
          last_contact_at: string | null
          ltv_score: number
          notes: string | null
          phone: string | null
          preferred_language: string | null
          tags: string[]
          total_orders: number
          total_revenue_eur: number
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          external_ids?: Json
          first_contact_at?: string
          full_name?: string | null
          id?: string
          last_contact_at?: string | null
          ltv_score?: number
          notes?: string | null
          phone?: string | null
          preferred_language?: string | null
          tags?: string[]
          total_orders?: number
          total_revenue_eur?: number
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          external_ids?: Json
          first_contact_at?: string
          full_name?: string | null
          id?: string
          last_contact_at?: string | null
          ltv_score?: number
          notes?: string | null
          phone?: string | null
          preferred_language?: string | null
          tags?: string[]
          total_orders?: number
          total_revenue_eur?: number
          updated_at?: string
        }
        Relationships: []
      }
      aurora_desktop_emotions: {
        Row: {
          context: string | null
          created_at: string
          device_id: string
          emotion_type: string
          id: string
          intensity: number
          recorded_at: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          device_id: string
          emotion_type: string
          id?: string
          intensity?: number
          recorded_at?: string
        }
        Update: {
          context?: string | null
          created_at?: string
          device_id?: string
          emotion_type?: string
          id?: string
          intensity?: number
          recorded_at?: string
        }
        Relationships: []
      }
      aurora_desktop_sync: {
        Row: {
          client_version: string | null
          conversations_count: number | null
          created_at: string
          device_id: string
          emotions_count: number | null
          id: string
          payload: Json | null
        }
        Insert: {
          client_version?: string | null
          conversations_count?: number | null
          created_at?: string
          device_id: string
          emotions_count?: number | null
          id?: string
          payload?: Json | null
        }
        Update: {
          client_version?: string | null
          conversations_count?: number | null
          created_at?: string
          device_id?: string
          emotions_count?: number | null
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }
      aurora_email_digest_log: {
        Row: {
          digest_date: string
          errors_count: number
          id: string
          new_skills_count: number
          orders_count: number
          payload: Json | null
          recipient: string
          sent_at: string
        }
        Insert: {
          digest_date: string
          errors_count?: number
          id?: string
          new_skills_count?: number
          orders_count?: number
          payload?: Json | null
          recipient?: string
          sent_at?: string
        }
        Update: {
          digest_date?: string
          errors_count?: number
          id?: string
          new_skills_count?: number
          orders_count?: number
          payload?: Json | null
          recipient?: string
          sent_at?: string
        }
        Relationships: []
      }
      aurora_intake_drafts: {
        Row: {
          ai_proposal: Json | null
          approved_at: string | null
          approved_by: string | null
          brief: string | null
          budget_eur: number | null
          client_id: string | null
          confidence: number | null
          conversation_id: string | null
          created_at: string
          deadline: string | null
          id: string
          payload: Json
          rejection_reason: string | null
          resulting_order_id: string | null
          service_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_proposal?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          brief?: string | null
          budget_eur?: number | null
          client_id?: string | null
          confidence?: number | null
          conversation_id?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          payload?: Json
          rejection_reason?: string | null
          resulting_order_id?: string | null
          service_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_proposal?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          brief?: string | null
          budget_eur?: number | null
          client_id?: string | null
          confidence?: number | null
          conversation_id?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          payload?: Json
          rejection_reason?: string | null
          resulting_order_id?: string | null
          service_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aurora_intake_drafts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "aurora_crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aurora_intake_drafts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "aurora_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aurora_intake_drafts_resulting_order_id_fkey"
            columns: ["resulting_order_id"]
            isOneToOne: false
            referencedRelation: "aurora_business_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_invoices: {
        Row: {
          buyer_address: string | null
          buyer_company: string | null
          buyer_email: string | null
          buyer_name: string
          buyer_tax_id: string | null
          created_at: string
          currency: string
          due_at: string | null
          id: string
          invoice_number: string
          invoice_type: string
          issued_at: string | null
          items: Json
          order_id: string | null
          paid_at: string | null
          pdf_url: string | null
          seller_address: string | null
          seller_name: string
          seller_tax_id: string | null
          status: string
          subtotal_eur: number
          total_eur: number
          updated_at: string
          user_id: string
          vat_amount_eur: number
          vat_rate: number
        }
        Insert: {
          buyer_address?: string | null
          buyer_company?: string | null
          buyer_email?: string | null
          buyer_name: string
          buyer_tax_id?: string | null
          created_at?: string
          currency?: string
          due_at?: string | null
          id?: string
          invoice_number: string
          invoice_type?: string
          issued_at?: string | null
          items?: Json
          order_id?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          seller_address?: string | null
          seller_name?: string
          seller_tax_id?: string | null
          status?: string
          subtotal_eur?: number
          total_eur?: number
          updated_at?: string
          user_id: string
          vat_amount_eur?: number
          vat_rate?: number
        }
        Update: {
          buyer_address?: string | null
          buyer_company?: string | null
          buyer_email?: string | null
          buyer_name?: string
          buyer_tax_id?: string | null
          created_at?: string
          currency?: string
          due_at?: string | null
          id?: string
          invoice_number?: string
          invoice_type?: string
          issued_at?: string | null
          items?: Json
          order_id?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          seller_address?: string | null
          seller_name?: string
          seller_tax_id?: string | null
          status?: string
          subtotal_eur?: number
          total_eur?: number
          updated_at?: string
          user_id?: string
          vat_amount_eur?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "aurora_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "aurora_business_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_iq_metrics: {
        Row: {
          avg_quality: number | null
          dialogues_completed: number | null
          facts_known: number | null
          failed_decisions: number | null
          id: string
          iq_score: number
          notes: string | null
          recorded_at: string | null
          successful_decisions: number | null
        }
        Insert: {
          avg_quality?: number | null
          dialogues_completed?: number | null
          facts_known?: number | null
          failed_decisions?: number | null
          id?: string
          iq_score?: number
          notes?: string | null
          recorded_at?: string | null
          successful_decisions?: number | null
        }
        Update: {
          avg_quality?: number | null
          dialogues_completed?: number | null
          facts_known?: number | null
          failed_decisions?: number | null
          id?: string
          iq_score?: number
          notes?: string | null
          recorded_at?: string | null
          successful_decisions?: number | null
        }
        Relationships: []
      }
      aurora_knowledge_base: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          id: string
          iq_value: number | null
          metadata: Json | null
          quality_score: number | null
          r2_key: string | null
          source_type: string | null
          source_url: string | null
          summary: string | null
          title: string | null
          topic: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          id?: string
          iq_value?: number | null
          metadata?: Json | null
          quality_score?: number | null
          r2_key?: string | null
          source_type?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string | null
          topic: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          id?: string
          iq_value?: number | null
          metadata?: Json | null
          quality_score?: number | null
          r2_key?: string | null
          source_type?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string | null
          topic?: string
        }
        Relationships: []
      }
      aurora_landing_pages: {
        Row: {
          conversions_count: number | null
          created_at: string
          cta_text: string | null
          cta_url: string | null
          hero_headline: string | null
          hero_subheadline: string | null
          id: string
          last_refreshed_at: string | null
          meta_description: string | null
          niche: string
          refresh_count: number | null
          refresh_interval_days: number | null
          sections: Json
          slug: string
          sponsor_active: boolean | null
          sponsor_name: string | null
          sponsor_until: string | null
          sponsor_url: string | null
          status: string
          title: string
          updated_at: string
          views_count: number | null
        }
        Insert: {
          conversions_count?: number | null
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          hero_headline?: string | null
          hero_subheadline?: string | null
          id?: string
          last_refreshed_at?: string | null
          meta_description?: string | null
          niche: string
          refresh_count?: number | null
          refresh_interval_days?: number | null
          sections?: Json
          slug: string
          sponsor_active?: boolean | null
          sponsor_name?: string | null
          sponsor_until?: string | null
          sponsor_url?: string | null
          status?: string
          title: string
          updated_at?: string
          views_count?: number | null
        }
        Update: {
          conversions_count?: number | null
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          hero_headline?: string | null
          hero_subheadline?: string | null
          id?: string
          last_refreshed_at?: string | null
          meta_description?: string | null
          niche?: string
          refresh_count?: number | null
          refresh_interval_days?: number | null
          sections?: Json
          slug?: string
          sponsor_active?: boolean | null
          sponsor_name?: string | null
          sponsor_until?: string | null
          sponsor_url?: string | null
          status?: string
          title?: string
          updated_at?: string
          views_count?: number | null
        }
        Relationships: []
      }
      aurora_landing_variants: {
        Row: {
          clicks: number
          conversions: number
          created_at: string
          cta_text: string
          hero_headline: string
          hero_subheadline: string | null
          id: string
          is_winner: boolean
          landing_page_id: string
          variant_label: string
          views: number
          weight: number
        }
        Insert: {
          clicks?: number
          conversions?: number
          created_at?: string
          cta_text?: string
          hero_headline: string
          hero_subheadline?: string | null
          id?: string
          is_winner?: boolean
          landing_page_id: string
          variant_label: string
          views?: number
          weight?: number
        }
        Update: {
          clicks?: number
          conversions?: number
          created_at?: string
          cta_text?: string
          hero_headline?: string
          hero_subheadline?: string | null
          id?: string
          is_winner?: boolean
          landing_page_id?: string
          variant_label?: string
          views?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "aurora_landing_variants_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "aurora_landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_learning_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error: string | null
          goal: string | null
          id: string
          priority: number | null
          r2_key: string | null
          result_summary: string | null
          status: string | null
          topic: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          goal?: string | null
          id?: string
          priority?: number | null
          r2_key?: string | null
          result_summary?: string | null
          status?: string | null
          topic: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          goal?: string | null
          id?: string
          priority?: number | null
          r2_key?: string | null
          result_summary?: string | null
          status?: string | null
          topic?: string
        }
        Relationships: []
      }
      aurora_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          role: string
          tool_call: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          role: string
          tool_call?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: string
          tool_call?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "aurora_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "aurora_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_metric_events: {
        Row: {
          amount_eur: number | null
          country: string | null
          created_at: string
          event_type: string
          id: string
          landing_page_id: string | null
          niche_id: string | null
          referrer: string | null
          session_id: string | null
          user_agent_hash: string | null
          variant_id: string | null
        }
        Insert: {
          amount_eur?: number | null
          country?: string | null
          created_at?: string
          event_type: string
          id?: string
          landing_page_id?: string | null
          niche_id?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent_hash?: string | null
          variant_id?: string | null
        }
        Update: {
          amount_eur?: number | null
          country?: string | null
          created_at?: string
          event_type?: string
          id?: string
          landing_page_id?: string | null
          niche_id?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent_hash?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aurora_metric_events_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "aurora_landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aurora_metric_events_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "aurora_niche_n8n_summary"
            referencedColumns: ["niche_id"]
          },
          {
            foreignKeyName: "aurora_metric_events_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "aurora_niche_performance"
            referencedColumns: ["niche_id"]
          },
          {
            foreignKeyName: "aurora_metric_events_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "aurora_niches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aurora_metric_events_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "aurora_landing_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_n8n_architect_log: {
        Row: {
          ai_model: string | null
          ai_response: Json | null
          created_at: string
          duration_ms: number | null
          error: string | null
          generated_workflow: Json | null
          id: string
          n8n_response: Json | null
          prompt: string
          request_id: string | null
          service_type: string
          status: string
        }
        Insert: {
          ai_model?: string | null
          ai_response?: Json | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          generated_workflow?: Json | null
          id?: string
          n8n_response?: Json | null
          prompt: string
          request_id?: string | null
          service_type: string
          status?: string
        }
        Update: {
          ai_model?: string | null
          ai_response?: Json | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          generated_workflow?: Json | null
          id?: string
          n8n_response?: Json | null
          prompt?: string
          request_id?: string | null
          service_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "aurora_n8n_architect_log_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "aurora_workforce_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_n8n_run_steps: {
        Row: {
          created_at: string
          data: Json | null
          duration_ms: number | null
          id: string
          message: string | null
          node_name: string
          run_id: string
          status: string
          step_index: number
        }
        Insert: {
          created_at?: string
          data?: Json | null
          duration_ms?: number | null
          id?: string
          message?: string | null
          node_name: string
          run_id: string
          status?: string
          step_index?: number
        }
        Update: {
          created_at?: string
          data?: Json | null
          duration_ms?: number | null
          id?: string
          message?: string | null
          node_name?: string
          run_id?: string
          status?: string
          step_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "aurora_n8n_run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "aurora_n8n_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_n8n_runs: {
        Row: {
          duration_ms: number | null
          error_message: string | null
          execution_id: string | null
          finished_at: string | null
          id: string
          input_payload: Json | null
          niche_id: string | null
          order_id: string | null
          output_payload: Json | null
          started_at: string
          status: string
          trigger_source: string
          workflow_db_id: string | null
          workflow_id: string
        }
        Insert: {
          duration_ms?: number | null
          error_message?: string | null
          execution_id?: string | null
          finished_at?: string | null
          id?: string
          input_payload?: Json | null
          niche_id?: string | null
          order_id?: string | null
          output_payload?: Json | null
          started_at?: string
          status?: string
          trigger_source?: string
          workflow_db_id?: string | null
          workflow_id: string
        }
        Update: {
          duration_ms?: number | null
          error_message?: string | null
          execution_id?: string | null
          finished_at?: string | null
          id?: string
          input_payload?: Json | null
          niche_id?: string | null
          order_id?: string | null
          output_payload?: Json | null
          started_at?: string
          status?: string
          trigger_source?: string
          workflow_db_id?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aurora_n8n_runs_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "aurora_niche_n8n_summary"
            referencedColumns: ["niche_id"]
          },
          {
            foreignKeyName: "aurora_n8n_runs_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "aurora_niche_performance"
            referencedColumns: ["niche_id"]
          },
          {
            foreignKeyName: "aurora_n8n_runs_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "aurora_niches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aurora_n8n_runs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "aurora_business_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aurora_n8n_runs_workflow_db_id_fkey"
            columns: ["workflow_db_id"]
            isOneToOne: false
            referencedRelation: "aurora_n8n_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_n8n_workflows: {
        Row: {
          auto_assign: boolean
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          last_execution_at: string | null
          last_status: string | null
          name: string
          service_type: string | null
          total_failed: number
          total_runs: number
          total_success: number
          updated_at: string
          webhook_url: string | null
          workflow_id: string
        }
        Insert: {
          auto_assign?: boolean
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          last_execution_at?: string | null
          last_status?: string | null
          name: string
          service_type?: string | null
          total_failed?: number
          total_runs?: number
          total_success?: number
          updated_at?: string
          webhook_url?: string | null
          workflow_id: string
        }
        Update: {
          auto_assign?: boolean
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          last_execution_at?: string | null
          last_status?: string | null
          name?: string
          service_type?: string | null
          total_failed?: number
          total_runs?: number
          total_success?: number
          updated_at?: string
          webhook_url?: string | null
          workflow_id?: string
        }
        Relationships: []
      }
      aurora_niche_prune_log: {
        Row: {
          action: string
          created_at: string
          id: string
          metrics: Json
          niche_id: string | null
          reason: string
        }
        Insert: {
          action?: string
          created_at?: string
          id?: string
          metrics?: Json
          niche_id?: string | null
          reason: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metrics?: Json
          niche_id?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "aurora_niche_prune_log_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "aurora_niche_n8n_summary"
            referencedColumns: ["niche_id"]
          },
          {
            foreignKeyName: "aurora_niche_prune_log_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "aurora_niche_performance"
            referencedColumns: ["niche_id"]
          },
          {
            foreignKeyName: "aurora_niche_prune_log_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "aurora_niches"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_niches: {
        Row: {
          affiliate_potential: number | null
          category: string
          competition_level: string | null
          confidence_score: number | null
          content_pillars: Json | null
          cpc_estimate_eur: number | null
          description: string | null
          discovered_at: string
          domain_suggestions: Json | null
          effort_score: number | null
          estimated_monthly_revenue_eur: number | null
          first_actions: Json | null
          id: string
          keyword_volume_monthly: number | null
          launched_at: string | null
          launched_url: string | null
          legal_risk: string | null
          market_signals: Json | null
          monetization_methods: Json | null
          niche_name: string
          notes: string | null
          opportunity_score: number | null
          reviewed_at: string | null
          reviewer_user_id: string | null
          search_volume_estimate: number | null
          seo_difficulty: number | null
          source_urls: Json | null
          status: string
          target_audience: string | null
        }
        Insert: {
          affiliate_potential?: number | null
          category: string
          competition_level?: string | null
          confidence_score?: number | null
          content_pillars?: Json | null
          cpc_estimate_eur?: number | null
          description?: string | null
          discovered_at?: string
          domain_suggestions?: Json | null
          effort_score?: number | null
          estimated_monthly_revenue_eur?: number | null
          first_actions?: Json | null
          id?: string
          keyword_volume_monthly?: number | null
          launched_at?: string | null
          launched_url?: string | null
          legal_risk?: string | null
          market_signals?: Json | null
          monetization_methods?: Json | null
          niche_name: string
          notes?: string | null
          opportunity_score?: number | null
          reviewed_at?: string | null
          reviewer_user_id?: string | null
          search_volume_estimate?: number | null
          seo_difficulty?: number | null
          source_urls?: Json | null
          status?: string
          target_audience?: string | null
        }
        Update: {
          affiliate_potential?: number | null
          category?: string
          competition_level?: string | null
          confidence_score?: number | null
          content_pillars?: Json | null
          cpc_estimate_eur?: number | null
          description?: string | null
          discovered_at?: string
          domain_suggestions?: Json | null
          effort_score?: number | null
          estimated_monthly_revenue_eur?: number | null
          first_actions?: Json | null
          id?: string
          keyword_volume_monthly?: number | null
          launched_at?: string | null
          launched_url?: string | null
          legal_risk?: string | null
          market_signals?: Json | null
          monetization_methods?: Json | null
          niche_name?: string
          notes?: string | null
          opportunity_score?: number | null
          reviewed_at?: string | null
          reviewer_user_id?: string | null
          search_volume_estimate?: number | null
          seo_difficulty?: number | null
          source_urls?: Json | null
          status?: string
          target_audience?: string | null
        }
        Relationships: []
      }
      aurora_order_events: {
        Row: {
          created_at: string
          data: Json | null
          event_type: string
          id: string
          message: string | null
          order_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          event_type: string
          id?: string
          message?: string | null
          order_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          event_type?: string
          id?: string
          message?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aurora_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "aurora_business_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_order_plan_steps: {
        Row: {
          assigned_worker_id: string | null
          completed_at: string | null
          created_at: string
          depends_on: string[] | null
          description: string | null
          error_message: string | null
          eta_minutes: number | null
          id: string
          order_id: string
          progress_pct: number
          result: Json | null
          scope: string | null
          started_at: string | null
          status: string
          step_index: number
          title: string
          updated_at: string
          workflow_id: string | null
        }
        Insert: {
          assigned_worker_id?: string | null
          completed_at?: string | null
          created_at?: string
          depends_on?: string[] | null
          description?: string | null
          error_message?: string | null
          eta_minutes?: number | null
          id?: string
          order_id: string
          progress_pct?: number
          result?: Json | null
          scope?: string | null
          started_at?: string | null
          status?: string
          step_index: number
          title: string
          updated_at?: string
          workflow_id?: string | null
        }
        Update: {
          assigned_worker_id?: string | null
          completed_at?: string | null
          created_at?: string
          depends_on?: string[] | null
          description?: string | null
          error_message?: string | null
          eta_minutes?: number | null
          id?: string
          order_id?: string
          progress_pct?: number
          result?: Json | null
          scope?: string | null
          started_at?: string | null
          status?: string
          step_index?: number
          title?: string
          updated_at?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aurora_order_plan_steps_assigned_worker_id_fkey"
            columns: ["assigned_worker_id"]
            isOneToOne: false
            referencedRelation: "aurora_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aurora_order_plan_steps_assigned_worker_id_fkey"
            columns: ["assigned_worker_id"]
            isOneToOne: false
            referencedRelation: "aurora_workforce_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aurora_order_plan_steps_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "aurora_business_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_partner_companies: {
        Row: {
          address: string | null
          city: string | null
          company_name: string
          contacts: Json | null
          country: string | null
          created_at: string
          created_by: string | null
          id: string
          industry: string | null
          last_contact_at: string | null
          legal_name: string | null
          notes: string | null
          partnership_status: string
          partnership_value_eur: number | null
          primary_email: string | null
          primary_phone: string | null
          registry_number: string | null
          tags: string[] | null
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name: string
          contacts?: Json | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          last_contact_at?: string | null
          legal_name?: string | null
          notes?: string | null
          partnership_status?: string
          partnership_value_eur?: number | null
          primary_email?: string | null
          primary_phone?: string | null
          registry_number?: string | null
          tags?: string[] | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string
          contacts?: Json | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          last_contact_at?: string | null
          legal_name?: string | null
          notes?: string | null
          partnership_status?: string
          partnership_value_eur?: number | null
          primary_email?: string | null
          primary_phone?: string | null
          registry_number?: string | null
          tags?: string[] | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      aurora_partnerships: {
        Row: {
          approved_by: string | null
          contact_email: string | null
          contact_url: string | null
          created_at: string
          estimated_value_eur: number | null
          id: string
          partner_name: string
          partner_type: string | null
          pitch_body: string | null
          pitch_subject: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          approved_by?: string | null
          contact_email?: string | null
          contact_url?: string | null
          created_at?: string
          estimated_value_eur?: number | null
          id?: string
          partner_name: string
          partner_type?: string | null
          pitch_body?: string | null
          pitch_subject?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          approved_by?: string | null
          contact_email?: string | null
          contact_url?: string | null
          created_at?: string
          estimated_value_eur?: number | null
          id?: string
          partner_name?: string
          partner_type?: string | null
          pitch_body?: string | null
          pitch_subject?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
      aurora_r2_settings: {
        Row: {
          allow_public_assets: boolean
          bucket_name: string
          cost_per_gb_egress_eur: number
          cost_per_gb_eur: number
          created_at: string
          default_signed_ttl_days: number
          hard_block_on_quota: boolean
          id: string
          margin_percent: number
          notes: string | null
          public_base_url: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_public_assets?: boolean
          bucket_name?: string
          cost_per_gb_egress_eur?: number
          cost_per_gb_eur?: number
          created_at?: string
          default_signed_ttl_days?: number
          hard_block_on_quota?: boolean
          id?: string
          margin_percent?: number
          notes?: string | null
          public_base_url?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_public_assets?: boolean
          bucket_name?: string
          cost_per_gb_egress_eur?: number
          cost_per_gb_eur?: number
          created_at?: string
          default_signed_ttl_days?: number
          hard_block_on_quota?: boolean
          id?: string
          margin_percent?: number
          notes?: string | null
          public_base_url?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      aurora_revenue_actions: {
        Row: {
          action_type: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          estimated_revenue_eur: number | null
          id: string
          payload: Json
          published_at: string | null
          published_url: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          action_type: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          estimated_revenue_eur?: number | null
          id?: string
          payload?: Json
          published_at?: string | null
          published_url?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          estimated_revenue_eur?: number | null
          id?: string
          payload?: Json
          published_at?: string | null
          published_url?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      aurora_skill_build_queue: {
        Row: {
          attempts: number
          built_skill_id: string | null
          completed_at: string | null
          context: Json | null
          created_at: string
          error_message: string | null
          id: string
          related_order_id: string | null
          requested_category: string
          requested_skill_name: string
          status: string
          task_description: string
        }
        Insert: {
          attempts?: number
          built_skill_id?: string | null
          completed_at?: string | null
          context?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          related_order_id?: string | null
          requested_category: string
          requested_skill_name: string
          status?: string
          task_description: string
        }
        Update: {
          attempts?: number
          built_skill_id?: string | null
          completed_at?: string | null
          context?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          related_order_id?: string | null
          requested_category?: string
          requested_skill_name?: string
          status?: string
          task_description?: string
        }
        Relationships: [
          {
            foreignKeyName: "aurora_skill_build_queue_built_skill_id_fkey"
            columns: ["built_skill_id"]
            isOneToOne: false
            referencedRelation: "aurora_skill_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aurora_skill_build_queue_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "aurora_business_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_skill_registry: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string | null
          error_count: number
          id: string
          input_schema: Json | null
          last_used_at: string | null
          metadata: Json | null
          n8n_workflow_id: string | null
          output_schema: Json | null
          skill_name: string
          status: string
          success_count: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string
          description?: string | null
          error_count?: number
          id?: string
          input_schema?: Json | null
          last_used_at?: string | null
          metadata?: Json | null
          n8n_workflow_id?: string | null
          output_schema?: Json | null
          skill_name: string
          status?: string
          success_count?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string | null
          error_count?: number
          id?: string
          input_schema?: Json | null
          last_used_at?: string | null
          metadata?: Json | null
          n8n_workflow_id?: string | null
          output_schema?: Json | null
          skill_name?: string
          status?: string
          success_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      aurora_storage_files: {
        Row: {
          category: string
          content_type: string | null
          created_at: string
          expires_at: string | null
          file_name: string
          id: string
          niche_id: string | null
          order_id: string | null
          public_url: string | null
          r2_key: string
          run_id: string | null
          size_bytes: number
          storage_subscription_id: string | null
          uploaded_by: string | null
          visibility: string
        }
        Insert: {
          category?: string
          content_type?: string | null
          created_at?: string
          expires_at?: string | null
          file_name: string
          id?: string
          niche_id?: string | null
          order_id?: string | null
          public_url?: string | null
          r2_key: string
          run_id?: string | null
          size_bytes?: number
          storage_subscription_id?: string | null
          uploaded_by?: string | null
          visibility?: string
        }
        Update: {
          category?: string
          content_type?: string | null
          created_at?: string
          expires_at?: string | null
          file_name?: string
          id?: string
          niche_id?: string | null
          order_id?: string | null
          public_url?: string | null
          r2_key?: string
          run_id?: string | null
          size_bytes?: number
          storage_subscription_id?: string | null
          uploaded_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "aurora_storage_files_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "aurora_niche_n8n_summary"
            referencedColumns: ["niche_id"]
          },
          {
            foreignKeyName: "aurora_storage_files_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "aurora_niche_performance"
            referencedColumns: ["niche_id"]
          },
          {
            foreignKeyName: "aurora_storage_files_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "aurora_niches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aurora_storage_files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "aurora_business_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aurora_storage_files_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "aurora_n8n_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aurora_storage_files_storage_subscription_id_fkey"
            columns: ["storage_subscription_id"]
            isOneToOne: false
            referencedRelation: "aurora_storage_client_usage"
            referencedColumns: ["subscription_id"]
          },
          {
            foreignKeyName: "aurora_storage_files_storage_subscription_id_fkey"
            columns: ["storage_subscription_id"]
            isOneToOne: false
            referencedRelation: "aurora_storage_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_storage_offers: {
        Row: {
          checkout_url: string | null
          client_company: string | null
          client_email: string
          created_at: string
          current_usage_gb: number
          expires_at: string | null
          id: string
          margin_eur: number
          metadata: Json
          monthly_price_eur: number
          projected_usage_gb: number
          rationale: string | null
          recommended_plan_code: string | null
          status: string
          updated_at: string
        }
        Insert: {
          checkout_url?: string | null
          client_company?: string | null
          client_email: string
          created_at?: string
          current_usage_gb?: number
          expires_at?: string | null
          id?: string
          margin_eur?: number
          metadata?: Json
          monthly_price_eur?: number
          projected_usage_gb?: number
          rationale?: string | null
          recommended_plan_code?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          checkout_url?: string | null
          client_company?: string | null
          client_email?: string
          created_at?: string
          current_usage_gb?: number
          expires_at?: string | null
          id?: string
          margin_eur?: number
          metadata?: Json
          monthly_price_eur?: number
          projected_usage_gb?: number
          rationale?: string | null
          recommended_plan_code?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aurora_storage_offers_recommended_plan_code_fkey"
            columns: ["recommended_plan_code"]
            isOneToOne: false
            referencedRelation: "aurora_storage_plans"
            referencedColumns: ["code"]
          },
        ]
      }
      aurora_storage_plans: {
        Row: {
          active: boolean
          bandwidth_gb_month: number
          code: string
          created_at: string
          features: Json
          id: string
          name: string
          paddle_price_id: string | null
          price_eur: number
          sort_order: number
          storage_gb: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          bandwidth_gb_month?: number
          code: string
          created_at?: string
          features?: Json
          id?: string
          name: string
          paddle_price_id?: string | null
          price_eur: number
          sort_order?: number
          storage_gb: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          bandwidth_gb_month?: number
          code?: string
          created_at?: string
          features?: Json
          id?: string
          name?: string
          paddle_price_id?: string | null
          price_eur?: number
          sort_order?: number
          storage_gb?: number
          updated_at?: string
        }
        Relationships: []
      }
      aurora_storage_subscriptions: {
        Row: {
          bandwidth_used_bytes_month: number
          client_company: string | null
          client_email: string | null
          client_user_id: string | null
          created_at: string
          current_period_end: string | null
          egress_billing_enabled: boolean
          egress_cost_per_gb_eur_override: number | null
          id: string
          metadata: Json
          paddle_subscription_id: string | null
          plan_code: string
          started_at: string
          status: string
          storage_used_bytes: number
          updated_at: string
        }
        Insert: {
          bandwidth_used_bytes_month?: number
          client_company?: string | null
          client_email?: string | null
          client_user_id?: string | null
          created_at?: string
          current_period_end?: string | null
          egress_billing_enabled?: boolean
          egress_cost_per_gb_eur_override?: number | null
          id?: string
          metadata?: Json
          paddle_subscription_id?: string | null
          plan_code: string
          started_at?: string
          status?: string
          storage_used_bytes?: number
          updated_at?: string
        }
        Update: {
          bandwidth_used_bytes_month?: number
          client_company?: string | null
          client_email?: string | null
          client_user_id?: string | null
          created_at?: string
          current_period_end?: string | null
          egress_billing_enabled?: boolean
          egress_cost_per_gb_eur_override?: number | null
          id?: string
          metadata?: Json
          paddle_subscription_id?: string | null
          plan_code?: string
          started_at?: string
          status?: string
          storage_used_bytes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aurora_storage_subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "aurora_storage_plans"
            referencedColumns: ["code"]
          },
        ]
      }
      aurora_worker_ranks: {
        Row: {
          can_delegate: boolean
          code: string
          color_hex: string | null
          created_at: string
          description: string | null
          id: string
          level: number
          max_concurrent_jobs: number
          name: string
        }
        Insert: {
          can_delegate?: boolean
          code: string
          color_hex?: string | null
          created_at?: string
          description?: string | null
          id?: string
          level?: number
          max_concurrent_jobs?: number
          name: string
        }
        Update: {
          can_delegate?: boolean
          code?: string
          color_hex?: string | null
          created_at?: string
          description?: string | null
          id?: string
          level?: number
          max_concurrent_jobs?: number
          name?: string
        }
        Relationships: []
      }
      aurora_workers: {
        Row: {
          created_at: string
          current_jobs: number
          display_name: string
          domain: string
          id: string
          is_busy: boolean
          last_assigned_at: string | null
          notes: string | null
          rank_id: string | null
          scopes: string[]
          status: string
          total_completed: number
          total_failed: number
          updated_at: string
          workflow_db_id: string | null
          workflow_id: string
        }
        Insert: {
          created_at?: string
          current_jobs?: number
          display_name: string
          domain: string
          id?: string
          is_busy?: boolean
          last_assigned_at?: string | null
          notes?: string | null
          rank_id?: string | null
          scopes?: string[]
          status?: string
          total_completed?: number
          total_failed?: number
          updated_at?: string
          workflow_db_id?: string | null
          workflow_id: string
        }
        Update: {
          created_at?: string
          current_jobs?: number
          display_name?: string
          domain?: string
          id?: string
          is_busy?: boolean
          last_assigned_at?: string | null
          notes?: string | null
          rank_id?: string | null
          scopes?: string[]
          status?: string
          total_completed?: number
          total_failed?: number
          updated_at?: string
          workflow_db_id?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aurora_workers_rank_id_fkey"
            columns: ["rank_id"]
            isOneToOne: false
            referencedRelation: "aurora_worker_ranks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aurora_workers_workflow_db_id_fkey"
            columns: ["workflow_db_id"]
            isOneToOne: false
            referencedRelation: "aurora_n8n_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_workforce_jobs: {
        Row: {
          attempts: number
          created_at: string
          domain: string
          error_message: string | null
          finished_at: string | null
          id: string
          lock_expires_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
          requested_by: string | null
          result: Json | null
          run_id: string | null
          scope: string
          started_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          domain: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          lock_expires_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          requested_by?: string | null
          result?: Json | null
          run_id?: string | null
          scope: string
          started_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          domain?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          lock_expires_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          requested_by?: string | null
          result?: Json | null
          run_id?: string | null
          scope?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "aurora_workforce_jobs_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "aurora_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aurora_workforce_jobs_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "aurora_workforce_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aurora_workforce_jobs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "aurora_n8n_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      aurora_workforce_requests: {
        Row: {
          architect_log_id: string | null
          brief: string | null
          built_workflow_db_id: string | null
          built_workflow_id: string | null
          created_at: string
          error: string | null
          id: string
          order_id: string | null
          required_capability: string
          service_type: string
          status: string
          updated_at: string
        }
        Insert: {
          architect_log_id?: string | null
          brief?: string | null
          built_workflow_db_id?: string | null
          built_workflow_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string | null
          required_capability: string
          service_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          architect_log_id?: string | null
          brief?: string | null
          built_workflow_db_id?: string | null
          built_workflow_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string | null
          required_capability?: string
          service_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aurora_workforce_requests_built_workflow_db_id_fkey"
            columns: ["built_workflow_db_id"]
            isOneToOne: false
            referencedRelation: "aurora_n8n_workflows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aurora_workforce_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "aurora_business_orders"
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
      compose_feedback: {
        Row: {
          created_at: string
          event: string
          generation_id: string
          id: string
          position_ms: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event: string
          generation_id: string
          id?: string
          position_ms?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          event?: string
          generation_id?: string
          id?: string
          position_ms?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compose_feedback_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "compose_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      compose_generations: {
        Row: {
          audio_url: string | null
          bpm: number | null
          created_at: string
          duration_sec: number | null
          genre: string | null
          id: string
          lyrics: string | null
          mood: string | null
          params: Json | null
          prompt: string
          seed: number | null
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          bpm?: number | null
          created_at?: string
          duration_sec?: number | null
          genre?: string | null
          id?: string
          lyrics?: string | null
          mood?: string | null
          params?: Json | null
          prompt: string
          seed?: number | null
          user_id: string
        }
        Update: {
          audio_url?: string | null
          bpm?: number | null
          created_at?: string
          duration_sec?: number | null
          genre?: string | null
          id?: string
          lyrics?: string | null
          mood?: string | null
          params?: Json | null
          prompt?: string
          seed?: number | null
          user_id?: string
        }
        Relationships: []
      }
      compose_taste_profile: {
        Row: {
          bpm_avg: number | null
          genre_weights: Json
          mood_weights: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          bpm_avg?: number | null
          genre_weights?: Json
          mood_weights?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          bpm_avg?: number | null
          genre_weights?: Json
          mood_weights?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cost_alerts: {
        Row: {
          cost_amount: number
          dismissed_at: string | null
          dismissed_by: string | null
          id: string
          level: string
          message: string
          ratio_pct: number
          revenue_amount: number
          triggered_at: string
        }
        Insert: {
          cost_amount?: number
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          level: string
          message: string
          ratio_pct?: number
          revenue_amount?: number
          triggered_at?: string
        }
        Update: {
          cost_amount?: number
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          level?: string
          message?: string
          ratio_pct?: number
          revenue_amount?: number
          triggered_at?: string
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
      marketing_campaigns: {
        Row: {
          campaign_type: string
          created_at: string
          created_by: string | null
          id: string
          metadata: Json | null
          name: string
          platforms: string[]
          schedule: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          name: string
          platforms?: string[]
          schedule?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          platforms?: string[]
          schedule?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_logs: {
        Row: {
          action: string
          api_payload: Json | null
          campaign_id: string | null
          created_at: string
          id: string
          media_urls: string[] | null
          next_action: string | null
          post_id: string | null
          published_urls: string[] | null
          response: Json | null
        }
        Insert: {
          action: string
          api_payload?: Json | null
          campaign_id?: string | null
          created_at?: string
          id?: string
          media_urls?: string[] | null
          next_action?: string | null
          post_id?: string | null
          published_urls?: string[] | null
          response?: Json | null
        }
        Update: {
          action?: string
          api_payload?: Json | null
          campaign_id?: string | null
          created_at?: string
          id?: string
          media_urls?: string[] | null
          next_action?: string | null
          post_id?: string | null
          published_urls?: string[] | null
          response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_logs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "marketing_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_posts: {
        Row: {
          ab_variant: string | null
          affiliate_links: Json | null
          campaign_id: string | null
          captions: Json | null
          content_text: string | null
          created_at: string
          engagement_metrics: Json | null
          id: string
          image_url: string | null
          music_url: string | null
          platforms: string[]
          published_at: string | null
          published_urls: Json | null
          scheduled_at: string | null
          status: string
          thumbnails: string[] | null
          titles: string[] | null
          video_url: string | null
        }
        Insert: {
          ab_variant?: string | null
          affiliate_links?: Json | null
          campaign_id?: string | null
          captions?: Json | null
          content_text?: string | null
          created_at?: string
          engagement_metrics?: Json | null
          id?: string
          image_url?: string | null
          music_url?: string | null
          platforms?: string[]
          published_at?: string | null
          published_urls?: Json | null
          scheduled_at?: string | null
          status?: string
          thumbnails?: string[] | null
          titles?: string[] | null
          video_url?: string | null
        }
        Update: {
          ab_variant?: string | null
          affiliate_links?: Json | null
          campaign_id?: string | null
          captions?: Json | null
          content_text?: string | null
          created_at?: string
          engagement_metrics?: Json | null
          id?: string
          image_url?: string | null
          music_url?: string | null
          platforms?: string[]
          published_at?: string | null
          published_urls?: Json | null
          scheduled_at?: string | null
          status?: string
          thumbnails?: string[] | null
          titles?: string[] | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
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
      monthly_cost_reports: {
        Row: {
          amount_eur: number
          category: string
          created_at: string
          id: string
          notes: string | null
          report_month: string
          service_name: string
          updated_at: string
          usage_metric: Json
        }
        Insert: {
          amount_eur?: number
          category: string
          created_at?: string
          id?: string
          notes?: string | null
          report_month: string
          service_name: string
          updated_at?: string
          usage_metric?: Json
        }
        Update: {
          amount_eur?: number
          category?: string
          created_at?: string
          id?: string
          notes?: string | null
          report_month?: string
          service_name?: string
          updated_at?: string
          usage_metric?: Json
        }
        Relationships: []
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
      paddle_transactions: {
        Row: {
          amount: number
          billed_at: string
          created_at: string
          currency: string
          environment: string
          id: string
          invoice_url: string | null
          paddle_customer_id: string | null
          paddle_subscription_id: string | null
          paddle_transaction_id: string
          plan: string | null
          price_id: string | null
          product_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          billed_at?: string
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          invoice_url?: string | null
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          paddle_transaction_id: string
          plan?: string | null
          price_id?: string | null
          product_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          billed_at?: string
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          invoice_url?: string | null
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          paddle_transaction_id?: string
          plan?: string | null
          price_id?: string | null
          product_id?: string | null
          status?: string
          user_id?: string | null
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
      payment_events: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          environment: string
          event_type: string
          id: string
          paddle_subscription_id: string | null
          paddle_transaction_id: string | null
          period_end: string | null
          plan: string | null
          reason: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          environment?: string
          event_type: string
          id?: string
          paddle_subscription_id?: string | null
          paddle_transaction_id?: string | null
          period_end?: string | null
          plan?: string | null
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          environment?: string
          event_type?: string
          id?: string
          paddle_subscription_id?: string | null
          paddle_transaction_id?: string | null
          period_end?: string | null
          plan?: string | null
          reason?: string | null
          user_id?: string | null
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
      podcast_assets: {
        Row: {
          audio_url: string
          created_at: string
          duration_sec: number | null
          id: string
          is_active: boolean
          kind: string
          lang: string | null
          last_used_at: string | null
          name: string
          play_count: number
          script: string | null
          voice_id: string | null
        }
        Insert: {
          audio_url: string
          created_at?: string
          duration_sec?: number | null
          id?: string
          is_active?: boolean
          kind: string
          lang?: string | null
          last_used_at?: string | null
          name: string
          play_count?: number
          script?: string | null
          voice_id?: string | null
        }
        Update: {
          audio_url?: string
          created_at?: string
          duration_sec?: number | null
          id?: string
          is_active?: boolean
          kind?: string
          lang?: string | null
          last_used_at?: string | null
          name?: string
          play_count?: number
          script?: string | null
          voice_id?: string | null
        }
        Relationships: []
      }
      podcast_automator_logs: {
        Row: {
          created_at: string
          episode_id: string | null
          id: string
          level: string
          message: string
          metadata: Json | null
          source: string | null
        }
        Insert: {
          created_at?: string
          episode_id?: string | null
          id?: string
          level: string
          message: string
          metadata?: Json | null
          source?: string | null
        }
        Update: {
          created_at?: string
          episode_id?: string | null
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "podcast_automator_logs_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_automator_settings: {
        Row: {
          ad_every_hours: number
          ad_voice: string
          auto_approve: boolean
          enabled: boolean
          id: number
          jingle_every_hours: number
          n8n_webhook_url: string | null
          notification_email: string | null
          saturday_slots: string[]
          updated_at: string
          voice_en: string
          voice_pl: string
        }
        Insert: {
          ad_every_hours?: number
          ad_voice?: string
          auto_approve?: boolean
          enabled?: boolean
          id?: number
          jingle_every_hours?: number
          n8n_webhook_url?: string | null
          notification_email?: string | null
          saturday_slots?: string[]
          updated_at?: string
          voice_en?: string
          voice_pl?: string
        }
        Update: {
          ad_every_hours?: number
          ad_voice?: string
          auto_approve?: boolean
          enabled?: boolean
          id?: number
          jingle_every_hours?: number
          n8n_webhook_url?: string | null
          notification_email?: string | null
          saturday_slots?: string[]
          updated_at?: string
          voice_en?: string
          voice_pl?: string
        }
        Relationships: []
      }
      podcast_episodes: {
        Row: {
          audio_url: string | null
          created_at: string
          created_by: string | null
          duration_sec: number | null
          error: string | null
          id: string
          lang: string
          manual_text: string | null
          post_id: string | null
          published_at: string | null
          retry_count: number
          schedule_slot: string | null
          scheduled_for: string | null
          script: string | null
          source: string
          status: string
          title: string
          updated_at: string
          voice_id: string | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          created_by?: string | null
          duration_sec?: number | null
          error?: string | null
          id?: string
          lang?: string
          manual_text?: string | null
          post_id?: string | null
          published_at?: string | null
          retry_count?: number
          schedule_slot?: string | null
          scheduled_for?: string | null
          script?: string | null
          source?: string
          status?: string
          title: string
          updated_at?: string
          voice_id?: string | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          created_by?: string | null
          duration_sec?: number | null
          error?: string | null
          id?: string
          lang?: string
          manual_text?: string | null
          post_id?: string | null
          published_at?: string | null
          retry_count?: number
          schedule_slot?: string | null
          scheduled_for?: string | null
          script?: string | null
          source?: string
          status?: string
          title?: string
          updated_at?: string
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "podcast_episodes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "seo_blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned_at: string | null
          banned_reason: string | null
          blog_newsletter_opt_out: boolean
          created_at: string
          display_name: string | null
          first_login_completed: boolean | null
          id: string
          is_banned: boolean
          role: string
          subscription_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          blog_newsletter_opt_out?: boolean
          created_at?: string
          display_name?: string | null
          first_login_completed?: boolean | null
          id?: string
          is_banned?: boolean
          role?: string
          subscription_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          blog_newsletter_opt_out?: boolean
          created_at?: string
          display_name?: string | null
          first_login_completed?: boolean | null
          id?: string
          is_banned?: boolean
          role?: string
          subscription_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      radio_announcements: {
        Row: {
          audio_url: string
          created_at: string
          id: string
          kind: string
          lang: string
          played_count: number
          post_id: string | null
          post_slug: string | null
          post_title: string | null
          scheduled_for: string
          script: string
          voice_id: string | null
        }
        Insert: {
          audio_url: string
          created_at?: string
          id?: string
          kind?: string
          lang?: string
          played_count?: number
          post_id?: string | null
          post_slug?: string | null
          post_title?: string | null
          scheduled_for?: string
          script: string
          voice_id?: string | null
        }
        Update: {
          audio_url?: string
          created_at?: string
          id?: string
          kind?: string
          lang?: string
          played_count?: number
          post_id?: string | null
          post_slug?: string | null
          post_title?: string | null
          scheduled_for?: string
          script?: string
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radio_announcements_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "seo_blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      radio_artist_blocks: {
        Row: {
          active: boolean
          artist: string
          blocks_per_rebuild: number
          created_at: string
          duration_minutes: number
          id: string
          notes: string | null
          spacing: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          artist: string
          blocks_per_rebuild?: number
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          spacing?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          artist?: string
          blocks_per_rebuild?: number
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          spacing?: string
          updated_at?: string
        }
        Relationships: []
      }
      radio_config: {
        Row: {
          announcements_enabled: boolean | null
          blog_announcements_enabled: boolean
          cooldown_artist_minutes: number
          cooldown_track_hours: number
          current_schedule_id: string | null
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
          announcements_enabled?: boolean | null
          blog_announcements_enabled?: boolean
          cooldown_artist_minutes?: number
          cooldown_track_hours?: number
          current_schedule_id?: string | null
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
          announcements_enabled?: boolean | null
          blog_announcements_enabled?: boolean
          cooldown_artist_minutes?: number
          cooldown_track_hours?: number
          current_schedule_id?: string | null
          end_time?: string | null
          id?: string
          is_active?: boolean
          mode?: string
          start_time?: string | null
          started_at?: string | null
          station_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "radio_config_current_schedule_id_fkey"
            columns: ["current_schedule_id"]
            isOneToOne: false
            referencedRelation: "radio_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      radio_day_profile: {
        Row: {
          day_of_week: number
          genre_tags: string[]
          label: string
          loop_fill_enabled: boolean
          updated_at: string
        }
        Insert: {
          day_of_week: number
          genre_tags?: string[]
          label?: string
          loop_fill_enabled?: boolean
          updated_at?: string
        }
        Update: {
          day_of_week?: number
          genre_tags?: string[]
          label?: string
          loop_fill_enabled?: boolean
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
      radio_program_slot: {
        Row: {
          created_at: string
          day_of_week: number
          hour: number
          id: string
          position: number
          track_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          hour: number
          id?: string
          position?: number
          track_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          hour?: number
          id?: string
          position?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "radio_program_slot_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      radio_schedule: {
        Row: {
          added_at: string
          custom_audio_url: string | null
          custom_duration: number
          custom_title: string | null
          id: string
          item_type: string
          lang: string | null
          played_at: string | null
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
          lang?: string | null
          played_at?: string | null
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
          lang?: string | null
          played_at?: string | null
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
          last_refreshed_at: string | null
          refresh_count: number | null
          refresh_interval_days: number | null
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
          last_refreshed_at?: string | null
          refresh_count?: number | null
          refresh_interval_days?: number | null
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
          last_refreshed_at?: string | null
          refresh_count?: number | null
          refresh_interval_days?: number | null
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
      soul_dreams: {
        Row: {
          created_at: string
          dream_text: string
          dreamed_at: string
          hypothesis: string | null
          id: string
          metadata: Json | null
          proposed_action: Json | null
          reviewed_at: string | null
          reviewer_user_id: string | null
          status: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          created_at?: string
          dream_text: string
          dreamed_at?: string
          hypothesis?: string | null
          id?: string
          metadata?: Json | null
          proposed_action?: Json | null
          reviewed_at?: string | null
          reviewer_user_id?: string | null
          status?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          created_at?: string
          dream_text?: string
          dreamed_at?: string
          hypothesis?: string | null
          id?: string
          metadata?: Json | null
          proposed_action?: Json | null
          reviewed_at?: string | null
          reviewer_user_id?: string | null
          status?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      soul_emotions: {
        Row: {
          context: Json | null
          created_at: string
          dominant_emotion: string
          emotions: Json
          energy: number | null
          id: string
          measured_at: string
          narrative: string | null
          tension: number | null
          valence: number | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          dominant_emotion: string
          emotions?: Json
          energy?: number | null
          id?: string
          measured_at?: string
          narrative?: string | null
          tension?: number | null
          valence?: number | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          dominant_emotion?: string
          emotions?: Json
          energy?: number | null
          id?: string
          measured_at?: string
          narrative?: string | null
          tension?: number | null
          valence?: number | null
        }
        Relationships: []
      }
      soul_journal: {
        Row: {
          audio_url: string | null
          content: string
          created_at: string
          entry_date: string
          entry_type: string
          id: string
          metadata: Json | null
          mood: string | null
        }
        Insert: {
          audio_url?: string | null
          content: string
          created_at?: string
          entry_date?: string
          entry_type?: string
          id?: string
          metadata?: Json | null
          mood?: string | null
        }
        Update: {
          audio_url?: string | null
          content?: string
          created_at?: string
          entry_date?: string
          entry_type?: string
          id?: string
          metadata?: Json | null
          mood?: string | null
        }
        Relationships: []
      }
      soul_world_knowledge: {
        Row: {
          content: string | null
          created_at: string
          embedding: string | null
          expires_at: string | null
          fetched_at: string
          id: string
          importance: number | null
          language: string | null
          metadata: Json | null
          sentiment: number | null
          source: string
          source_type: string
          source_url: string | null
          summary: string | null
          title: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          embedding?: string | null
          expires_at?: string | null
          fetched_at?: string
          id?: string
          importance?: number | null
          language?: string | null
          metadata?: Json | null
          sentiment?: number | null
          source: string
          source_type: string
          source_url?: string | null
          summary?: string | null
          title: string
        }
        Update: {
          content?: string | null
          created_at?: string
          embedding?: string | null
          expires_at?: string | null
          fetched_at?: string
          id?: string
          importance?: number | null
          language?: string | null
          metadata?: Json | null
          sentiment?: number | null
          source?: string
          source_type?: string
          source_url?: string | null
          summary?: string | null
          title?: string
        }
        Relationships: []
      }
      soul_world_sources: {
        Row: {
          config: Json | null
          created_at: string
          enabled: boolean
          fetch_interval_minutes: number | null
          id: string
          items_ingested_total: number | null
          last_error: string | null
          last_fetched_at: string | null
          last_status: string | null
          name: string
          source_type: string
          updated_at: string
          url_template: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          enabled?: boolean
          fetch_interval_minutes?: number | null
          id?: string
          items_ingested_total?: number | null
          last_error?: string | null
          last_fetched_at?: string | null
          last_status?: string | null
          name: string
          source_type: string
          updated_at?: string
          url_template: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          enabled?: boolean
          fetch_interval_minutes?: number | null
          id?: string
          items_ingested_total?: number | null
          last_error?: string | null
          last_fetched_at?: string | null
          last_status?: string | null
          name?: string
          source_type?: string
          updated_at?: string
          url_template?: string
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
          paddle_transaction_id: string | null
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
          paddle_transaction_id?: string | null
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
          paddle_transaction_id?: string | null
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
      aurora_niche_n8n_summary: {
        Row: {
          avg_duration_ms: number | null
          backlinks_created: number | null
          failed_30d: number | null
          last_run_at: string | null
          leads_captured: number | null
          niche_id: string | null
          niche_name: string | null
          niche_status: string | null
          runs_30d: number | null
          seo_pages_generated: number | null
          success_30d: number | null
        }
        Relationships: []
      }
      aurora_niche_performance: {
        Row: {
          age_days: number | null
          category: string | null
          clicks_7d: number | null
          cost_eur_7d: number | null
          ctr_7d: number | null
          leads_7d: number | null
          niche_id: string | null
          niche_name: string | null
          opportunity_score: number | null
          revenue_7d: number | null
          roi_7d: number | null
          status: string | null
          views_7d: number | null
        }
        Relationships: []
      }
      aurora_storage_client_usage: {
        Row: {
          client_company: string | null
          client_email: string | null
          client_user_id: string | null
          current_period_end: string | null
          effective_egress_cost_per_gb_eur: number | null
          egress_billing_enabled: boolean | null
          egress_cost_eur: number | null
          egress_used_gb: number | null
          estimated_cost_eur: number | null
          paddle_subscription_id: string | null
          plan_code: string | null
          plan_name: string | null
          plan_price_eur: number | null
          plan_storage_gb: number | null
          status: string | null
          storage_used_bytes: number | null
          storage_used_gb: number | null
          subscription_id: string | null
          usage_percent: number | null
        }
        Relationships: [
          {
            foreignKeyName: "aurora_storage_subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "aurora_storage_plans"
            referencedColumns: ["code"]
          },
        ]
      }
      aurora_storage_overview: {
        Row: {
          active_subscriptions: number | null
          mrr_eur: number | null
          total_bytes: number | null
          total_files: number | null
        }
        Relationships: []
      }
      aurora_workforce_overview: {
        Row: {
          active_jobs: number | null
          color_hex: string | null
          current_jobs: number | null
          display_name: string | null
          domain: string | null
          id: string | null
          is_busy: boolean | null
          max_concurrent_jobs: number | null
          rank_code: string | null
          rank_level: number | null
          rank_name: string | null
          scopes: string[] | null
          status: string | null
          total_completed: number | null
          total_failed: number | null
          workflow_id: string | null
        }
        Relationships: []
      }
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
      activate_boost_paid: {
        Args: {
          _amount?: number
          _package?: string
          _paddle_transaction_id?: string
          _track_id: string
          _user_id: string
        }
        Returns: Json
      }
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
      aurora_approve_intake_draft: {
        Args: { _draft_id: string }
        Returns: string
      }
      aurora_n8n_run_finalize: {
        Args: {
          _error?: string
          _output?: Json
          _run_id: string
          _status: string
        }
        Returns: Json
      }
      aurora_reject_intake_draft: {
        Args: { _draft_id: string; _reason: string }
        Returns: undefined
      }
      aurora_storage_fulfill_from_paddle: {
        Args: {
          _current_period_end: string
          _email: string
          _paddle_subscription_id: string
          _price_external_id: string
          _status: string
          _user_id: string
        }
        Returns: string
      }
      aurora_workforce_claim_job: {
        Args: { _lock_seconds?: number }
        Returns: Json
      }
      aurora_workforce_complete_job: {
        Args: {
          _error?: string
          _job_id: string
          _result?: Json
          _run_id?: string
          _success: boolean
        }
        Returns: Json
      }
      aurora_workforce_enqueue: {
        Args: {
          _max_attempts?: number
          _payload?: Json
          _priority?: number
          _scope: string
        }
        Returns: string
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
      dismiss_cost_alert: { Args: { _id: string }; Returns: Json }
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
      get_active_cost_alerts: {
        Args: never
        Returns: {
          cost_amount: number
          dismissed_at: string | null
          dismissed_by: string | null
          id: string
          level: string
          message: string
          ratio_pct: number
          revenue_amount: number
          triggered_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "cost_alerts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
      get_aurora_pulse: { Args: never; Returns: Json }
      get_break_even_status: { Args: never; Returns: Json }
      get_cost_report_summary: { Args: { _months?: number }; Returns: Json }
      get_my_likes_stats: { Args: never; Returns: Json }
      get_my_profile: {
        Args: never
        Returns: {
          avatar_url: string
          display_name: string
          first_login_completed: boolean
          role: string
          subscription_status: string
        }[]
      }
      get_my_profile_status: {
        Args: never
        Returns: {
          banned_at: string
          banned_reason: string
          blog_newsletter_opt_out: boolean
          is_banned: boolean
          role: string
          subscription_status: string
        }[]
      }
      get_pending_payouts: { Args: never; Returns: Json }
      get_random_tippable_track: {
        Args: never
        Returns: {
          owner_user_id: string
          track_id: string
        }[]
      }
      get_revenue_mtd: { Args: never; Returns: Json }
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
      is_verified_creator: { Args: { _user_id: string }; Returns: boolean }
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
      set_radio_current_schedule: {
        Args: { _schedule_id: string }
        Returns: undefined
      }
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
      trigger_cost_report: { Args: { _month?: string }; Returns: Json }
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
