// Generated from the live schema (project yukwzyhhqfpgzkodsbxq). Do not edit by hand.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      admin_roles: {
        Row: { created_at: string; granted_by: string | null; role: Database["public"]["Enums"]["app_role"]; updated_at: string; user_id: string };
        Insert: { created_at?: string; granted_by?: string | null; role: Database["public"]["Enums"]["app_role"]; updated_at?: string; user_id: string };
        Update: { created_at?: string; granted_by?: string | null; role?: Database["public"]["Enums"]["app_role"]; updated_at?: string; user_id?: string };
        Relationships: [];
      };
      audit_logs: {
        Row: { action: string; actor_id: string | null; created_at: string; id: string; metadata: Json; reason: string | null; target_id: string | null; target_type: string; updated_at: string };
        Insert: { action: string; actor_id?: string | null; created_at?: string; id?: string; metadata?: Json; reason?: string | null; target_id?: string | null; target_type: string; updated_at?: string };
        Update: { action?: string; actor_id?: string | null; created_at?: string; id?: string; metadata?: Json; reason?: string | null; target_id?: string | null; target_type?: string; updated_at?: string };
        Relationships: [];
      };
      companion_personas: {
        Row: { companion_id: string; created_at: string; system_prompt: string; updated_at: string; version: number };
        Insert: { companion_id: string; created_at?: string; system_prompt: string; updated_at?: string; version?: number };
        Update: { companion_id?: string; created_at?: string; system_prompt?: string; updated_at?: string; version?: number };
        Relationships: [];
      };
      companions: {
        Row: { age: number; badge: string | null; bio: string; city: string; created_at: string; gender: Database["public"]["Enums"]["companion_gender"]; hook: string; id: string; interests: string[]; languages: string[]; name: string; occupation: string; portrait_path: string | null; quote: string; slug: string; sort_order: number; status: Database["public"]["Enums"]["companion_status"]; traits: string[]; updated_at: string; vibes: string[]; wash: string };
        Insert: { age: number; badge?: string | null; bio: string; city: string; created_at?: string; gender: Database["public"]["Enums"]["companion_gender"]; hook: string; id?: string; interests?: string[]; languages?: string[]; name: string; occupation: string; portrait_path?: string | null; quote: string; slug: string; sort_order?: number; status?: Database["public"]["Enums"]["companion_status"]; traits?: string[]; updated_at?: string; vibes?: string[]; wash: string };
        Update: { age?: number; badge?: string | null; bio?: string; city?: string; created_at?: string; gender?: Database["public"]["Enums"]["companion_gender"]; hook?: string; id?: string; interests?: string[]; languages?: string[]; name?: string; occupation?: string; portrait_path?: string | null; quote?: string; slug?: string; sort_order?: number; status?: Database["public"]["Enums"]["companion_status"]; traits?: string[]; updated_at?: string; vibes?: string[]; wash?: string };
        Relationships: [];
      };
      consent_records: {
        Row: { consent_type: Database["public"]["Enums"]["consent_type"]; created_at: string; granted: boolean; id: string; source: string; updated_at: string; user_id: string; version: string };
        Insert: { consent_type: Database["public"]["Enums"]["consent_type"]; created_at?: string; granted: boolean; id?: string; source?: string; updated_at?: string; user_id: string; version: string };
        Update: { consent_type?: Database["public"]["Enums"]["consent_type"]; created_at?: string; granted?: boolean; id?: string; source?: string; updated_at?: string; user_id?: string; version?: string };
        Relationships: [];
      };
      conversations: {
        Row: { companion_id: string; created_at: string; id: string; last_message_at: string | null; title: string | null; updated_at: string; user_id: string };
        Insert: { companion_id: string; created_at?: string; id?: string; last_message_at?: string | null; title?: string | null; updated_at?: string; user_id: string };
        Update: { companion_id?: string; created_at?: string; id?: string; last_message_at?: string | null; title?: string | null; updated_at?: string; user_id?: string };
        Relationships: [];
      };
      credit_ledger: {
        Row: { amount: number; bucket: Database["public"]["Enums"]["ledger_bucket"]; created_at: string; expires_at: string | null; id: string; idempotency_key: string; kind: Database["public"]["Enums"]["ledger_kind"]; reference: string | null; updated_at: string; user_id: string };
        Insert: { amount: number; bucket: Database["public"]["Enums"]["ledger_bucket"]; created_at?: string; expires_at?: string | null; id?: string; idempotency_key: string; kind: Database["public"]["Enums"]["ledger_kind"]; reference?: string | null; updated_at?: string; user_id: string };
        Update: { amount?: number; bucket?: Database["public"]["Enums"]["ledger_bucket"]; created_at?: string; expires_at?: string | null; id?: string; idempotency_key?: string; kind?: Database["public"]["Enums"]["ledger_kind"]; reference?: string | null; updated_at?: string; user_id?: string };
        Relationships: [];
      };
      daily_usage: {
        Row: { created_at: string; day: string; messages_used: number; updated_at: string; user_id: string };
        Insert: { created_at?: string; day: string; messages_used?: number; updated_at?: string; user_id: string };
        Update: { created_at?: string; day?: string; messages_used?: number; updated_at?: string; user_id?: string };
        Relationships: [];
      };
      memory_items: {
        Row: { category: Database["public"]["Enums"]["memory_category"]; companion_id: string; created_at: string; fact: string; id: string; source_message_id: string | null; updated_at: string; user_id: string };
        Insert: { category?: Database["public"]["Enums"]["memory_category"]; companion_id: string; created_at?: string; fact: string; id?: string; source_message_id?: string | null; updated_at?: string; user_id: string };
        Update: { category?: Database["public"]["Enums"]["memory_category"]; companion_id?: string; created_at?: string; fact?: string; id?: string; source_message_id?: string | null; updated_at?: string; user_id?: string };
        Relationships: [];
      };
      messages: {
        Row: { content: string; conversation_id: string; created_at: string; feedback: number | null; id: string; input_tokens: number | null; model: string | null; moderation: Database["public"]["Enums"]["moderation_status"]; output_tokens: number | null; provider: string | null; provider_request_id: string | null; role: Database["public"]["Enums"]["message_role"]; updated_at: string; user_id: string };
        Insert: { content: string; conversation_id: string; created_at?: string; feedback?: number | null; id?: string; input_tokens?: number | null; model?: string | null; moderation?: Database["public"]["Enums"]["moderation_status"]; output_tokens?: number | null; provider?: string | null; provider_request_id?: string | null; role: Database["public"]["Enums"]["message_role"]; updated_at?: string; user_id: string };
        Update: { content?: string; conversation_id?: string; created_at?: string; feedback?: number | null; id?: string; input_tokens?: number | null; model?: string | null; moderation?: Database["public"]["Enums"]["moderation_status"]; output_tokens?: number | null; provider?: string | null; provider_request_id?: string | null; role?: Database["public"]["Enums"]["message_role"]; updated_at?: string; user_id?: string };
        Relationships: [];
      };
      profiles: {
        Row: { age_confirmed_at: string | null; chat_language: string; created_at: string; deletion_requested_at: string | null; discreet_mode: boolean; display_name: string | null; id: string; interest: Database["public"]["Enums"]["companion_gender"]; memory_enabled: boolean; onboarded_at: string | null; reduce_motion: boolean; spicy_animations: boolean; timezone: string; ui_locale: string; updated_at: string };
        Insert: { age_confirmed_at?: string | null; chat_language?: string; created_at?: string; deletion_requested_at?: string | null; discreet_mode?: boolean; display_name?: string | null; id: string; interest?: Database["public"]["Enums"]["companion_gender"]; memory_enabled?: boolean; onboarded_at?: string | null; reduce_motion?: boolean; spicy_animations?: boolean; timezone?: string; ui_locale?: string; updated_at?: string };
        Update: { age_confirmed_at?: string | null; chat_language?: string; created_at?: string; deletion_requested_at?: string | null; discreet_mode?: boolean; display_name?: string | null; id?: string; interest?: Database["public"]["Enums"]["companion_gender"]; memory_enabled?: boolean; onboarded_at?: string | null; reduce_motion?: boolean; spicy_animations?: boolean; timezone?: string; ui_locale?: string; updated_at?: string };
        Relationships: [];
      };
      reports: {
        Row: { created_at: string; details: string | null; id: string; reason: string; reporter_id: string; resolution: string | null; reviewer_id: string | null; status: Database["public"]["Enums"]["report_status"]; target_id: string; target_type: Database["public"]["Enums"]["report_target"]; updated_at: string };
        Insert: { created_at?: string; details?: string | null; id?: string; reason: string; reporter_id: string; resolution?: string | null; reviewer_id?: string | null; status?: Database["public"]["Enums"]["report_status"]; target_id: string; target_type: Database["public"]["Enums"]["report_target"]; updated_at?: string };
        Update: { created_at?: string; details?: string | null; id?: string; reason?: string; reporter_id?: string; resolution?: string | null; reviewer_id?: string | null; status?: Database["public"]["Enums"]["report_status"]; target_id?: string; target_type?: Database["public"]["Enums"]["report_target"]; updated_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      complete_onboarding: { Args: { analytics: boolean; chat_language: string; consent_version: string; interest: Database["public"]["Enums"]["companion_gender"]; marketing: boolean }; Returns: undefined };
      consume_daily_message: { Args: { daily_limit: number; uid: string }; Returns: number };
      spark_balance: { Args: never; Returns: number };
    };
    Enums: {
      app_role: "support" | "moderator" | "content_editor" | "finance" | "super_admin";
      companion_gender: "women" | "men" | "anime";
      companion_status: "draft" | "published" | "archived";
      consent_type: "terms" | "privacy" | "age_18_plus" | "ai_disclosure" | "analytics" | "marketing";
      ledger_bucket: "purchased" | "promo" | "earned";
      ledger_kind: "grant" | "purchase" | "consumption" | "reservation" | "release" | "refund" | "adjustment";
      memory_category: "preference" | "place" | "name" | "date" | "other";
      message_role: "user" | "assistant" | "system";
      moderation_status: "unchecked" | "passed" | "flagged" | "blocked";
      report_status: "open" | "in_review" | "actioned" | "dismissed";
      report_target: "companion" | "message" | "media" | "account";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
