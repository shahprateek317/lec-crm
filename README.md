# Life Energy Centre — Pranic Healing CRM

A calm, welcoming CRM for Pranic Healing at **Life Energy Centre**, New Town, Kolkata.
Built as a mobile-friendly Progressive Web App (PWA) with Next.js + PostgreSQL.

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind 4** + **shadcn/ui**
- **PostgreSQL 16** via local install (production target: Neon / Supabase)
- **Prisma 6** ORM
- **NextAuth.js v5** — email + password, role-based access
- **React Hook Form + Zod** — forms & validation
- **TanStack Query** — client-side data sync
- **Razorpay** — payments (UPI, cards, netbanking)
- **Meta WhatsApp Cloud API** — automated messaging

WhatsApp and payments each sit behind a `providers/` interface with a stub
implementation for local dev so real credentials can drop in later without
code changes.

## Local setup

Prerequisites: WSL Ubuntu 22.04, Node 20 (via `nvm`), Postgres 16.

```bash
# 1. Install toolchain (first time only)
nvm install 20
bash scripts/setup-postgres.sh      # installs Postgres, creates db + user

# 2. Install deps, migrate, seed
npm install
npm run db:migrate
npm run db:seed

# 3. Start dev server
npm run dev
```

Open http://localhost:3000.

## Seeded accounts (local dev only)

| Role         | Email                                    | Password   |
|--------------|------------------------------------------|------------|
| Admin        | admin@lifeenergycentre.local             | admin@lec1 |
| Coordinator  | coordinator@lifeenergycentre.local       | coord@lec1 |
| Counsellor   | counsellor@lifeenergycentre.local        | couns@lec1 |
| Healer       | healer@lifeenergycentre.local            | heal@lec1  |

## Scripts

| Command              | What it does                                          |
|----------------------|-------------------------------------------------------|
| `npm run dev`        | Start dev server on http://localhost:3000             |
| `npm run build`      | Production build                                      |
| `npm run start`      | Run production build                                  |
| `npm run db:migrate` | Apply Prisma migrations                               |
| `npm run db:seed`    | Insert staff, packages, templates, courses            |
| `npm run db:studio`  | Open Prisma Studio (graphical DB browser)             |
| `npm run db:reset`   | Drop DB, re-migrate, re-seed (destroys local data)    |
| `npm run format`     | Prettier                                              |

## Project layout

```
src/
  app/
    (app)/            Authenticated routes (dashboard, leads, etc.)
    api/              Route handlers (webhooks, lead capture)
    enquiry/          Public enquiry form
    sign-in/          Credentials sign-in page
  components/ui/      shadcn primitives
  lib/
    auth.ts           NextAuth config
    prisma.ts         Prisma singleton
    env.ts            Zod-validated env
    leads.ts          Lead creation & normalization
    i18n/             English strings (ready for bn/hi drop-in)
    providers/
      whatsapp.ts     Stub + Meta Cloud API
      payment.ts      Stub + Razorpay
prisma/
  schema.prisma       Data model
  seed.ts             Idempotent seed
scripts/
  setup-postgres.sh   One-time Postgres install (needs sudo)
  init-db.sql         DB + user creation SQL
```

## Integration credentials (when ready)

Edit `.env.local` (gitignored) and flip the providers from `stub` to real:

```
WHATSAPP_PROVIDER=meta
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...

RAZORPAY_PROVIDER=razorpay
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

No code changes required.

## Roadmap

- [x] Phase 1 — Scaffold, auth, theme, enquiry capture, dashboard shell
- [ ] Phase 2 — Lead pipeline board with drag-to-stage + assignment
- [ ] Phase 3 — Counselling scheduling + visit management + calendar
- [ ] Phase 4 — Healing sessions + credit system + ledger
- [ ] Phase 5 — Razorpay payment links + webhook
- [ ] Phase 6 — WhatsApp Cloud API wiring + template submission
- [ ] Phase 7 — Distant-healing group tracking + structured updates
- [ ] Phase 8 — Course catalog enrolment + prerequisite checks
- [ ] Phase 9 — Dashboard metrics, follow-up automation, reports
