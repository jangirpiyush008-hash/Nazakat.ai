# Deploying (Railway)

Production URL (temporary): https://nazakatai-production.up.railway.app

Railway builds from `main` on GitHub automatically (`pnpm build`, then `pnpm start`; Next.js reads `PORT`).

## Railway → Service → Variables

`NEXT_PUBLIC_*` values are baked in at build time, so redeploy after changing them.

| Variable | Value | Needed for |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://nazakatai-production.up.railway.app` | sitemap, robots, links |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | everything |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key (`sb_publishable_…`) | sign-in |
| `SUPABASE_SERVICE_ROLE_KEY` | secret key (`sb_secret_…`), server-only | chat, metering, deletion requests |
| `AI_CHAT_API_KEY` | Anthropic API key | chat + memory |
| `AI_CHAT_MODEL` | `claude-opus-5-5` or `claude-haiku-5-5` | chat |
| `FREE_DAILY_MESSAGES` | `60` | free tier |
| `AUTH_PHONE_ENABLED` / `AUTH_GOOGLE_ENABLED` / `AUTH_DISCORD_ENABLED` | `true` once the provider is set up in Supabase | extra sign-in methods |

## Supabase → Authentication → URL Configuration

- Site URL: `https://nazakatai-production.up.railway.app`
- Redirect URLs: `https://nazakatai-production.up.railway.app/auth/callback`, `http://localhost:3001/auth/callback`

When you move to a custom domain, add its `/auth/callback` here and update `NEXT_PUBLIC_APP_URL`.

## Location ("Trending in <city>")

Railway doesn't add visitor-location headers, so the home page shows "Trending near you". Putting Cloudflare in front (or moving to Vercel) enables city names.

## Checks after each deploy

```bash
node --env-file=.env.local scripts/rls-check.ts
```
