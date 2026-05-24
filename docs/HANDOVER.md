# LEC CRM — Operator Handover

This is the runbook for the production deployment of the Life Energy Centre CRM
on AWS. Read top-to-bottom on first sit-down; revisit by section thereafter.

---

## 1. Infrastructure summary

| Asset | Value |
|---|---|
| AWS Account | `397068653443` (root: `support@lifeenergycenter.in`) |
| Region | `ap-south-1` (Mumbai) |
| EC2 Instance | `i-05b7646efee508b07` (t3.small, Ubuntu 24.04 LTS) |
| Public IP | `13.204.229.25` (Elastic IP, survives reboot) |
| Security group | `sg-036738d588fa82637` — open: 22 (SSH), 80 (HTTP), 443 (HTTPS) |
| SSH key | `~/.ssh/lec-aws.pem` on the deployer's WSL (ed25519, no passphrase) |
| S3 backup bucket | `s3://lec-crm-backups-397068653443` (versioned, 30d → Glacier IR) |
| IAM instance profile | `lec-crm-backup-profile` (gives EC2 access to write to the bucket only) |

---

## 2. SSH access

```bash
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25
```

User `ubuntu` is in the `docker` group, so all `docker compose` commands work
without sudo from within the instance. (The deploy scripts use sudo as belt-
and-braces in case the user hasn't logged out + back in since being added to
the group.)

App code lives at `/opt/lec-crm`. Compose, env, scripts are all there.

To add another operator's SSH access: append their public key to
`/home/ubuntu/.ssh/authorized_keys`. No AWS keypair change needed.

---

## 3. Deployment cycle

The app deploys via rsync from the developer's machine + a docker compose
rebuild. There's no CI/CD on the in-house server (yet) — pull-and-build is
done explicitly.

### To deploy a new version

From the developer's WSL:

```bash
cd ~/lec-crm
# Ensure changes are committed (good practice — not enforced)
git status
# Sync to the EC2 host
bash /tmp/deploy-to-ec2.sh
```

This will:
1. Rsync the working tree to `/opt/lec-crm`
2. Preserve `.env` (only generated if absent)
3. Run `docker compose up -d --build` — rebuilds the image with the new code,
   replaces the running container, runs DB migrations on boot.
4. Tail app logs for 30s to confirm successful boot.

A typical incremental redeploy takes ~3 min (just the changed npm + next layers
rebuild). First-time builds take ~10 min.

### To restart without rebuilding

```bash
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25
cd /opt/lec-crm
docker compose restart app
```

### To check status

```bash
docker compose ps                       # all containers
docker compose logs --tail=100 app      # app logs
docker compose logs --tail=100 db       # postgres logs
docker compose logs --tail=100 caddy    # reverse proxy + cert errors
```

### To rollback to a previous build

The images are tagged `lec-crm:latest`. To revert:
1. SSH in
2. `docker image ls` — find an older image SHA
3. `docker tag <sha> lec-crm:latest`
4. `docker compose up -d` — picks up the tagged image

A more robust approach (TODO) is to tag images by git SHA on each deploy.

---

## 4. Database operations

The Postgres 17 container exposes nothing externally — only the `app` container
reaches it over Docker's internal network. To get a psql prompt:

```bash
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25
cd /opt/lec-crm
docker compose exec db psql -U lec -d lec_crm
```

To run a one-off Prisma migration manually:
```bash
docker compose exec app npx prisma migrate deploy
```

---

## 5. Backups

Daily Postgres backup runs at **02:30 IST** via cron (`/etc/crontab` on the host).
- Output goes to `s3://lec-crm-backups-397068653443/daily/YYYY-MM-DD_HHMMSSZ.sql.gz`
- Log at `/var/log/lec-backup.log` (rotated weekly, 8 weeks retained)
- 30-day lifecycle to Glacier Instant Retrieval (~$0.005/GB/month — peanuts)
- 365-day expiration

### List recent backups
```bash
/opt/lec-crm/scripts/restore-pg.sh --list
```

### Take a one-off backup
```bash
/opt/lec-crm/scripts/backup-pg.sh
```

### Restore from a backup *(destructive!)*
```bash
# Restore latest:
/opt/lec-crm/scripts/restore-pg.sh --latest

# Restore specific:
/opt/lec-crm/scripts/restore-pg.sh daily/2026-05-17_213000Z.sql.gz
```

The restore prompts for `y` before overwriting. Always take a fresh backup
before restoring to a different point (so you can undo the undo).

---

## 6. Environment / secrets

Application secrets live in `/opt/lec-crm/.env` (mode 600, owned by `ubuntu`).
The deploy script generates strong random values on first deploy:
- `POSTGRES_PASSWORD` — 24-char base64
- `AUTH_SECRET` — 40-char base64 (used for NextAuth signing + AppSetting encryption)

**Important:** `AUTH_SECRET` rotation invalidates all encrypted `AppSetting`
values (WhatsApp tokens, Razorpay credentials). Admins would need to re-paste
those at `/settings/whatsapp` and `/settings/razorpay`. Sessions also reset.

Day-2 admin secrets (WhatsApp / Razorpay) are managed via the admin UI at
`/settings/whatsapp` and `/settings/razorpay`, encrypted at rest in the
`app_settings` Postgres table.

---

## 7. Domain + HTTPS

Currently the app serves over plain HTTP at `http://13.204.229.25`. To set up
a real domain:

1. In Hostinger DNS for `lifeenergycenter.in`:
   - Add an **A record**: `crm` → `13.204.229.25`, TTL 300
2. Wait ~5 min for DNS to propagate. Test: `dig crm.lifeenergycenter.in +short`
3. SSH to EC2, edit `/opt/lec-crm/.env`:
   ```env
   DOMAIN=crm.lifeenergycenter.in
   AUTH_URL=https://crm.lifeenergycenter.in
   ```
4. Restart Caddy: `docker compose restart caddy app`

Caddy auto-provisions a Let's Encrypt cert in <30s on first hit to the domain.
Renewal is automatic (30 days before expiry).

---

## 8. Cost ledger

| Item | Monthly (after credits) | Notes |
|---|---|---|
| EC2 t3.small | ~₹1,250 | 2 vCPU, 2GB RAM, 24×7 |
| 30GB EBS gp3 | ~₹200 | Root volume |
| Elastic IP | ₹0 | Free while attached |
| S3 backups | ~₹30 | ~1MB/day × 365d, mostly Glacier |
| Data transfer | ~₹50 | Inbound free, outbound minimal |
| **Total** | **~₹1,530/month** | Year 2 onward |

First 6 months covered by $200 free-tier credits. Set up a budget alert via
**AWS Budgets** for $30/month to get an email if anything misbehaves.

### To stop incurring cost (e.g. testing complete, deferring rollout)

```bash
# Stop the instance (compute halts, EBS storage continues at ~₹200/mo)
~/.local/bin/aws ec2 stop-instances --region ap-south-1 --instance-ids i-05b7646efee508b07

# Start again
~/.local/bin/aws ec2 start-instances --region ap-south-1 --instance-ids i-05b7646efee508b07
```

---

## 9. Common operations

### Add a new admin user (database side)
```bash
docker compose exec db psql -U lec -d lec_crm
-- inside psql:
INSERT INTO "User" (id, email, "passwordHash", name, role, active, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'newadmin@lec.app', '<bcrypt-hash>', 'New Admin', 'ADMIN', true, now(), now());
```
(To generate a bcrypt hash:
`docker compose exec app node -e "const b=require('bcryptjs');console.log(b.hashSync('newpassword',10))"`)

### Free up disk space if EBS fills up
```bash
docker system prune -af --volumes  # nukes stopped containers + dangling images
docker compose logs --tail=0       # discard rolled logs
df -h /
```

### Tail Caddy's TLS log
```bash
docker compose logs caddy 2>&1 | grep -E 'tls|cert|acme'
```

### Re-run seed (e.g. to reset demo data)
```bash
docker compose exec app npx tsx prisma/seed.ts
```

---

## 10. Disaster recovery

### Scenario: EC2 instance dies / disk corrupts
1. From a fresh dev machine with the SSH key: run
   `bash scripts/provision-ec2.sh` (in `scripts/tools/`) — creates a new EC2
2. Run `bash scripts/deploy-to-ec2.sh` — deploys fresh
3. `scripts/restore-pg.sh --latest` — restores most recent backup

Total downtime: ~30 min if you have the SSH key. If you lose the SSH key too,
add a temporary one via the EC2 console (Connect → EC2 Instance Connect).

### Scenario: someone deletes data accidentally
Restore from a backup taken before the incident:
```bash
scripts/restore-pg.sh --list           # find a pre-incident timestamp
scripts/restore-pg.sh daily/<that-one>.sql.gz
```

### Scenario: account compromise (root password leak)
1. Sign in as root, change password to a fresh strong one
2. Rotate all IAM access keys (Console → IAM → Users → each user → Deactivate old, create new)
3. Review CloudTrail (`/CloudTrail` console) for the last 90 days
4. If suspicion is high: rotate `AUTH_SECRET` in `.env` (will invalidate all WhatsApp/Razorpay creds in `app_settings`)

---

## 11. Where to find what

| What | Where |
|---|---|
| App source code | `~/lec-crm` on dev machine; `/opt/lec-crm` on EC2 |
| Docker config | `docker-compose.yml`, `Dockerfile`, `Caddyfile`, `docker/entrypoint.sh` |
| Env / secrets | `/opt/lec-crm/.env` (EC2 only; never commit) |
| Backup scripts | `scripts/backup-pg.sh`, `scripts/restore-pg.sh`, `scripts/install-backup-cron.sh` |
| Deploy script | `/tmp/deploy-to-ec2.sh` on dev machine |
| Prisma schema | `prisma/schema.prisma` |
| Seed data | `prisma/seed.ts`, `prisma/demo.ts` |
| AWS recon | `/tmp/aws-recon.sh` (dev machine) |
| App logs | `docker compose logs app` (on EC2) |
| Backup logs | `/var/log/lec-backup.log` (on EC2) |
| Cron schedule | `crontab -l` as ubuntu user (on EC2) |

---

## 12. Communications architecture (per dad's "centralized comms" ask)

Dad's spec asked for *"personal numbers should remain hidden, communication
logs stored, user/healer communicate ONLY through the CRM"*. The outcomes
he wants — privacy and auditability — are achieved by this layered model
**without** building a custom in-app chat or paying for masked proxy numbers:

### Layer 1 — Outbound automation (centre → client)
All system-generated messages flow from the **centre's WhatsApp Business
number**. Healers' and coordinators' personal numbers are never the sender.
Templates currently seeded:
- `lead_welcome`, `intro_session_invitation`, `demo_healing_offer`,
  `counseling_*`, `visit_*`, `payment_link`, `low_credits`,
  `healer_assignment`, `feedback_request`, `package_offer`,
  `course_promotion`, `dormant_reactivation`, `referral_thank_you`,
  `session_check_in_start`, `session_check_in_end`.

### Layer 2 — Inbound triage (client → centre)
Customers reply to the centre's number. The webhook at
`/api/webhook/whatsapp` stores each message on the matching `Client`'s
record (or creates an "unknown" entry if no phone match). Coordinators see
inbound messages in the WhatsApp tab of `/leads/[id]`.

### Layer 3 — Healer routing (centre → healer)
When a client message needs a healer's input, the coordinator either:
1. Replies directly with the healer's input (paraphrased) — log retained in CRM.
2. Pings the healer via the existing in-CRM stage transitions / notes,
   then relays the answer.

**At no point** does a healer message a client from their personal phone.
**At no point** does a client get a healer's personal number.

### What this means in practice
- Privacy: ✅ healer phone never exposed
- Audit: ✅ everything client-facing is in the WhatsApp message log
- Trade-off: ad-hoc human-to-human chat takes a coordinator hop. For a
  1500-leads-per-month operation with ~3-5 active healers, this is a
  *feature* (quality control + lead nurturing happen at the coordinator
  layer) rather than a bug.

### When to escalate to masked proxy numbers
If a healer files an explicit complaint that coordinator-triaged chat is
slowing them down operationally — *not* before — adopt **Exotel virtual
numbers** (~₹200-500/active relationship/month). Until then, the cost-benefit
isn't there. Document this decision in `docs/` so the trade-off is recorded.

---

## 13. Session check-in (replaces dad's "OTP at start AND end")

Dad's intent was anti-fraud — the centre wants proof that (a) sessions
actually happened, (b) duration claims are honest. **Modern UX choice**:
one-tap WhatsApp confirmation links instead of OTP codes, because reading
a 6-digit code aloud during a meditative healing session is unnecessary
friction.

### Flow
1. **Healer hits "Start a session"** at `/healing/start` → picks client.
2. CRM creates a `HealingSession` row with `startedAt = now`, generates a
   `startCheckInToken`, sends the client a WhatsApp template with a one-tap
   link `https://crm.lifeenergycentre.in/confirm/<token>`.
3. **Client taps the link** → `clientConfirmedStartAt` is recorded.
4. Healer carries out the session.
5. **Healer hits "Mark session ended"** on `/healing/in-progress/<id>` → an
   `endCheckInToken` is generated and a second confirmation link sent.
6. **Client taps the second link** → `clientConfirmedEndAt` recorded.
7. Healer hits "Log session details" → existing healing form (chakras,
   colours, notes, improvement score).

### Audit signal for /quality
- A healer-claimed start with no client confirmation within 5 min → flagged.
- A healer-claimed duration vs. client-confirmed duration that diverges by
  more than 10 min → flagged.
- Sessions without an end confirmation → flagged.

Until WhatsApp is live, the confirmation links open as normal URLs — the
in-progress page exposes a "test link" affordance for the operator.

---

## 14. Phase 1 wrap-up (May 2026) — what shipped

The doc design at `docs/UX_ARCHITECTURE.md` was reviewed by an
independent architecture-reviewer agent before any code, then split
into 1a/1b/1c sub-phases. All shipped on `main` and live on prod.

**Phase 1a — security + foundation:**
- WhatsApp webhook now verifies the `X-Hub-Signature-256` HMAC header
  (12 vitest cases on `src/lib/webhook-signing.ts`). The webhook
  fails closed when `WHATSAPP_APP_SECRET` is missing — admins paste
  it at `/settings/whatsapp` (encrypted at rest with AUTH_SECRET).
- New Prisma models: `Document` (polymorphic FK + CHECK constraint),
  `WhatsAppThread`, `QualityNote`, `Notification`, `AuditLog`,
  `ClientMagicLink`, `ClientSession` (both hash tokens). Single
  migration; back-relations resolve atomically.
- S3 uploads bucket `lec-crm-uploads-397068653443` with versioning,
  encryption, public-access-blocked, CORS for browser PUT, 365d→Glacier
  IR lifecycle. IAM extended on the EC2 instance role.
- `src/lib/uploads.ts` — presigned PUT/GET helpers, server-side
  validation, race-safe Document creation (cuid pre-computed), content-
  type re-verification at HeadObject time. 14 vitest cases on the
  pure validation/keygen layer + 10 cases on authz predicate.
- Healer cert file upload UI on `/me/profile`: 3-step browser dance
  (request → PUT → confirm) via `<CertFileUploader>`. XHR upload with
  progress; abort on unmount; retry on error.
- Role-aware landing — `landingForRole()` routes coordinators to
  `/inbox`, healers to `/my-schedule`, QC to `/quality`, admin to
  `/dashboard`. Public homepage redirects signed-in users.

**Phase 1b — clients online + coordinator inbox + QC drill-down:**
- Passwordless client portal at `/me`: hybrid OTP + magic-link
  delivered in one `client_magic_link` WhatsApp template. SHA-256-
  hashed tokens. Sliding-renewal 30-day session in a separate
  `lec_me_session` cookie. `requireClient()` gates `/me` routes via
  a dedicated cookie path (NextAuth handles staff at `/sign-in`).
- 28 vitest cases on the auth library covering: token shape, race-
  safe consume, OTP lockout after 5 wrong tries, sliding renewal,
  revoke-single + revoke-all.
- `/me/sign-in` two-phase (phone → OTP) with opaque responses (no
  enumeration). `/me/auth/[token]` consumes the magic link.
- `/me` dashboard with next-session, credit balance, referrals teaser,
  sign-out / sign-out-all / delete-account (DPDP soft-delete).
- Coordinator `/inbox` MVP — tabbed thread list (Open / Mine / Waiting /
  Snoozed / Escalated / Resolved / Unknown), per-client detail with
  assign / snooze (5 presets) / escalate / resolve, reply panel
  (free-text inside 24h customer-care window, templates always),
  unknown-sender attach affordance. Audit-log entry on every thread
  view (`WHATSAPP_THREAD_OPENED`).
- `/quality/sessions/[id]` per-session audit drill-down — improvement
  score / duration / confirmation-skew at-a-glance, chakra readings,
  client feedback, prior notes timeline, append-only new-note form
  (5-point smiley scale + escalate flag).
- `/quality/healers/[id]` scorecard — 30d sessions / avg improvement /
  missed-confirmation rate; certs panel with Verify / Unverify
  (writes `CERT_VERIFIED` audit entry).

**Phase 1c — connect the surfaces:**
- Healing form unification: `/leads/[id]/healing/new?inProgressSessionId=…`
  now UPDATES the existing session row created by `startSession()`
  instead of inserting a duplicate. Credit-ledger writes are
  idempotent (no double-deduct on re-save).
- `/me/sessions` — read-only timeline with improvement score + confirmation.
- `/me/refer` — share-friendly referral page with WhatsApp deep-link +
  copy-to-clipboard. Referee enquiry form attributes via `?ref=<clientId>`.
- `/me/messages` — chat-style read-only WhatsApp transcript.
- Inbox keyboard shortcuts (`j/k`, `Enter`/`l`, `g i`, `?`) as a
  power-user reward; visible buttons remain the primary affordance.

Mid-phase code-review agent caught and fixed before deploy:
B1 (placeholder storageKey race → cuid pre-compute), B3 (deleteDocument
unaudited → DOCUMENT_DELETED enum + audit), B5 (webhook idempotency →
upsert on providerMessageId), C1 (markUploadComplete now re-verifies
ContentType), C2 (touchThread race → upsert on clientId).

Test inventory: 65 passing across 5 vitest suites covering security-
critical paths (HMAC, hashed token consumption, OTP lockout, presigned
URL signing, authz predicates). UI / integration tests deliberately
deferred to Phase 2 (Playwright once the surfaces stabilise).

---

## 15. Phase 2a (May 2026) — audit log + notifications + reconciler

Closes three loops Phase 1 left open: the AuditLog had no reader, the
Notification model was unused, and `Client.deletedAt` had no cleanup.

What shipped
- **Admin audit-log viewer** at `/settings/audit-log` (admin-only).
  Filters by action, actor, target type, and date range. URL-encoded
  so any view is bookmarkable. 50 entries per page.
- **In-app notification bell** in the staff layout (desktop sidebar +
  mobile header). Shows the unread count badge and a popover with the
  10 most recent. Auto-refreshes on window focus + every 60s when the
  tab is visible.
- **Three `notify()` sources wired:**
  - new inbound WhatsApp → thread assignee (or client's coordinator)
  - QC writes a `needsHealerAttention` or `escalated` note → healer
  - certification verified → healer
- **DPDP tombstone reconciler** at `/api/cron/reconcile-deleted-clients`.
  Policy: **anonymize in place** after 30 days — we do NOT hard-delete
  the row (HealingSession.client has `onDelete: Cascade`, so deletion
  would wipe healer revenue history). Identity fields go to nulls;
  name becomes "Deleted Client #…"; phone becomes `deleted-<id>` so
  the `@unique` constraint survives. Associated medical reports / photos
  ARE hard-removed from S3 (the DPDP-sensitive bytes). Document rows
  are kept but marked `FAILED` with a sentinel `storageKey` so any
  cached presigned URL cannot resurrect the file.
- One `CLIENT_HARD_DELETED` audit row written per anonymized client,
  attributed to the first SUPER_ADMIN (cron has no session).

Run the reconciler cron on EC2 (one-time, idempotent):
```
ssh ubuntu@13.204.229.25
cd /opt/lec-crm
sudo bash scripts/install-reconciler-cron.sh
```
Installs a crontab entry at 02:30 UTC (08:00 IST) daily that calls
the local endpoint with `CRON_SECRET` from `/opt/lec-crm/.env`.
**Pre-req:** set `CRON_SECRET=<random>` in `.env` first if not present.

To verify manually:
```
set -a; . /opt/lec-crm/.env; set +a
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  http://127.0.0.1:3000/api/cron/reconcile-deleted-clients | jq .
```

Tests: 65 → 78 vitest cases (added 13 reconciler tests covering
candidate selection, idempotent skip on already-anonymized rows,
S3-failure handling, per-client error isolation, limit respect).

---

## 16. Phase 2b (May 2026) — /me/documents + healer earnings + reminder cron

Three more loops closed. Builds on the cron + uploads + notify infra
shipped in Phase 1a/2a.

What shipped
- **Pre-session WhatsApp reminder cron** at `/api/cron/send-session-reminders`.
  Runs every 10 minutes from EC2 crond + Vercel cron. Finds
  `HealingSession`s where `date IN [now+55m, now+65m)` and
  `reminderSentAt IS NULL`. Atomic claim via conditional `updateMany`
  so concurrent runs can't double-send. WhatsApp template
  `healing_reminder_1h` (added to seed). On send: marks
  `reminderSentAt`, creates a SESSION_REMINDER_1H notification for
  the healer. On send failure: rolls the claim back so the next run
  retries. Batches up to 200×5 = 1000 sessions per pass; warns
  loudly if it hits the cap.
- **`/me/documents`** (client portal). Clients upload medical reports
  via a new `<MedicalReportUploader />` (mirrors the cert uploader's
  3-step browser dance). Lists their uploaded reports with view +
  delete. Owner-scoped: a client can never see another client's row.
  - Downloads via new `/api/me/documents/[id]` route (mirrors the
    staff `/api/documents/[id]` but uses `requireClient()`).
  - Returns 404 (not 403) on cross-client probes — no existence leak.
- **`/my-earnings`** (healer page). Read-only view of completed
  sessions × `HealerProfile.{perSessionCharge, revenueSharePercent,
  acceptsDemoFree}`. Buckets: this month / last month / this year /
  last year (auto-hides) / lifetime. Per-session table for the last 30.
  Pure formula in `src/lib/earnings.ts` so payroll exports (future)
  will agree with what the healer sees.

Schema
- `HealingSession.reminderSentAt TIMESTAMP(3)` + partial index
  `WHERE reminderSentAt IS NULL` (covers the cron's hot query).

Auth
- `auth.config.ts` allowlist tightened to exact-segment matching
  (`/api/me` no longer accidentally lets `/api/metrics` through).

Run the reminder cron on EC2 (one-time, idempotent):
```
ssh ubuntu@13.204.229.25
sudo bash /opt/lec-crm/scripts/install-reminder-cron.sh
```
Same `CRON_SECRET` as the reconciler. Crontab entry runs every
10 minutes; reads the secret from `/opt/lec-crm/.env` per-tick.

Tests: 78 → 105 vitest cases (added 10 reminder + 17 earnings tests
covering window math, formula edge cases, Jan-1 year-boundary,
free-demo handling, rounding, batch / batch-cap behaviour).

---

## 17. Known limitations & follow-ups (post-Phase 2b)

- **No CI/CD** — deploys are manual rsync + rebuild. Acceptable for one-server, single-developer ops.
- **Single AZ** — no automatic failover. If `ap-south-1a` has issues, we're down. Adding a multi-AZ RDS + auto-scaling would 3-4× the bill and is overkill for this scale.
- **Image not tagged by SHA** — rollback requires identifying old image SHA manually. Easy improvement when desired.
- **No staging environment** — changes deploy direct to prod. Fine while we have low traffic; add staging when traffic justifies.
- **TOTP 2FA for admin roles** — pulled out of Phase 2b for its own focused commit (Phase 2c). Modifies the staff sign-in critical path; deserves a separate security review.
- **WhatsApp permanent token via System Users** — see /settings/whatsapp; deferred until Meta's display name approval clears.
- **Soft-delete UI for clients not yet wired** — `Client.deletedAt` is supported by the reconciler but there's no user-facing "delete my account" button on /me/profile yet, and no admin "delete client" affordance on /leads/[id]. Add to Phase 2c.
- **Two-way `/me/messages`** — Phase 2c; today it's read-only.
- **Razorpay top-up + course enrolment** — Phase 2 (#7); KYC-blocked externally so the implementation will scaffold + mock until live.
- **No notification preferences / email digest** — staff get every relevant `notify()` write in the bell. A future "email me a daily digest" or per-kind opt-out lives in Phase 2c.
- **Reconciler S3-failure retry sweep** — if S3 is flaky the row is marked scrubbed but the orphan key remains. A separate sweep (Phase 2c) reconciles orphaned storage keys.
- **Client-portal downloads don't write AuditLog entries** — `/api/me/documents/[id]` skips the audit write because `AuditLog.actor` requires a User FK and the actor here is a Client. Phase 2c will polymorphize the actor column.
- **Healer payouts vs earnings** — `/my-earnings` shows what payroll *should* pay. Actual paid-out tracking ships in Phase 2c with a `HealerPayout` model.
- **Vercel deployment is still live** at `lec-crm.vercel.app`. Once dad's testing on `crm.lifeenergycentre.in` is settled, decommission Vercel.
