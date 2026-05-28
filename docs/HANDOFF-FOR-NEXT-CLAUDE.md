# Handoff for the next Claude

This doc is the resume prompt for whoever picks the LEC CRM up next
(probably Papa's Claude, possibly a fresh session of mine, possibly
a Claude Code agent running from Papa's machine).

> **TL;DR**: The MVP is launch-ready and live at
> `https://crm.lifeenergycentre.in`. Everything in the immediate
> queue is either externally blocked (Razorpay KYC, Meta WABA
> approval, AWS root MFA) or "nice to have" hardening. There is no
> launch-blocker code work pending. If Papa wants the centre to
> start using it, you can. The Phase 2d queue at the bottom is for
> when there's time / inclination.

---

## 1. Where we are right now

- **Live deployment**: `https://crm.lifeenergycentre.in` (EC2 t3.small,
  `i-05b7646efee508b07`, Caddy + Next.js + PostgreSQL 17 in Docker).
- **Latest commit on `main`**: see `git log -1`. As of this handoff:
  Phase 2c (`bdd4c61` or later) is shipped.
- **Test suite**: 123 vitest cases passing across 9 suites
  (`npm test` from `/home/shahprateek/lec-crm`).
- **Live smoke**: 4 smoke scripts in `/tmp/`:
  - `smoke-phase1.sh` — 22 checks
  - `smoke-phase2a.sh` — 9 checks
  - `smoke-phase2b.sh` — 9 checks
  - `smoke-phase2c.sh` — ~16 checks
  All pass against prod (see HANDOVER §15-17 for what each covers).

## 2. What's live

| Surface | URL / path | Notes |
|---|---|---|
| Public homepage | `/` | Public, marketing |
| Public enquiry form | `/enquiry` | Lead capture, writes to Client |
| Staff sign-in | `/sign-in` | Now 2-step when user has TOTP enabled |
| Client portal | `/me` | Passwordless via WhatsApp OTP/magic-link |
| Client docs | `/me/documents` | Self-upload medical reports |
| Client sessions | `/me/sessions` | Read-only timeline |
| Client referrals | `/me/refer` | WhatsApp share + credits earned |
| Client messages | `/me/messages` | Read-only WhatsApp transcript |
| Coordinator inbox | `/inbox` | 7 tabs, snooze/resolve, keyboard shortcuts |
| Quality drill-down | `/quality/sessions/[id]` | QC notes + improvement scores |
| Cert verify | `/quality/healers/[id]` | Verify uploaded healer certs |
| Healer earnings | `/my-earnings` | Per-session, monthly/yearly/lifetime |
| Healer profile | `/me/profile` | Self-edit availability + cert uploads |
| **Settings — 2FA** | `/settings/security` | TOTP enroll/disable; **opt-in for now** |
| Audit log | `/settings/audit-log` | Admin-only, filterable |
| **Lead detail + soft-delete** | `/leads/[id]` | Admin "Danger zone" card |
| Crons | `/api/cron/*` | Bearer-token gated via CRON_SECRET |

## 3. Active crons on EC2

Run `crontab -l` as `ubuntu` to see. Three lines should be present:

1. **Postgres backup** — daily 21:00 UTC, `/opt/lec-crm/scripts/backup-pg.sh`
2. **DPDP reconciler** — daily 02:30 UTC, `curl /api/cron/reconcile-deleted-clients`
3. **Pre-session reminder** — every 10 min, `curl /api/cron/send-session-reminders`

Installer scripts (idempotent, safe to re-run):
- `scripts/install-backup-cron.sh`
- `scripts/install-reconciler-cron.sh`
- `scripts/install-reminder-cron.sh`

**Pre-req for all three**: `CRON_SECRET` must be set in `/opt/lec-crm/.env`.
If you're standing this up fresh, generate one:
```bash
echo "CRON_SECRET=$(openssl rand -base64 32)" >> /opt/lec-crm/.env
docker compose -f /opt/lec-crm/docker-compose.yml restart app
```

## 4. External blockers (no code work pending)

| Blocker | Status as of last commit | What unblocks |
|---|---|---|
| **Meta WABA display name approval** | Pending submission / waiting on Meta | Once approved, swap WhatsApp provider in `/settings/whatsapp` from `stub` to `meta` — stays in stub today so real customer phones don't get demo messages |
| **Razorpay KYC** | Pending — business verification documents required | Once approved, /me/credits flow can scaffold; today it's deferred. Code path exists (`@/lib/providers/...`), needs payment-link wiring |
| **AWS root MFA** | Recommended but not blocking | Hardens the AWS account; doesn't affect runtime |

## 5. Phase 2d queue — by priority + effort

Each item is self-contained (~30min–2h). None block launch. Pick whichever
matters most to whoever's at the keyboard.

### High value, low effort

1. **TOTP enforcement for admin roles** (~30 min)
   - Today: TOTP is opt-in. An admin without TOTP can still sign in.
   - Flip: in `src/lib/auth.ts` `authorize()`, after password check,
     if `user.role IN ("ADMIN", "SUPER_ADMIN")` AND `!user.totpEnabledAt`,
     throw a new `TotpEnrollmentRequiredError` that redirects to a
     "you must enroll first" landing page.
   - Edge case: first-time ADMIN sign-in needs a grace path so they
     can enroll. Two options: (a) generate a one-time enrollment link
     they can use without TOTP; (b) carve out an enrollment window
     by checking "was this user created in the last N hours". Pick (a).

2. **Soft-delete affordance on `/me/profile`** (~20 min)
   - The action exists (`src/app/me/actions.ts:requestAccountDeletionAction`)
     and the dashboard shows a basic "delete my account" disclosure.
     Add the same affordance to `/me/profile` so healers can self-delete.
   - Confirmation pattern: copy the typed-first-name approach from
     `/leads/[id]` Danger zone.

3. **Tighten Phase 2c follow-ups** (~30 min total)
   - Abandoned-enrollment TTL: nightly job clears `User.totpSecret`
     where `totpEnabledAt IS NULL AND updatedAt < now() - 24h`.
   - Polymorphic `AuditLog.actor`: add `actorType` + nullable
     `actorClientId` so client-portal downloads can be audited too
     (currently skipped — see HANDOVER §17 "Client-portal downloads
     don't write AuditLog entries").
   - S3-failure retry sweep: a separate cron that finds Documents
     with `status=FAILED` AND `storageKey` matching a real S3 object
     and re-deletes. Today the reconciler scrubs the row even if
     S3 delete fails, leaving orphan bytes.

### High value, medium effort

4. **Backup codes for TOTP** (~1 h)
   - Generate 10 single-use base32 codes at enrollment, AES-GCM
     encrypted same as the secret. Display ONCE. New table
     `UserBackupCode { id, userId, codeHash (SHA-256), usedAt? }`
     so a code can be consumed but the plaintext never persists.
   - Sign-in flow: TOTP step also accepts a backup code; on use,
     mark `usedAt`. Warn at 2 codes left.

5. **HealerPayout model** (~1.5 h)
   - Today `/my-earnings` shows what payroll *should* pay. Track
     actual paid-out:
     ```
     model HealerPayout {
       id           String   @id @default(cuid())
       healerId     String
       periodStart  DateTime
       periodEnd    DateTime
       grossAmount  Int       // INR
       deductions   Int       // INR, advances etc.
       netAmount    Int
       paidAt       DateTime?
       paymentRef   String?   // bank txn ref
       notes        String?
       createdAt    DateTime  @default(now())
     }
     ```
   - Admin UI: `/settings/payouts` (admin-only) to create payouts
     and mark them paid. Healer view: `/my-earnings` shows pending
     vs paid alongside the computed totals.

### Medium value, low effort

6. **Notification preferences** (~45 min)
   - Per-user opt-out for each NotificationKind. New model
     `NotificationPreference { userId, kind, enabled }`. Default
     all-on. Settings page at `/settings/notifications`.

7. **Daily email digest** (~1 h)
   - Cron at 08:00 IST that emails each staff user a summary of
     their unread notifications. Reuse the notification list query.
     Pick a transactional email provider (Resend / Postmark / AWS SES);
     wire to `/settings/whatsapp`-style admin config so Papa can
     swap credentials.

### Externally blocked (don't start until unblock)

8. **Task #7 (Razorpay credits + courses + 2-way `/me/messages`)** (large)
   - Mock-scaffold today; live wire when KYC clears.

## 6. Gotchas / things worth knowing

1. **`/me/*` server-rendered redirects via NEXT_REDIRECT template
   marker**, not HTTP status. Curl `-L` does NOT follow them. Smoke
   tests must grep for `NEXT_REDIRECT;replace;/me/sign-in` in the
   body. See `smoke-phase2b.sh` for the pattern.

2. **`auth.config.ts` path allowlist uses exact-segment matching**.
   `pathname === p || pathname.startsWith(p + "/")`. Adding a new
   `/api/*` route that should bypass NextAuth needs to be added to
   the allowlist explicitly. Don't loosen to `startsWith(p)` — it
   accidentally widens to e.g. `/api/metrics` matching `/api/me`.

3. **NextAuth `authorize()` returning `null` vs throwing**. `null`
   is "bad credentials, generic". A thrown `CredentialsSignin`
   subclass with a `code` property is how we signal a specific
   error (e.g. `totp_required`). The sign-in action reads `err.code`
   and surfaces it as `?error=...` to the page.

4. **Atomic claim before WhatsApp send** in the reminder cron. The
   send is the side effect with external state; the claim guarantees
   no two cron runs grab the same row. Don't reorder.

5. **Document model uses polymorphic FK + CHECK constraint**.
   `ownerUserId XOR ownerClientId` enforced in the migration SQL,
   not in Prisma. Any Document insert must pick exactly one side.

6. **Cron route auth fails closed**. If `CRON_SECRET` is unset in
   `.env`, the routes return 500. That's intentional. Don't add a
   fallback / default secret.

7. **AUTH_SECRET is a critical credential**. It encrypts both
   WhatsApp/Razorpay tokens (settings.ts) AND TOTP secrets (User
   row). Rotating it makes every encrypted value unrecoverable.
   When rotation is finally needed, build a re-encrypt job first.

8. **EC2 deploy script** is at `~/lec-crm/scripts/deploy-to-ec2.sh`
   (or `/tmp/deploy-to-ec2.sh` if you copied it). Roughly: git pull,
   `docker compose build app && docker compose up -d app`. Migrations
   run automatically inside the build (`npm run build` chain).

9. **Demo seed data is re-applied on every deploy**. Set
   `SKIP_SEED=true` in `.env` when Papa goes live with real
   customers so demo Asha Patel doesn't get re-created.

## 7. The pickup workflow for a new Claude

```
You are picking up the Life Energy Centre CRM. Read these in order:
  1. docs/HANDOFF-FOR-NEXT-CLAUDE.md  ← this file
  2. docs/HANDOVER.md                  ← full operator runbook
  3. docs/UX_ARCHITECTURE.md           ← architecture north star
  4. git log -10                       ← what's been touched lately

Then:
  - Verify deploy is healthy:  bash /tmp/smoke-phase1.sh && bash /tmp/smoke-phase2a.sh && bash /tmp/smoke-phase2b.sh && bash /tmp/smoke-phase2c.sh
  - Confirm test suite green:  npm test  (from /home/shahprateek/lec-crm)
  - Ask the user / Papa what to work on, OR pick from the
    Phase 2d queue in this doc.

When you're shipping changes:
  - TDD pure logic against in-memory fakes (pattern: see
    src/lib/reconciler.test.ts, reminders.test.ts, totp.test.ts).
  - Get an independent code-review agent on auth/security changes
    BEFORE deploy.
  - Smoke against prod after deploy. Don't trust "looks fine".
  - Update HANDOVER.md and this file when the surface area changes.
```

## 8. Where things live (cheat sheet)

- `src/lib/`        — pure / shared modules (auth, prisma, crypto,
                       totp, notify, reminders, earnings, reconciler,
                       uploads, settings, …)
- `src/app/(app)/`  — staff workspace (NextAuth-gated)
- `src/app/me/`     — client portal (ClientSession cookie auth)
- `src/app/api/`    — API routes
  - `auth/` — NextAuth handlers (don't touch)
  - `cron/` — Bearer-token gated
  - `me/`   — client-portal mirror routes
  - `webhook/` — Meta WhatsApp + Razorpay (HMAC gated)
  - `documents/` — staff document downloads
- `src/components/` — shared React (UI primitives, uploaders, bell, …)
- `prisma/`         — schema + migrations + seed + demo data
- `scripts/`        — operator scripts (deploy, install-*-cron, seed, …)
- `tests/`          — vitest scaffolds (most tests live next to the
                       source they cover, e.g. `src/lib/totp.test.ts`)
- `docs/`           — this doc, HANDOVER.md, UX_ARCHITECTURE.md

---

*Generated 2026-05-28 alongside Phase 2c. Update when the world
changes — this file's only useful if it's accurate.*
