export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      account_backfill_status: {
        Row: {
          account_id: string
          created_at: string
          error_message: string | null
          id: string
          progress: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          progress?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          progress?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          account_name: string | null
          created_at: string
          id: string
          rule_set_id: string | null
          status: string
          stripe_account_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_name?: string | null
          created_at?: string
          id?: string
          rule_set_id?: string | null
          status?: string
          stripe_account_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_name?: string | null
          created_at?: string
          id?: string
          rule_set_id?: string | null
          status?: string
          stripe_account_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_accounts_rule_set"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_channels: {
        Row: {
          auto_pause: boolean | null
          created_at: string | null
          email_to: string | null
          slack_webhook_url: string | null
          stripe_account_id: string
        }
        Insert: {
          auto_pause?: boolean | null
          created_at?: string | null
          email_to?: string | null
          slack_webhook_url?: string | null
          stripe_account_id: string
        }
        Update: {
          auto_pause?: boolean | null
          created_at?: string | null
          email_to?: string | null
          slack_webhook_url?: string | null
          stripe_account_id?: string
        }
        Relationships: []
      }
      alert_feedback: {
        Row: {
          alert_id: number
          comment: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string | null
          verdict: string
        }
        Insert: {
          alert_id: number
          comment?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
          verdict: string
        }
        Update: {
          alert_id?: number
          comment?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_feedback_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_reads: {
        Row: {
          alert_id: number
          read_at: string
          user_id: string
        }
        Insert: {
          alert_id: number
          read_at?: string
          user_id: string
        }
        Update: {
          alert_id?: number
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_reads_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          alert_type: string
          auto_pause: boolean | null
          created_at: string | null
          delivery_status: Json
          event_id: number | null
          id: number
          message: string | null
          resolved: boolean | null
          risk_score: number | null
          severity: string
          stripe_account_id: string | null
          stripe_payout_id: string | null
        }
        Insert: {
          alert_type: string
          auto_pause?: boolean | null
          created_at?: string | null
          delivery_status?: Json
          event_id?: number | null
          id?: never
          message?: string | null
          resolved?: boolean | null
          risk_score?: number | null
          severity: string
          stripe_account_id?: string | null
          stripe_payout_id?: string | null
        }
        Update: {
          alert_type?: string
          auto_pause?: boolean | null
          created_at?: string | null
          delivery_status?: Json
          event_id?: number | null
          id?: never
          message?: string | null
          resolved?: boolean | null
          risk_score?: number | null
          severity?: string
          stripe_account_id?: string | null
          stripe_payout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "payout_events"
            referencedColumns: ["id"]
          },
        ]
      }
      backfill_status: {
        Row: {
          completed_at: string | null
          last_error: string | null
          last_event_id: string | null
          started_at: string
          status: string
          stripe_account_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          last_error?: string | null
          last_event_id?: string | null
          started_at?: string
          status?: string
          stripe_account_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          last_error?: string | null
          last_event_id?: string | null
          started_at?: string
          status?: string
          stripe_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "backfill_status_stripe_account_id_fkey"
            columns: ["stripe_account_id"]
            isOneToOne: true
            referencedRelation: "connected_accounts"
            referencedColumns: ["stripe_account_id"]
          },
        ]
      }
      connected_accounts: {
        Row: {
          access_token: string | null
          alerts_muted_until: string | null
          business_name: string | null
          created_at: string | null
          display_name: string | null
          id: string
          live: boolean | null
          metadata: Json | null
          paused_by: string | null
          paused_reason: string | null
          payouts_paused: boolean
          refresh_token: string | null
          rule_set: Json | null
          rule_set_id: string | null
          status: string | null
          stripe_account_id: string
          user_id: string | null
          webhook_secret: string | null
        }
        Insert: {
          access_token?: string | null
          alerts_muted_until?: string | null
          business_name?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          live?: boolean | null
          metadata?: Json | null
          paused_by?: string | null
          paused_reason?: string | null
          payouts_paused?: boolean
          refresh_token?: string | null
          rule_set?: Json | null
          rule_set_id?: string | null
          status?: string | null
          stripe_account_id: string
          user_id?: string | null
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string | null
          alerts_muted_until?: string | null
          business_name?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          live?: boolean | null
          metadata?: Json | null
          paused_by?: string | null
          paused_reason?: string | null
          payouts_paused?: boolean
          refresh_token?: string | null
          rule_set?: Json | null
          rule_set_id?: string | null
          status?: string | null
          stripe_account_id?: string
          user_id?: string | null
          webhook_secret?: string | null
        }
        Relationships: []
      }
      crondeck_leads: {
        Row: {
          created_at: string
          email: string
          id: string
          welcome_sent: boolean | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          welcome_sent?: boolean | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          welcome_sent?: boolean | null
        }
        Relationships: []
      }
      event_buffer: {
        Row: {
          id: string
          is_scrubbed: boolean | null
          payload: Json
          received_at: string | null
          stripe_account_id: string
          stripe_event_id: string
          type: string
        }
        Insert: {
          id?: string
          is_scrubbed?: boolean | null
          payload: Json
          received_at?: string | null
          stripe_account_id: string
          stripe_event_id: string
          type: string
        }
        Update: {
          id?: string
          is_scrubbed?: boolean | null
          payload?: Json
          received_at?: string | null
          stripe_account_id?: string
          stripe_event_id?: string
          type?: string
        }
        Relationships: []
      }
      failed_event_dispatch: {
        Row: {
          event_buffer_id: string | null
          id: string
          last_error: string
          next_attempt_at: string | null
          payload: Json
          received_at: string | null
          retry_count: number | null
          stripe_account_id: string | null
          stripe_event_id: string
          type: string | null
        }
        Insert: {
          event_buffer_id?: string | null
          id?: string
          last_error: string
          next_attempt_at?: string | null
          payload: Json
          received_at?: string | null
          retry_count?: number | null
          stripe_account_id?: string | null
          stripe_event_id: string
          type?: string | null
        }
        Update: {
          event_buffer_id?: string | null
          id?: string
          last_error?: string
          next_attempt_at?: string | null
          payload?: Json
          received_at?: string | null
          retry_count?: number | null
          stripe_account_id?: string | null
          stripe_event_id?: string
          type?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      guardian_events: {
        Row: {
          account: string
          amount: number | null
          created_at: string | null
          currency: string | null
          event_time: string
          flagged: boolean | null
          id: string
          raw: Json
          type: string
        }
        Insert: {
          account: string
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          event_time: string
          flagged?: boolean | null
          id: string
          raw: Json
          type: string
        }
        Update: {
          account?: string
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          event_time?: string
          flagged?: boolean | null
          id?: string
          raw?: Json
          type?: string
        }
        Relationships: []
      }
      guardian_leads: {
        Row: {
          created_at: string
          email: string
          id: string
          welcome_sent: boolean | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          welcome_sent?: boolean | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          welcome_sent?: boolean | null
        }
        Relationships: []
      }
      notary_leads: {
        Row: {
          created_at: string
          email: string
          id: string
          welcome_sent: boolean | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          welcome_sent?: boolean | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          welcome_sent?: boolean | null
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          alert_id: number
          attempt: number
          channel: string
          created_at: string
          error_msg: string | null
          id: number
          last_attempt_at: string | null
          max_attempts: number
          next_attempt_at: string
          status: string
        }
        Insert: {
          alert_id: number
          attempt?: number
          channel: string
          created_at?: string
          error_msg?: string | null
          id?: number
          last_attempt_at?: string | null
          max_attempts?: number
          next_attempt_at?: string
          status?: string
        }
        Update: {
          alert_id?: number
          attempt?: number
          channel?: string
          created_at?: string
          error_msg?: string | null
          id?: number
          last_attempt_at?: string | null
          max_attempts?: number
          next_attempt_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_events: {
        Row: {
          amount: number | null
          created_at: string | null
          currency: string | null
          event_data: Json
          id: number
          stripe_account_id: string
          stripe_event_id: string
          stripe_payout_id: string
          type: string
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          event_data: Json
          id?: never
          stripe_account_id: string
          stripe_event_id: string
          stripe_payout_id: string
          type: string
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          currency?: string | null
          event_data?: Json
          id?: never
          stripe_account_id?: string
          stripe_event_id?: string
          stripe_payout_id?: string
          type?: string
        }
        Relationships: []
      }
      pending_notifications: {
        Row: {
          alert_id: number | null
          enqueued_at: string | null
          id: number
        }
        Insert: {
          alert_id?: number | null
          enqueued_at?: string | null
          id?: never
        }
        Update: {
          alert_id?: number | null
          enqueued_at?: string | null
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "pending_notifications_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_event_buffer_ids: {
        Row: {
          event_buffer_id: number
          processed_at: string
        }
        Insert: {
          event_buffer_id: number
          processed_at?: string
        }
        Update: {
          event_buffer_id?: number
          processed_at?: string
        }
        Relationships: []
      }
      processed_events: {
        Row: {
          alerts_created: number | null
          id: string
          process_duration_ms: number | null
          processed_at: string
          stripe_account_id: string
          stripe_event_id: string
        }
        Insert: {
          alerts_created?: number | null
          id?: string
          process_duration_ms?: number | null
          processed_at?: string
          stripe_account_id: string
          stripe_event_id: string
        }
        Update: {
          alerts_created?: number | null
          id?: string
          process_duration_ms?: number | null
          processed_at?: string
          stripe_account_id?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          api_keys: Json | null
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
          theme: string | null
        }
        Insert: {
          api_keys?: Json | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          theme?: string | null
        }
        Update: {
          api_keys?: Json | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          theme?: string | null
        }
        Relationships: []
      }
      rule_sets: {
        Row: {
          config: Json
          created_at: string
          id: string
          name: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          email_notifications_enabled: boolean
          id: string
          notification_emails: string[] | null
          slack_notifications_enabled: boolean
          slack_webhook_url: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email_notifications_enabled?: boolean
          id?: string
          notification_emails?: string[] | null
          slack_notifications_enabled?: boolean
          slack_webhook_url?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email_notifications_enabled?: boolean
          id?: string
          notification_emails?: string[] | null
          slack_notifications_enabled?: boolean
          slack_webhook_url?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      stripe_accounts: {
        Row: {
          created_at: string
          encrypted_access_token: string | null
          encrypted_refresh_token: string | null
          id: string
          rule_set_id: string | null
          scope: string | null
          status: string
          stripe_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          id?: string
          rule_set_id?: string | null
          scope?: string | null
          status?: string
          stripe_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_access_token?: string | null
          encrypted_refresh_token?: string | null
          id?: string
          rule_set_id?: string | null
          scope?: string | null
          status?: string
          stripe_account_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_accounts_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          created_at: string | null
          email: string
          id: string
          message: string
          name: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          message: string
          name?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          message?: string
          name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      alerts_by_day: {
        Row: {
          alerts: number | null
          day: string | null
        }
        Relationships: []
      }
      alerts_rule_rank: {
        Row: {
          alert_type: string | null
          alerts: number | null
        }
        Relationships: []
      }
      avg_risk_score: {
        Row: {
          avg_risk: number | null
          day: string | null
        }
        Relationships: []
      }
      failed_charges_view: {
        Row: {
          id: string | null
          payload: Json | null
          received_at: string | null
          stripe_account_id: string | null
          stripe_event_id: string | null
          type: string | null
        }
        Insert: {
          id?: string | null
          payload?: Json | null
          received_at?: string | null
          stripe_account_id?: string | null
          stripe_event_id?: string | null
          type?: string | null
        }
        Update: {
          id?: string | null
          payload?: Json | null
          received_at?: string | null
          stripe_account_id?: string | null
          stripe_event_id?: string | null
          type?: string | null
        }
        Relationships: []
      }
      fp_rate_rule: {
        Row: {
          alert_type: string | null
          fp_count: number | null
          fp_rate: number | null
          total_alerts: number | null
        }
        Relationships: []
      }
      rule_fp_stats: {
        Row: {
          alert_type: string | null
          fp_count: number | null
          fp_rate: number | null
          total_alerts: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accounts_without_alerts: {
        Args: { since: string }
        Returns: {
          auto_pause: boolean | null
          created_at: string | null
          email_to: string | null
          slack_webhook_url: string | null
          stripe_account_id: string
        }[]
      }
      count_recent_failed_charges: {
        Args: { p_account_id: string; p_minutes?: number }
        Returns: number
      }
      enqueue_notification: {
        Args: { p_alert_id: number; p_channel: string; p_max_attempts?: number }
        Returns: undefined
      }
      fetch_notification_batch: {
        Args: { p_limit?: number }
        Returns: {
          alert_id: number
          attempt: number
          channel: string
          created_at: string
          error_msg: string | null
          id: number
          last_attempt_at: string | null
          max_attempts: number
          next_attempt_at: string
          status: string
        }[]
      }
      get_decrypted_stripe_tokens: {
        Args: { p_stripe_account_id: string; p_key_id: string }
        Returns: Database["public"]["CompositeTypes"]["decrypted_tokens"]
      }
      insert_alert_and_enqueue: {
        Args: {
          p_event_id: string
          p_rule_id: string
          p_user_id: string
          p_channels?: string[]
        }
        Returns: string
      }
      purge_old_events: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      scrub_event_buffer: {
        Args: { ttl_days: number }
        Returns: undefined
      }
      upsert_stripe_account: {
        Args: {
          p_user_id: string
          p_stripe_account_id: string
          p_scope: string
          p_refresh_token: string
          p_access_token: string
          p_key_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      decrypted_tokens: {
        refresh_token: string | null
        access_token: string | null
      }
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
