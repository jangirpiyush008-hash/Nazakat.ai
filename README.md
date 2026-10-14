# Nazakat.ai

India-first AI companion web app: original fictional adult characters, Hinglish/Hindi/English
chat, user-controlled memory. "Nazakat" is a **working name**; trademark and domain are not cleared.

- Design handoff: [`design/README.md`](design/README.md)
- Decisions, route map and plan: [`docs/DECISIONS.md`](docs/DECISIONS.md)
- External APIs and approval status: [`docs/PROVIDER_MATRIX.md`](docs/PROVIDER_MATRIX.md)

## Local development

```bash
pnpm install
cp .env.example .env.local   # every feature stays disabled until its vars are set
pnpm dev
```

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm exec tsc --noEmit` | Typecheck |

## Structure

```
src/app/(public)/   marketing, explore, companion, pricing, legal, help pages
src/components/     UI primitives, character card, header/footer
src/config/         brand, feature flags, draft pricing
src/lib/            companion seed catalogue, legal page registry
design/             Claude Design handoff (reference only, not shipped)
docs/               decisions, provider matrix
```

## Status

Milestone 1 (public shell) is done. Auth, chat, payments and media are **not** implemented yet,
and the UI says so instead of faking them. See the plan in `docs/DECISIONS.md`.
