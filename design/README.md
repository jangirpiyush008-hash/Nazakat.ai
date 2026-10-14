# Handoff: Nazakat.ai — India-first AI companion web app

## Overview
Nazakat.ai (working name, formerly "Saanjh AI"; trademark/domain not cleared) is an India-first AI companion product: adults chat in Hinglish/Hindi/English with original fictional characters, with user-controlled memory, metered image/voice features paid in "Sparks" credits, and India-specific trust/legal scaffolding. This package contains the approved V1 visual system and screen set ("Rani & Marigold" theme) plus a set of in-app loading animations.

The full product/engineering brief (routes, DB schema, RLS, compliance register, milestones) is in `Product_and_Engineering_Brief.pdf`. **Prompt 2 in that PDF is the implementation brief for Claude Code** — follow it, with the brand renamed to Nazakat.ai and the visual system below replacing the PDF's "midnight plum" palette.

## About the Design Files
The `.dc.html` files are **design references created in HTML** (streaming design-component prototypes). They are not production code. Open them in a browser to inspect exact values; recreate the UI in the target codebase (Next.js App Router + React + TypeScript + Tailwind per the brief), using its own component and token conventions. `support.js` and `image-slot.js` are only the prototype runtime — do not ship them.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, copy and states are final for V1. Recreate pixel-close at 1440 (desktop) and 360 (mobile); 768 tablet follows the mobile layout with a 2-column Explore grid.

Exceptions:
- **Portraits are placeholders.** Every portrait frame is a cinematic gradient wash with a label; commissioned original art drops in. No real-person likenesses.
- Helplines, grievance contact, legal entity, effective dates, "chats tonight" counts, pricing and Spark costs are placeholders / data-driven. Never hard-code.

## Files
- `Nazakat.ai.dc.html` — all product screens (sections 01–08 below)
- `Nazakat Loaders.dc.html` — 10 in-app loading animations, progress bar, error state, context mockups
- `Product_and_Engineering_Brief.pdf` — routes, schema, RLS, legal pages, acceptance criteria
- `image-slot.js`, `support.js` — prototype runtime only

---

## Design Tokens

### Color — dark theme (default, "After dark")
| Token | Value | Use |
|---|---|---|
| bg | `#0A0709` | page background |
| surface | `#141015` | cards, rails, inputs |
| elevated | `#1E1720` | companion bubbles, chips (unselected), hover rows |
| border | `rgba(255,255,255,0.07)` | sparingly; prefer surface separation |
| rani (primary) | `#FF2E7E` | links, selected chip text/border, action buttons; **always white text on pink** |
| sunset | `#FF6A3D` | gradient end |
| saanjh gradient | `linear-gradient(135deg,#FF2E7E,#FF6A3D)` | primary CTAs, user bubbles, hero glow, active tab indicator, gradient text on one word per headline |
| marigold | `#FFB423` | Sparks ✦, "Most chosen", online dots, memory-saved toast, warnings in admin, gold check icons |
| wine | `#3B0D22` | selected chip fill, selected list rows, background washes |
| sindoor | `#E11D48` | HOT/trending badge, destructive text, end-call button only |
| text/primary | `#FFF4F7` | |
| text/secondary | `#B9A9B3` | |
| text/muted | `#7A6A74` | meta, labels |
| glass | `rgba(255,255,255,0.06)` fill + `backdrop-filter: blur(20px)` + `1px solid rgba(255,255,255,0.12)` | headers, chat input, secondary buttons, modals |
| memory accents | pink `#FF2E7E` (preference), gold `#FFB423` (place), violet `#A78BFA` (name) | 3px left border on memory cards |

Rule: pink + gold together cover ≤ 10–12% of any screen.

### Color — light theme (Settings, Legal, Help only)
bg `#FFF7F9` · surface `#FFFFFF` · text `#1A0E14` · secondary `#5E3F4F` · muted `#8A6A79` · primary `#E0186A` · selected chip `#FDE7EF` fill + `#E0186A` border/text · divider `#F3E3EA` · toggle off `#EBD3DD` · destructive `#B3122F` · draft badge `#FFF0D1` / `#8A4B12`.

### Typography
- Display: **Newsreader** (Google Fonts, opsz axis). Weights 300/400, italic 300/400. Hero 92px desktop / 44px mobile, line-height 1.0, letter-spacing −0.01em. Section 36–52px/300. Card name 19–22px/400. Italic for the emotional word; gradient-text on one word per headline only.
- UI: **Manrope** 400/500/600/700. Body 14–15px, meta 13px, label 11–12px uppercase tracked 0.14em 600. Nothing under 12px except 10–11px pills inside cards (keep ≥12 in production where possible).
- Devanagari: **Tiro Devanagari Hindi** for display (hero "Raat lambi hai."), **Mukta** 400/500/600 for UI.
- Flirty hooks on cards: Newsreader italic 12–13px.

### Spacing / shape / elevation
- 8px base grid (4/8/12/16/24/32/48/64). Desktop page gutter 64px; mobile 20px.
- Radius: cards 20px, buttons 14px, inputs 12–14px, chips/pills 999px, phone frame 36px, small thumbs 14–16px.
- Shadow: `0 20px 60px rgba(0,0,0,0.5)` (cards/modals); primary CTA glow `0 10px 40px rgba(255,46,126,0.4)`; focus ring `0 0 0 4px rgba(255,46,126,0.2)` + 1px `#FF2E7E` border.
- Ambient glows: blurred (60px) radial circles, pink 25–45% + gold 10–22%, behind heroes and chat headers, drifting 14s. Subtle film grain overlay on dark backgrounds (SVG feTurbulence, ~5% alpha).

### Motion
- Hover 200ms ease-out. Card hover: translateY(−6px), image scale 1.05, 2px pink ring + pink glow, "Chat now →" slides up.
- Primary CTA: slow shimmer sweep 3.2s loop. Hero collage: float ±10px, 7–9s per card, staggered.
- Chat: companion bubble slides in 200ms; typing = three 6px pink dots pulsing 1.2s with 0.2s stagger.
- `prefers-reduced-motion` and the "Reduce motion" setting: disable float, shimmer, glow drift; loaders fall back to static frame + text.

---

## Components (shared)

**Primary button** — h48 (h54–56 hero/mobile), padding 0 22–28px, radius 14, gradient fill, white 600 14–16px Manrope, glow shadow, optional shimmer. Disabled: `#1E1720` fill, `#7A6A74` text (used for "Checkout not yet enabled").
**Secondary / glass button** — same size, glass fill/border, text `#FFF4F7`.
**Chip** — h34–40, padding 0 14px, pill. Unselected: `#1E1720` fill, `#B9A9B3` text, no border. Selected: `#3B0D22` fill, `#FF2E7E` text + 1px border, 600. "Coming soon" languages: muted text + tiny "soon" suffix.
**Segmented gender toggle** — pill track `#141015` p4; active segment wine fill + pink text; options Women / Men / Anime. In public and app headers.
**Input** — h48–54, radius 12–14, `#141015` fill, no border at rest; focus = 1px pink border + 4px pink ring (OTP box also gets `0 0 24px rgba(255,46,126,.35)`).
**Toggle** — 46–48×28 track; on = gradient (dark) / `#E0186A` (light), knob white; off = `#1E1720` / `#EBD3DD`.
**Badges** — AI character pill: glass `rgba(255,255,255,.1)` blur 12, 11px 600 (frosted, top-left of every portrait). HOT: `#E11D48` white 10px 700. NEW: marigold with `#1A0E14` text. Sparks: `rgba(255,180,35,.12)` fill, `#FFB423` 700 text, "✦ 140".
**Character card** — 3:4, radius 20, full-bleed portrait; bottom overlay `linear-gradient(180deg,transparent 50%,rgba(10,7,9,.95) 92%)`; content bottom-left 12px: name (Newsreader 20–21) + "age · city" (12px secondary), one-line italic Hinglish hook, 2 tag chips (11px, `rgba(255,255,255,.1)`), marigold 6px online dot + "2.4K chats tonight" (11px). HOT/NEW badge top-right. Hover state as above.
**Portrait placeholder** — wrapper gradient e.g. `radial-gradient(ellipse at 70% 15%,rgba(255,106,61,.5),transparent 55%), linear-gradient(180deg,#2A1420,#0A0709)` (vary hue/position per character); monospace label. In production replace with `next/image` + same overlay.
**Memory card** — `#1E1720`, radius 14, 3px colored left border, 11px tracked category + date, 14px fact, Edit / Delete links.
**Toast (memory saved)** — marigold pill, `#1A0E14` 600 text, "✓ Memory saved: “likes cutting chai” · Edit · Forget".
**Voice-note row** — gradient 36px play circle, 3px-wide waveform bars (pink played → muted), duration.
**Locked media** — image blurred 18–22px under `rgba(10,7,9,.35–.45)`, 🔒 + gradient "Reveal · ✦ 8" button + "AI-generated · private".
**Phone frame (mobile mocks)** — 360 wide, radius 36, status bar "11:02 / 11:14".
**Mobile tab bar** — Explore · Chats · Create (raised 40px gradient circle) · Sparks (gold ✦) · Profile; active = 20×3 gradient underline.

---

## Screens

### 01 Marketing home — `/` (public; no spicy loaders here)
Desktop 1440: glass sticky header (logo "Nazakat." with pink period, gender toggle, Explore/Pricing/Help, "Log in", gradient "Create account" h42). Hero grid 1.05fr/1fr, padding 88px 64px 96px: H1 92px "Raat lambi hai. / *Baat* karte hain?" (Tiro Devanagari for Latin-script Hinglish line is acceptable; "Baat" gradient italic Newsreader 300), subline 20px secondary, CTAs "Meet your companion" (gradient h56, shimmer) + "✧ Create your companion" (glass), trust line 12px uppercase tracked "18+ · AI CHARACTERS · FREE TO START · PAY WITH UPI". Right: 620px-tall staggered collage of 4 floating portrait cards (210×290, 230×320, 210×290, 200×270 at offsets left 0/180/400/250, top 60/0/90/330) + a glass live-chat preview card (300w) bottom-left with Meera avatar, gold dot, AI pill, bubble "Toh ab chai ka waqt hai ☕ …tum aaoge?", typing dots.
Then: "Trending tonight in India 🔥" 6-col card grid; "Pick your vibe" 6 photo tiles h150 (Romantic, Flirty, Shayari, Late-night talks, Bollywood drama, Desi slow-burn); 3 steps as borderless strip with 72px gradient numerals; "Create your own companion" gradient-border banner with builder preview (face slot 140×186, two sliders Playful–Serious 35% / Shy–Bold 70%, voice chips); 3 Hinglish testimonials; pricing teaser + FAQ (one open: "What does Nazakat remember?"); footer on `#141015` with small-caps disclosure lines and all legal/trust links.
Mobile 360: same order; hero 44px; trending as horizontal scroll (190×254 cards); vibe tiles 3×2 at h90; footer disclosure.

### 02 Explore — `/explore`
Glass header with gender toggle + Sparks + avatar. Featured banner 360px tall, radius 24, "FEATURED TONIGHT" gold badge, name 56px, italic quote 22px, meta line, gradient CTA; portrait occupies the right ~58%, left 42% is a dark gradient scrim for text. Sticky glass filter bar (two rows: LANGUAGE chips incl. soon-states for தமிழ்/বাংলা/मराठी; VIBE + INTERESTS chips; Sort "Hot tonight ▾"). 5-column card grid (first card shown in hover state), 2 skeleton cards pulsing `#141015`. Below: empty state ("Koi nahi mila “tamil poet” ke liye", glass + gradient buttons) and network error state ("Network ne dhoka de diya", single gradient "Try again").

### 02 Character detail — `/companions/[slug]` (mobile shown)
Full-bleed portrait hero 520px fading to bg; glass back/⋯ circles; "AI character · fictional" pill; name 48px/300; "29 · Architect · Mumbai". Then: intro voice-note player ("Hear Meera say hello", 0:09), italic bio quote 18px, personality + language chips, Gallery strip (96×128 thumbs, "3 of 12 unlocked", locked = blurred + 🔒 + "✦ 8"), availability rows (Text free · Images ✦8 · Voice ✦4/min · Video coming soon), Boundaries card (gold label), Report/Share. Sticky bottom gradient CTA "Start chatting with Meera 💬" over a fade.

### 03 Onboarding (5 phones)
1. Sign-up: "Shuru karein?" 40px; phone input with 🇮🇳 +91 selector (changeable), focused; "Send code" gradient; "or" divider; glass "Continue with email"; terms line; log-in link.
2. OTP "Code aaya?": 6 boxes 62px `#141015`, active box pink border+ring+glow; "Resend in 0:42"; rate-limit card ("Too many attempts…"); session-expired card.
3. "Before you start": 4-segment gradient progress; two glass consent cards with gold ✓ circles (18+; AI/fictional acknowledgement); "Your choices" — Essential (Always on), Product analytics (off), Marketing (off); Continue; privacy link + "Draft pending counsel review".
4. "Kaise baat karte ho?": Language / Tone (Romantic, Playful, Flirty, Thoughtful, Direct) / Interests chips; Continue; "Skip for now".
5. "Kisse milna hai?": 2×2 portrait picker (selected = pink ring + gold ✓); "Start with Meera"; "Show me everyone".

### 03b App home — `/app`
240px left rail `#141015`: logo; Home (active `#1E1720`), Discover, Chats (pink count badge), Gallery, Create companion, My companions, Memory; gradient-bordered "✦ Plus" row with `−40%` sindoor badge; Settings, Help; Terms / Trust & safety. Main: glass top bar (gender toggle, Sparks, avatar); featured carousel 380px ("TONIGHT'S PICK", Rhea, 26, quote, meta, gradient "Chat with Rhea →" + glass "▶ Hear her", prev/next circles bottom-right, dot indicators); heading "*Explore* featured companions ›" + sort; one row: search field (260w pill) + category chips; 6-column grid incl. one promo tile ("Voice notes").

### 04 Chat — `/app/chat/[id]`
Desktop 1440×900, grid 300 / 1fr / 340:
- Left `#141015`: logo + Sparks, search, conversation rows (active `#1E1720`, avatar with gold ring), nav links.
- Centre: companion portrait blurred 40px at 35% opacity behind radial pink/orange washes; glass header (avatar, name, AI pill, gold dot, modalities; "📞 Call · ✦4/min" glass button; ⋯). Messages: system notice pill (disclosure), date divider, user bubbles gradient radius 20/20/4/20 15px, companion bubbles `#1E1720` radius 20/20/20/4, voice-note bubble, locked image message (260×200), typing bubble "Meera is typing" + dots, marigold memory toast. Composer: quick-reply glass chips in Hinglish; floating glass pill input (emoji · text · ✦ image request (gold) · 🎙 · 44px gradient send); footer "Free chat · 38 of 60 messages left tonight".
- Right `#141015`: tabs Profile / **Memory** / Settings; "What Nazakat remembers" 24px; memory cards with colored left accents; "Save new memories" toggle; Export / Mute / Block / Delete (sindoor).
Mobile 360×760: same elements stacked; header glass; quick replies; pill composer.
States panel: empty conversation ("Meera is waiting" + suggestion chips), safety refusal, crisis-sensitive response (helpline block is data-driven placeholder), offline / timeout / nightly limit / region-unavailable rows (gold or muted dots — never pink urgency), mobile tab bar.

### 05 Sparks / Plans / Checkout — `/app/wallet`, `/pricing`, checkout
Wallet (mobile): festival ribbon slot (marigold, 🪔 "Diwali Raat Offer ✨ 40% off Plus · ends Sun"); gold-gradient balance card (`#FFB423→#FF6A3D`, `#1A0E14` text, sheen sweep 6s, "✦ 140" 60px Newsreader, PURCHASED / PROMO (exp) / EARNED split, dark "Top up" button); "What Sparks pay for" rows; recent ledger rows (debit secondary, refund marigold, pending muted).
Plans (1040 desktop): headline "Plans, *bina* chhupe hue charges."; 4 cards — Free ₹0 (glass "Current plan"), Weekly trial ₹49/week (no auto-renew), **Nazakat Plus ₹299/month** (gradient border, pink glow, "MOST CHOSEN" gold badge, ~8% taller, `#1E1720` fill), Sparks top-up ₹99–₹999 (100/250/700/1,500 ✦). All purchase buttons are the disabled style "Checkout not yet enabled" until provider approval. "Before you pay, you always see…" block + FAQ.
Checkout (mobile): order summary with GST 18% line (₹253.39 + ₹45.61 = ₹299.00); Pay with: UPI first (selected wine row, generic G/Pe/Pt marks — no brand logos until approved), Card; renewal/cancel/refund bullets; consent checkbox; disabled "Payments not yet available". Payment states: verifying (gold spinner), verified (gold ✓), failed (sindoor !), refund requested.

### 06 Settings & Legal — light theme
Settings `/app/settings/*`: 280px white nav; "Language & theme" card: App language (English / हिन्दी), Companions speak, Theme (After dark / Light / System), **Spicy animations toggle (default ON)**, Reduce motion toggle. "Privacy & consent" card: Memory, Product analytics, Marketing toggles; Export your data / Delete account cards; DPDP note + links.
Legal `/legal/[slug]`: white header; 240px link list (16 pages); badges "Draft · pending counsel review", version/last-reviewed, language; title 48px; TODO monospace placeholders for entity, effective date, grievance contact (launch gate blocks until set); "In short" summary card; numbered sections.

### 07 Admin — `/admin`
Dark; 240px rail (Moderation shows pink count). KPI tiles ×5 (DAU, D7, Paid conversion "—", Chat p95, Open reports with gold SLA note). Moderation queue table (zebra `#1E1720`, status pills: Over SLA gold, Open muted, In review wine/pink). Provider health list (gold = degraded, dark = not configured). Launch gate checklist. Break-glass modal "Reveal reported message content?" with required reason field; confirm = solid `#FF2E7E`. Pink only for actions, gold for warnings.

---

## Loading animations (`Nazakat Loaders.dc.html`)
In-app only (after the 18+ gate); never on public pages. Each is a CSS-animated inline SVG (120×120 viewBox, ~2–4KB), 1.2–2s loop, pink glow `drop-shadow(0 0 14px rgba(255,46,126,.45))`, paired with an italic Newsreader Hinglish line. The prototype's logic class contains the full SVG + keyframe source for each — port as React components with CSS keyframes (or Lottie if preferred).

| # | Name | Loop | Where | Line | Spicy? |
|---|---|---|---|---|---|
| 01 | Fuzzy pink handcuffs | 2s | image gen, page loads | "Thoda intezaar… worth it hoga 😉" | yes |
| 02 | Lipstick kiss | 2s | image gen | "Tumhare liye kuch special ban raha hai 💋" | yes |
| 03 | Silk blindfold | 2s | image reveal | "Aankhein band karo… aur ab kholo." | yes |
| 04 | Heart lock & key | 2s | unlocks | "Unlocking something just for you ✦" | yes |
| 05 | Two wine glasses | 1.8s | voice connecting | "Cheers… Meera is picking up 📞" | yes |
| 06 | Ghungroo & gajra | 2s | signature page/chat loader | "Chhan chhan… aa rahi hoon." | yes |
| 07 | Candle & smoke (→ heart → initial) | 2s | thinking, safe default | "Ek pal… mood set ho raha hai." | no |
| 08 | Flirty dice ("Whisper · Ear" etc.) | 2s | long replies | "Aaj ka plan, dice decide karega 🎲" | yes |
| 09 | Feather | 2s | slow loads, **payment** | "Bas ek second…" (no line on payment) | no |
| 10 | Typing heartbeat (middle dot → heart) | 1.4s | chat thinking | "Soch rahi hoon… 💗" | no |

Rules: rotate randomly among eligible loaders per context; "Spicy animations" OFF → only 07/09/10; reduced motion → static mid-frame + text; payment always uses the feather with neutral copy. Error state: handcuffs snap open and drop, "Oops, kuch atak gaya. Try again?" + gradient Try again.
Image progress bar: 8px track `#1E1720`, gradient fill with sweeping sheen (`trail` 2s linear) and pink glow; gold percentage; stage copy at 0–25% "Setting the mood…", 25–60% "Lighting the candles…", 60–99% "Almost ready for you…", 100% "Ta-da 😘"; sub-line "✦ 8 reserved · refunded if it fails" + Cancel.

---

## Interactions & state (summary — full spec in the PDF)
- Auth: phone OTP (+91 default, international allowed) → email alternative; rate-limit and session-expired states.
- Eligibility/consent recorded server-side with version; analytics & marketing separate from essential.
- Chat: streaming reply, stop, retry, regenerate, copy, feedback, report; memory save events emit toast; memory CRUD in side panel; nightly free limit counter; offline queueing.
- Sparks: server-authoritative ledger; reservation → debit/refund for generation; promo balances with expiry; all purchase CTAs disabled until payment provider approval (feature flag).
- Modalities behind capability flags: voice/video show "Coming soon"/"Unavailable in your region".
- Settings: theme, reduce motion, spicy animations, memory, consent toggles, export, deletion.
- Admin: RBAC, audit-logged break-glass reveal with reason.

## Assets
- Fonts: Google Fonts — Newsreader, Manrope, Tiro Devanagari Hindi, Mukta.
- Icons: prototype uses glyphs/emoji as stand-ins (☕ 💬 📞 🎙 ✦ 🪔 🔒). Replace with a line icon set (e.g. Lucide) in production; keep ✦ as the Sparks glyph.
- Portraits: none supplied. Brief for artists: original fictional adults 25+, fully clothed (saree, lehenga, kurta, slip dress, blazer), warm rim light / neon night, shallow DOF, confident eye contact or half-smile over the shoulder; settings: rain-streaked windows, rooftop fairy lights, old Bombay balconies, Marine Drive, candle-lit cafés, Jaipur courtyards. Characters: Meera 29 Mumbai, Kabir 31 Delhi, Zoya 27 Hyderabad, Anaya 26 Bengaluru, Arjun 30 Amritsar, Ishani 28 Kolkata, Dev 32 Kochi, Rhea 26 Jaipur, Vikram 33 Bengaluru.
- Grain: inline SVG feTurbulence overlay (see page root in the prototype).
