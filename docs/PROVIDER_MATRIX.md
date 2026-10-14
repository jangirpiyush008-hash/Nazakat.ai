# Provider matrix — external APIs Nazakat needs

Status legend: **needed now** (blocks the next milestone) · **V1.1** · **V2** · **optional**.
No provider is "approved" until its *current* acceptable-use terms have been checked for this
exact use case (adult fictional companions, romance/flirty tone, no explicit content) and the
row below is filled in. Record the date you checked. Prices are deliberately not listed — get
current quotes; they change often.

| # | Capability | Recommended | Alternatives | When | Env vars | Terms checked | Approved use | Enabled |
|---|---|---|---|---|---|---|---|---|
| 1 | Database, auth, storage, RLS | **Supabase** (Postgres + pgvector + Storage + Edge Functions) | Neon + Clerk | needed now (M2) | `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` | — | — | no |
| 2 | Phone OTP SMS | Supabase Auth → **MSG91** via Send-SMS hook (India) | Twilio Verify, Textlocal, Vonage | needed now (M2) | configured in Supabase | — | — | no |
| 3 | Transactional email | **Resend** (as Supabase custom SMTP) | AWS SES, Postmark | needed now (M2) | `EMAIL_*` | — | — | no |
| 4 | Bot / abuse protection | **Cloudflare Turnstile** (native in Supabase Auth) + **Upstash Redis** rate limits | hCaptcha | needed now (M2) | `*_TURNSTILE_*`, `UPSTASH_*` | — | — | no |
| 5 | Chat LLM (streaming) | **Anthropic Claude** — Haiku-class for chat, Sonnet-class for harder turns | Google Gemini, OpenAI | needed now (M3) | `AI_CHAT_*` | — | — | no |
| 6 | Memory embeddings | **Voyage AI** multilingual embeddings → pgvector | OpenAI embeddings, Supabase built-in `gte-small` (English-weighted) | M3 | `EMBEDDINGS_*` | — | — | no |
| 7 | Input/output moderation | Chat LLM classifier pass + **OpenAI Moderation** endpoint | Google Perspective, Hive | M3–M4 | `AI_MODERATION_*` | — | — | no |
| 8 | Payments, subscriptions, UPI AutoPay | **Razorpay** (Subscriptions + UPI e-mandate, webhooks) | Cashfree, PhonePe PG | M5 — *only after written approval* | `PAYMENT_*` | — | — | no |
| 9 | Image generation | **fal.ai** (FLUX-class models) | Replicate, Google Imagen, OpenAI Images | V1.1 | `IMAGE_*` | — | — | no |
| 10 | Background jobs / queue | **Inngest** or Trigger.dev | Supabase Queues (pgmq) + cron | V1.1 | provider keys | — | — | no |
| 11 | TTS / STT (Indian languages) | **Sarvam AI** (Hindi/Hinglish + regional voices) | ElevenLabs, Google Cloud TTS | V2 | `VOICE_*` | — | — | no |
| 12 | Real-time voice calls | **LiveKit** + STT/LLM/TTS pipeline | ElevenLabs Conversational AI, OpenAI Realtime | V2 | `VOICE_*` | — | — | no |
| 13 | Short video | via fal.ai (Kling/Veo-class) | Runway | V2 | `VIDEO_*` | — | — | no |
| 14 | Product analytics (consent-gated) | **PostHog** (EU/US cloud or self-host) | Plausible (cookieless) | M7 | `NEXT_PUBLIC_POSTHOG_KEY` | — | — | no |
| 15 | Error tracking | **Sentry** (PII scrubbing on) | Highlight | M7 | `SENTRY_DSN` | — | — | no |
| 16 | Hosting | **Vercel** (web) + Supabase (DB/functions) | Railway, Fly | M1 | — | — | — | — |

## Media & model stack (what companion apps typically run)

Competitors don't publish their stacks. The common pattern is **open-weight models,
self-hosted on GPUs**, with per-character LoRAs for a consistent face, plus their own
moderation layer. Hosted APIs (fal, Replicate) are used to prototype. Model landscape
as of mid-2026; check for newer releases and confirm each license before commercial use.

| Need | Open-weight options | License note | Hosted shortcut |
|---|---|---|---|
| Realistic portraits | FLUX.1-dev + LoRAs, Qwen-Image, HiDream-I1, SDXL fine-tunes (RealVisXL, Juggernaut XL) | FLUX.1-dev needs a paid BFL commercial license; Qwen-Image is Apache 2.0; HiDream is MIT | fal.ai, Replicate |
| Anime style | Illustrious-XL / NoobAI fine-tunes, Pony-family SDXL | check each checkpoint's license | — |
| Same face every image | per-character LoRA, PuLID / InstantID, IP-Adapter, FLUX Kontext or Qwen-Image-Edit | — | fal LoRA training |
| Image → short clip ("Shorts") | Wan 2.2 (I2V), HunyuanVideo, LTX-Video | Wan 2.2 is Apache 2.0 | fal, Replicate |
| Voice (Hindi/Hinglish) | Sarvam Bulbul (API), ElevenLabs, open: Chatterbox / IndicF5 | — | — |
| Live calls | LiveKit Agents or Pipecat (STT → LLM → TTS) | — | — |
| Companion chat | Claude / Gemini for flirty-not-explicit; or self-hosted Qwen / Mistral with your own moderation | — | — |
| GPUs | RunPod, Modal, Lambda; ComfyUI workflows exposed as an API | — | — |

**Safety layer you own when self-hosting.** Self-hosting removes the provider's filter, so
this layer is not optional:
1. A tiered nudity classifier (e.g. NudeNet or Falconsai) on every output. Allow up to
   glamour, swimwear and lingerie; block explicit content.
2. An age-estimation / minor-feature check on every output. Block prompt terms like
   "teen", "schoolgirl", "petite + young" and anything minor-coded.
3. Blocking of real-person likeness: no face uploads of others, and face-match against
   known public figures.
4. Prompt pre-filtering, an "AI-generated" label plus metadata, and all media private by default.

## Notes that change decisions

- **India SMS needs DLT.** TRAI rules require registering your entity, sender ID and OTP
  template on a DLT portal before SMS will deliver. Start this early; it can take days.
  Email OTP works in the meantime.
- **Payments are the biggest approval risk.** Indian payment gateways often treat AI
  companion / "dating-like" products as high-risk. Describe the product accurately, get
  written approval, *then* set `FEATURE_PAYMENTS=true`. Recurring UPI needs the RBI e-mandate flow.
- **LLM terms vs. the "flirty" positioning.** Most mainstream model providers allow
  romance/companionship but prohibit sexually explicit content, and some require
  age-gating and AI disclosure. Keep the system prompt and output moderation inside that line.
- **Image generation and real people.** Block real-person likeness and minor-coded prompts
  before the provider call, and moderate the output after it. Keep generated media private
  by default.
- **Data processors.** Every provider here processes personal data. List them in the
  Privacy Policy and the DPDP processor register.
