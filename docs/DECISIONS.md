# Decisions & assumptions

Running log. Newest milestone at the bottom.

## Milestone 0 — repository & design audit (2026-10-14)

**Repository:** empty at start. Scaffolded Next.js 15 (App Router, React 19, TypeScript strict,
Tailwind v4, ESLint, Turbopack, pnpm). Added `zod`, `lucide-react`, `clsx`, `server-only`.

**Design source:** `design/` (Claude Design handoff, "Rani & Marigold"). `design/README.md`
and `Nazakat.ai.dc.html` take priority over the PDF brief's original "midnight plum" palette.
`support.js` / `image-slot.js` are prototype runtime only and are excluded from lint and the
production bundle.

### Screen → route map

| Design screen | Route | Status |
|---|---|---|
| 01 Marketing home (desktop + mobile) | `/` | M1 ✅ |
| 02 Explore (featured, filters, grid, empty, error, skeleton) | `/explore` | M1 ✅ |
| 02 Character detail | `/companions/[slug]` | M1 ✅ (no voice intro / gallery until providers exist) |
| 05 Plans | `/pricing` | M1 ✅ (purchase CTAs disabled) |
| 06 Legal (light theme) | `/legal/[slug]` × 16 | M1 ✅ (outline + TODO only) |
| — Help / Contact / How it works | `/help`, `/contact`, `/how-it-works` | M1 ✅ (minimal) |
| 03 Onboarding (sign-up, OTP, consent, prefs, picker) | `/signup`, `/login`, `/app/onboarding` | M2 (placeholder page now) |
| 03b App home | `/app` | M2 |
| 04 Chat workspace + states | `/app/chat/[id]` | M3 |
| 05 Wallet / checkout | `/app/wallet`, checkout | M5 |
| 06 Settings | `/app/settings/*` | M4 |
| 07 Admin | `/admin/*` | M4 |
| Loaders (10 animations) | `src/components/loaders/*` | M3 (in-app only) |

### Decisions

1. **Brand in one place.** `src/config/brand.ts`. "Nazakat" is a working name; trademark,
   company-name, domain and handle checks are still outstanding.
2. **Tokens in one place.** `src/app/globals.css` `@theme` block. Components use token
   utilities (`bg-surface`, `text-rani`, `bg-saanjh`…), not raw hex.
3. **Companion catalogue is in code for M1** (`src/lib/companions.ts`). It moves to the
   `companions` table in M3. Only public fields live there; persona prompts will be server-only.
4. **No fabricated social proof.** The design shows "2.4K chats tonight" counts and named
   testimonials (Rahul, Sneha, Faisal). Both are left out because the brief forbids fabricated
   presence and reviews. Counts render only when `chatsTonight` comes from real aggregate data.
   Testimonials need real, consented quotes.
5. **"Pay with UPI" left out of the hero trust line** until a payment provider is approved
   (brief: no payment claims or logos before integration).
6. **"Create your companion" is labelled Coming soon,** not a waitlist form. A waitlist needs
   a backend and consent capture (M2).
7. **Sign-up/login are honest placeholders** until Supabase auth is configured. They do not
   pretend to send OTPs.
8. **Modalities come from capability flags** (`src/config/features.ts`): a provider key AND
   `FEATURE_*=true` are both needed. Otherwise the UI shows "Coming soon".
9. **Pricing is draft display data** (`src/config/pricing.ts`). It is held in paise, shown
   incl. GST, and every purchase button is disabled. Server-owned prices replace it in M5.
10. **Legal pages hold outlines only.** Each has a draft badge, version and TODO company facts.
    No invented legal wording.
11. **Robots** disallow `/app`, `/admin`, `/api`, `/login`, `/signup`. The sitemap lists only
    public pages.

### Risks

- Payment-gateway approval for this category (see PROVIDER_MATRIX).
- DLT registration lead time for Indian SMS OTP.
- The "spicy" loader set (handcuffs, blindfold, lipstick) is suggestive. It is in-app only,
  shown after the 18+ gate, defaults to on, and can be switched off. Review it against app-store
  and payment-provider content rules before launch.
- Portrait art is not commissioned yet. Cards use lighting-wash placeholders.

### Execution plan

- **V1:** M1 public shell ✅ → M2 Supabase auth/onboarding/schema/RLS + cross-user tests →
  M3 chat adapter (streaming, stop/retry, memory CRUD) → M4 reports, privacy, settings, admin
  RBAC → M5 Sparks ledger + payment abstraction (disabled) → M7 SEO, analytics, hardening.
- **V1.1:** M6 image-generation jobs with reservation and refund, after provider approval.
- **V2:** voice, video, creator tools. Only after explicit provider, legal and cost sign-off.

## Milestone 1b — companion-app shell, India-first (2026-10-14)

Competitor review (Candy.ai, OurDream.ai): we adopted the product mechanics and left out the
explicit content, minor-coded categories ("Teen", "18-21", "Step-"), unverifiable social proof
("Trusted by 50M users") and inflated strike-through discounts. That last group falls under
India's 2023 dark-pattern guidelines.

Added:
1. **18+ age gate + "Aapko kisse milna hai?"** (`components/age-gate.tsx`). This is a soft
   self-declaration that sets `nz_age_ok` / `nz_interest` cookies. Real eligibility is recorded
   server-side at sign-up (M2). Explore defaults to the chosen category.
2. **App shell**: header + 240px sidebar on desktop, bottom tabs on mobile
   (Explore · Shorts · Create · Sparks · Profile). Items that need an account open the sign-up modal.
3. **Featured carousel** on Explore. It autoplays every 6s, pauses on hover/focus, and is off
   under reduced motion.
4. **Search** with Hinglish placeholder copy.
5. ~~**Shorts**~~ removed 2026-10-14 (no video yet). Was (`/shorts`): a Reels-style vertical feed. Shows stills labelled as such until
   image-to-video is approved. No fake like counts.
6. **Sign-up modal** (`?auth=signup|login`): mobile number first (+91 default, international
   allowed), email, Google. Controls stay disabled until Supabase is configured. `/signup` and
   `/login` redirect to the modal.
7. **Companion builder** (`/create`): Style → Look (age 25–45, Indian cities) → Personality →
   Language/Voice → Name. The draft is client-side only; saving needs an account.
8. **Pricing**: free daily chat, a ₹49 weekly pass that never auto-renews (sachet pricing),
   and Plus at ₹299/month, ₹799/quarter or ₹2,499/year. Savings are *computed* against monthly,
   never invented. Sparks packs run ₹99–₹999 for UPI-sized payments. Hinglish FAQ.

Known: the header toggle flashes "Women" for a frame before reading the saved preference
cookie. Fix this in M2 by reading the preference server-side once a session exists.

**Copy language (owner decision, 2026-10-14):** all UI copy, character hooks, quotes and bios
are in **English**. Hindi and Hinglish appear only as chat-language *options*. The design's
Hinglish headline "Raat lambi hai. Baat karte hain?" became "Long night? Let's talk."
- Sign-up modal also offers **Discord** (Supabase OAuth provider), disabled until auth is configured.

## Milestone 2–3 — accounts, onboarding, chat, memory (2026-10-14)

**Backend:** Supabase project `nazakat` (ref `yukwzyhhqfpgzkodsbxq`, Mumbai `ap-south-1`, free tier).
Migrations live in `supabase/migrations/` and are applied to the live project.
- RLS is on every table. Clients can never insert messages, ledger rows, usage or audit logs;
  the chat API writes those with the service role after validation and metering.
- `supabase/tests/rls_cross_user.sql` passed all 15 checks on 2026-10-14: user B can't read or delete
  A's conversations, messages, memories, ledger or profile, can't mint Sparks, can't insert
  messages and can't self-confirm age.
- Security advisor: one INFO (`companion_personas` has no policies). That is intentional, since persona
  prompts are server-only. Performance advisor: overlapping SELECT policies were merged.

**Auth:** email one-time code / magic link works now. Phone OTP, Google and Discord sit behind
`AUTH_*_ENABLED` flags and also need enabling in Supabase. Open-redirect-safe `next` handling is in
`lib/safe-next.ts`.

**Onboarding:** the `complete_onboarding()` RPC records versioned consents (18+, AI disclosure, terms,
privacy, plus optional analytics and marketing, both off by default) and stamps the profile. Users can't set
`age_confirmed_at` directly because of column-level grants.

**Chat:**
- `/api/chat` streams NDJSON events. Claude is the provider (`server/ai/anthropic.ts`).
- The model defaults to `claude-opus-5-5` at low effort, with `fallbacks: "default"` for safety declines.
  `AI_CHAT_MODEL` switches it; `claude-haiku-5-5` is about 40× cheaper per token.
- Prompt order: shared rules → persona (cached) → history → per-user context as a mid-conversation system message.
  Memories are labelled as facts, not instructions.
- Free tier: 60 messages a day, reset at IST midnight, counted atomically by `consume_daily_message()`.
- Stop keeps the partial reply. Retry re-answers without metering again. Errors map to offline, timeout,
  limit, refused and unavailable copy. Message content is never logged.

**Memory:** after each reply, 0–3 durable, non-sensitive facts are extracted. Health, sexuality, religion,
caste, politics, finances and third parties are excluded under DPDP data minimisation. The memory panel
lets users add, edit and forget facts, and memory can be switched off in Settings.

**Discreet mode:** the tab title reads "Notes" and the screen blurs on blur or tab switch.

**Not done yet:** Sparks purchases, image/voice, the admin console, the account-deletion worker (requests
are recorded and audit-logged), real portraits, and automated E2E tests.
