# Writes src/lib/supabase/types.ts from a compact table spec mirroring the
# Supabase-generated types (regenerate with `supabase gen types` once the CLI is linked).
spec = {
 "admin_roles": [("created_at","string",True),("granted_by","string | null",True),("role",'Database["public"]["Enums"]["app_role"]',False),("updated_at","string",True),("user_id","string",False)],
 "audit_logs": [("action","string",False),("actor_id","string | null",True),("created_at","string",True),("id","string",True),("metadata","Json",True),("reason","string | null",True),("target_id","string | null",True),("target_type","string",False),("updated_at","string",True)],
 "companion_personas": [("companion_id","string",False),("created_at","string",True),("system_prompt","string",False),("updated_at","string",True),("version","number",True)],
 "companions": [("age","number",False),("badge","string | null",True),("bio","string",False),("city","string",False),("created_at","string",True),("gender",'Database["public"]["Enums"]["companion_gender"]',False),("hook","string",False),("id","string",True),("interests","string[]",True),("languages","string[]",True),("name","string",False),("occupation","string",False),("portrait_path","string | null",True),("quote","string",False),("slug","string",False),("sort_order","number",True),("status",'Database["public"]["Enums"]["companion_status"]',True),("traits","string[]",True),("updated_at","string",True),("vibes","string[]",True),("wash","string",False),("appearance","string | null",True),("voice_id","string | null",True)],
 "consent_records": [("consent_type",'Database["public"]["Enums"]["consent_type"]',False),("created_at","string",True),("granted","boolean",False),("id","string",True),("source","string",True),("updated_at","string",True),("user_id","string",False),("version","string",False)],
 "conversations": [("companion_id","string",False),("created_at","string",True),("id","string",True),("last_message_at","string | null",True),("title","string | null",True),("updated_at","string",True),("user_id","string",False)],
 "credit_ledger": [("amount","number",False),("bucket",'Database["public"]["Enums"]["ledger_bucket"]',False),("created_at","string",True),("expires_at","string | null",True),("id","string",True),("idempotency_key","string",False),("kind",'Database["public"]["Enums"]["ledger_kind"]',False),("reference","string | null",True),("updated_at","string",True),("user_id","string",False)],
 "daily_usage": [("created_at","string",True),("day","string",False),("messages_used","number",True),("updated_at","string",True),("user_id","string",False)],
 "memory_items": [("category",'Database["public"]["Enums"]["memory_category"]',True),("companion_id","string",False),("created_at","string",True),("fact","string",False),("id","string",True),("source_message_id","string | null",True),("updated_at","string",True),("user_id","string",False)],
 "messages": [("content","string",False),("conversation_id","string",False),("created_at","string",True),("feedback","number | null",True),("id","string",True),("input_tokens","number | null",True),("model","string | null",True),("moderation",'Database["public"]["Enums"]["moderation_status"]',True),("output_tokens","number | null",True),("provider","string | null",True),("provider_request_id","string | null",True),("role",'Database["public"]["Enums"]["message_role"]',False),("updated_at","string",True),("user_id","string",False),("media_id","string | null",True)],
 "profiles": [("age_confirmed_at","string | null",True),("chat_language","string",True),("created_at","string",True),("deletion_requested_at","string | null",True),("discreet_mode","boolean",True),("display_name","string | null",True),("id","string",False),("interest",'Database["public"]["Enums"]["companion_gender"]',True),("memory_enabled","boolean",True),("onboarded_at","string | null",True),("reduce_motion","boolean",True),("spicy_animations","boolean",True),("timezone","string",True),("ui_locale","string",True),("updated_at","string",True)],
 "media_assets": [("id","string",True),("user_id","string",False),("companion_id","string",False),("kind",'Database["public"]["Enums"]["media_kind"]',False),("storage_path","string",False),("content_type","string",False),("width","number | null",True),("height","number | null",True),("duration_s","number | null",True),("prompt","string",False),("ai_generated","boolean",True),("created_at","string",True),("updated_at","string",True)],
 "generation_jobs": [("id","string",True),("user_id","string",False),("companion_id","string",False),("conversation_id","string | null",True),("kind",'Database["public"]["Enums"]["media_kind"]',False),("prompt","string",False),("duration_s","number | null",True),("status",'Database["public"]["Enums"]["job_status"]',True),("sparks_cost","number",False),("provider","string",False),("model","string",False),("provider_request_id","string | null",True),("status_url","string | null",True),("response_url","string | null",True),("media_id","string | null",True),("error_code","string | null",True),("finished_at","string | null",True),("created_at","string",True),("updated_at","string",True)],
 "call_sessions": [("id","string",True),("user_id","string",False),("companion_id","string",False),("conversation_id","string | null",True),("status","string",True),("minutes_charged","number",True),("sparks_per_minute","number",False),("started_at","string",True),("ended_at","string | null",True),("created_at","string",True),("updated_at","string",True)],
 "reports": [("created_at","string",True),("details","string | null",True),("id","string",True),("reason","string",False),("reporter_id","string",False),("resolution","string | null",True),("reviewer_id","string | null",True),("status",'Database["public"]["Enums"]["report_status"]',True),("target_id","string",False),("target_type",'Database["public"]["Enums"]["report_target"]',False),("updated_at","string",True)],
}
enums = {
 "app_role": ["support","moderator","content_editor","finance","super_admin"],
 "companion_gender": ["women","men","anime"],
 "companion_status": ["draft","published","archived"],
 "consent_type": ["terms","privacy","age_18_plus","ai_disclosure","analytics","marketing"],
 "ledger_bucket": ["purchased","promo","earned"],
 "ledger_kind": ["grant","purchase","consumption","reservation","release","refund","adjustment"],
 "memory_category": ["preference","place","name","date","other"],
 "message_role": ["user","assistant","system"],
 "moderation_status": ["unchecked","passed","flagged","blocked"],
 "report_status": ["open","in_review","actioned","dismissed"],
 "report_target": ["companion","message","media","account"],
 "media_kind": ["image","video"],
 "job_status": ["queued","running","finishing","succeeded","failed","blocked","canceled"],
}
o=["// Generated from the live schema (project yukwzyhhqfpgzkodsbxq). Do not edit by hand.","export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];","","export type Database = {","  __InternalSupabase: { PostgrestVersion: \"14.18\" };","  public: {","    Tables: {"]
for t,cols in spec.items():
    o.append(f"      {t}: {{")
    o.append("        Row: { " + "; ".join(f"{c}: {ty}" for c,ty,_ in cols) + " };")
    o.append("        Insert: { " + "; ".join(f"{c}{'?' if opt else ''}: {ty}" for c,ty,opt in cols) + " };")
    o.append("        Update: { " + "; ".join(f"{c}?: {ty}" for c,ty,_ in cols) + " };")
    o.append("        Relationships: [];")
    o.append("      };")
o+=["    };","    Views: { [_ in never]: never };","    Functions: {",
"      complete_onboarding: { Args: { analytics: boolean; chat_language: string; consent_version: string; interest: Database[\"public\"][\"Enums\"][\"companion_gender\"]; marketing: boolean }; Returns: undefined };",
"      consume_daily_message: { Args: { daily_limit: number; uid: string }; Returns: number };",
"      spark_balance: { Args: never; Returns: number };",
"      spark_balance_of: { Args: { uid: string }; Returns: number };",
"      charge_sparks: { Args: { uid: string; amount: number; key: string; ref: string }; Returns: boolean };",
"      refund_sparks: { Args: { uid: string; amount: number; key: string; ref: string }; Returns: undefined };","    };","    Enums: {"]
for e,v in enums.items(): o.append(f"      {e}: " + " | ".join(f'\"{x}\"' for x in v) + ";")
o+=["    };","    CompositeTypes: { [_ in never]: never };","  };","};","",
"export type Tables<T extends keyof Database[\"public\"][\"Tables\"]> = Database[\"public\"][\"Tables\"][T][\"Row\"];",
"export type Enums<T extends keyof Database[\"public\"][\"Enums\"]> = Database[\"public\"][\"Enums\"][T];",""]
open("src/lib/supabase/types.ts","w").write("\n".join(o))
