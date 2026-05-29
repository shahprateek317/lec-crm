# Handoff for the next Claude

You're picking up the **Life Energy Centre CRM** mid-stream. The
operator at the keyboard is **Papa (Subhash Shah)** — a yoga master
and the centre's founder, **not a software engineer**. The previous
Claude (a 1M-context Claude Opus 4.7 instance running on Papa's
son Prateek's machine) shipped Phases 1, 2a, 2b, and 2c. The CRM is
live in production at `https://crm.lifeenergycentre.in`.

**Default to plain language.** Don't make Papa parse stack traces or
infer from error codes. When you need a credential or a decision,
ask in one sentence with a concrete example of what you expect.

---

## 0. If Papa just wants to USE the CRM (no code changes)

Tell him:

> The CRM is already live at **https://crm.lifeenergycentre.in**.
> Sign in with the admin account — email `admin@lec.app`, password
> `demo1234` (we MUST change this password before real customers
> start using it). You can manage staff, leads, sessions, payments,
> WhatsApp templates, and view audit logs from there. You don't
> need a developer for day-to-day operations.

If he says "yes I just want to use it":
1. Walk him through changing the admin password (Settings → Staff
   accounts → click himself → reset password).
2. Walk him through Settings → WhatsApp Business to plug in real
   Meta credentials when his WABA approval clears.
3. Walk him through Settings → Razorpay when his KYC clears.
4. Then stop. You don't need to do anything else.

If he says "no, I (or Prateek) want you to fix / add / change
things" — proceed to §1.

---

## 1. Before you can change code, you need these from Papa

Ask for all four at once. **Don't proceed without them.** If Papa
doesn't have them, the section below each item tells you what to
tell him.

| What | Why you need it | If Papa doesn't have it |
|---|---|---|
| **Access to the GitHub repo `shahprateek317/lec-crm`** | To `git pull` / `git push` changes | The repo is on Prateek's GitHub. Ask Papa to message Prateek and have him add Papa as a collaborator at `https://github.com/shahprateek317/lec-crm/settings/access`. Read-only is enough if you'll deploy via SSH; write access needed if you'll push to main. |
| **AWS SSH access to the EC2 server** | To deploy changes + read live logs + run database queries | Two options. **Preferred: AWS Session Manager** — no SSH key needed, just an AWS account with the right IAM role. Tell Papa to log in at `https://console.aws.amazon.com/`, go to EC2 → Instances → `i-05b7646efee508b07` → Connect → "Session Manager" tab. If Session Manager isn't available, you need the **SSH key file** `lec-aws.pem` (Prateek has the original). Ask Papa to ask Prateek to share via 1Password, signed email, or AWS Secrets Manager. **Never paste the key into a chat or commit it to the repo.** |
| **The current `.env` file from `/opt/lec-crm/.env` on the EC2 server** | Contains DB credentials, AUTH_SECRET, CRON_SECRET, S3 keys, WhatsApp tokens, etc. — you cannot run anything locally without these | Once SSH is working, SCP it down: `scp -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25:/opt/lec-crm/.env ./local.env`. **Do not commit this file.** |
| **A copy of `docs/HANDOVER.md` from the repo** | The full operator runbook. Already alongside this file in `C:\Users\shahp\OneDrive\Documents\Papa App\` if you're on that machine | Read it — sections 1–18 cover everything. |

Once you have all four, pick a working environment from §2.

---

## 2. Pick where you'll work

### Path A: Edit directly on the EC2 server (recommended for Papa)

**Easier setup, no local toolchain needed.** Papa doesn't have to
install Node, Docker, Postgres, or Prisma on his machine.

```bash
# 1. SSH in (or use AWS Session Manager — same shell either way)
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25

# 2. Code lives at /opt/lec-crm — git clone of main
cd /opt/lec-crm

# 3. Pull latest if you fell behind
git pull origin main

# 4. Make your edits (use nano/vi/code-server)
nano src/lib/totp.ts

# 5. Test locally on the server
docker compose exec app npm test

# 6. Rebuild + restart the running app
docker compose build app && docker compose up -d app

# 7. Tail logs to confirm boot
docker compose logs -f app
```

**Downsides:** if you break something on prod, prod is broken until
you fix it. See §5 for the rollback ritual.

### Path B: Edit on Papa's local machine, deploy when ready

**Safer (changes don't go live until you push)**, but requires
toolchain setup on Papa's Windows machine.

```bash
# 1. Clone the repo (anywhere — Documents folder is fine)
cd C:\Users\shahp\Documents
git clone https://github.com/shahprateek317/lec-crm.git
cd lec-crm

# 2. Install Node.js 20 LTS from nodejs.org (Papa: ask if you need help)
node --version  # should be v20.x

# 3. Install dependencies (5-10 min first time)
npm install

# 4. Copy the .env you SCP'd from EC2 to .env.local
copy ..\local.env .env.local

# 5. Generate Prisma client + run dev server
npx prisma generate
npm run dev

# Open http://localhost:3000 to see the dev copy.
# Changes show up live (hot reload).

# When ready to ship:
git add -A
git commit -m "what you changed"
git push origin main

# Then SSH to EC2 and run the deploy script:
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25
bash /tmp/deploy-to-ec2.sh
```

**Downsides:** Papa has to install Node + Git + maybe a code editor.
Local dev will use the LIVE database (be careful with `prisma
migrate` — see §6 #4).

**Pick A unless Papa specifically asks for B.**

---

## 3. Verify everything's healthy before you change anything

Whichever path you picked, run these to confirm the world hasn't
drifted:

```bash
# Tests (123 should pass)
npm test

# Live smoke tests (56 should pass)
bash /tmp/smoke-phase1.sh
bash /tmp/smoke-phase2a.sh
bash /tmp/smoke-phase2b.sh
bash /tmp/smoke-phase2c.sh

# Or copy them down once if they're not there:
scp -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25:/tmp/smoke-phase*.sh /tmp/
```

If anything fails, **stop and find out why before editing code**. A
red baseline means you can't tell whether your change broke something
or it was already broken.

---

## 4. Live state snapshot (as of this handoff)

| | |
|---|---|
| **Production URL** | `https://crm.lifeenergycentre.in` |
| **Vercel fallback** | `lec-crm.vercel.app` (still up; decommission once Papa's testing settles) |
| **EC2 instance** | `i-05b7646efee508b07` (t3.small, Ubuntu 24.04, ap-south-1a) |
| **Public IP** | `13.204.229.25` (Elastic IP, won't change) |
| **GitHub** | `https://github.com/shahprateek317/lec-crm.git` (main branch) |
| **Latest commit** | check `git log -1` — Phase 2c shipped most recently |
| **Tests** | 123 passing (`npm test`) |
| **Live smoke** | 56 passing across 4 phase scripts |
| **Database** | Postgres 17 in Docker, single AZ, daily backups to S3 |
| **Backups** | S3 bucket `lec-crm-backups`, 90-day retention, daily 21:00 UTC |
| **Crons** | `crontab -l` on EC2 — 3 entries (backup, reconciler, reminder) |
| **External blockers** | Meta WABA name approval; Razorpay KYC; AWS root MFA |

---

## 5. Rollback — what to do if something breaks after deploy

If the live site goes weird after a deploy, do this in order:

```bash
# 1. SSH in
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25

# 2. See what the last few deployed commits were
cd /opt/lec-crm && git log -5 --oneline

# 3. Revert to the previous known-good commit
git reset --hard <previous-commit-sha>

# 4. Rebuild + restart
docker compose build app && docker compose up -d app

# 5. Tail logs and watch for "✓ Ready"
docker compose logs -f app

# 6. Confirm with a smoke
bash /tmp/smoke-phase1.sh
```

If the database is the problem (a migration that broke things),
**also**:

```bash
# Restore the latest backup
sudo bash /opt/lec-crm/scripts/restore-pg.sh --latest
# Then re-deploy the rolled-back code
```

If you cannot get the site healthy after 30 minutes of trying, **stop
and tell Papa to email Prateek**. Don't keep digging — losing the
site for two hours is much worse than admitting defeat at 30 minutes.

---

## 6. Gotchas / things worth knowing

1. **`/me/*` server-rendered redirects via NEXT_REDIRECT template
   marker**, not HTTP status. `curl -L` doesn't follow them. Smoke
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

4. **`prisma migrate dev` will WIPE your local database** if it
   detects drift. Use `prisma migrate deploy` against the production
   database (never `dev`). In doubt, ask before running.

5. **Atomic claim before WhatsApp send** in the reminder cron. The
   send is the side effect with external state; the claim guarantees
   no two cron runs grab the same row. Don't reorder.

6. **Document model uses polymorphic FK + CHECK constraint**.
   `ownerUserId XOR ownerClientId` enforced in the migration SQL,
   not in Prisma. Any Document insert must pick exactly one side.

7. **Cron route auth fails closed**. If `CRON_SECRET` is unset in
   `.env`, the routes return 500. That's intentional. Don't add a
   fallback / default secret.

8. **`AUTH_SECRET` is a critical credential**. It encrypts both
   WhatsApp/Razorpay tokens (`settings.ts`) AND TOTP secrets
   (`User` row). Rotating it makes every encrypted value
   unrecoverable. When rotation is finally needed, build a
   re-encrypt job first.

9. **EC2 deploy script** is at `~/lec-crm/scripts/deploy-to-ec2.sh`
   (or `/tmp/deploy-to-ec2.sh` if you copied it). Roughly: git pull,
   `docker compose build app && docker compose up -d app`. Migrations
   run automatically inside the build (`npm run build` chain).

10. **Demo seed data is re-applied on every deploy**. Set
    `SKIP_SEED=true` in `.env` when Papa goes live with real
    customers so demo Asha Patel doesn't get re-created.

---

## 7. The Phase 2d queue — what's worth picking up

Each item is self-contained (~30 min–2 h). None block launch. Pick
whichever matters most.

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
     (currently skipped — see HANDOVER §17).
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
     actual paid-out via a `HealerPayout` table. Admin UI at
     `/settings/payouts`; healer view in `/my-earnings` shows
     pending vs paid alongside the computed totals.

### Medium value, low effort

6. **Notification preferences** (~45 min)
   - Per-user opt-out for each `NotificationKind`. New model
     `NotificationPreference { userId, kind, enabled }`. Default
     all-on. Settings page at `/settings/notifications`.

7. **Daily email digest** (~1 h)
   - Cron at 08:00 IST that emails each staff user a summary of
     their unread notifications. Pick a transactional email provider
     (Resend / Postmark / AWS SES); wire to `/settings/whatsapp`-style
     admin config so Papa can swap credentials.

### Externally blocked — don't start until unblock

8. **Task #7 (Razorpay credits + courses + 2-way `/me/messages`)** (large)
   - Mock-scaffold today; live wire when KYC clears.

---

## 8. External blockers (the things Papa needs to chase, not Claude)

| Blocker | Status | What unblocks it | Who can chase |
|---|---|---|---|
| **Meta WABA display name approval** | Pending submission / waiting on Meta | Once approved, swap WhatsApp provider in `/settings/whatsapp` from `stub` to `meta` — stays in stub today so real customer phones don't get demo messages | Papa via Meta Business Manager |
| **Razorpay KYC** | Pending — business verification documents required | Once approved, `/me/credits` flow can scaffold; today it's deferred. Code path exists, needs payment-link wiring | Papa via Razorpay dashboard |
| **AWS root MFA** | Recommended but not blocking | Hardens the AWS account; doesn't affect runtime | Papa via AWS Console → IAM |

---

## 9. Reference docs you should also have

All three are in `C:\Users\shahp\OneDrive\Documents\Papa App\` on
Papa's machine, and at `/opt/lec-crm/docs/` on the EC2 server.

- **`HANDOVER.md`** — the full operator runbook (sections 1–18).
  Read this if you're going to do anything serious — deploys,
  schema changes, backups, restores, EC2 lifecycle.
- **`UX_ARCHITECTURE.md`** — the long-term architecture north
  star. Read this if you're adding a new feature so you stay on
  the established patterns (auth model per surface, polymorphic
  Document, audit-log conventions, etc.).
- **`HANDOFF-FOR-NEXT-CLAUDE.md`** — this file. Read this first.

---

## 10. Suggested first-message-to-Papa template

When Papa starts a conversation with you and you've read this
handoff, open with something like:

> Hi Papa! I've read the handoff doc and I'm caught up on where
> the CRM is. Before I can change anything, I need three things
> from you:
>
> 1. Do you have AWS Console access so I can SSH into the EC2
>    server? If yes, can you give me the credentials? If you don't
>    know what AWS Console is, please ask Prateek to set up "AWS
>    Session Manager" access for you — that's the easiest path.
>
> 2. Is there a `lec-aws.pem` file on your computer anywhere? It's
>    the SSH key. If not, Prateek has it. (Don't paste it to me
>    — once you find it, just confirm you have it.)
>
> 3. What would you like me to work on? You can:
>    - Just use the running site (already live at
>      crm.lifeenergycentre.in — no work needed from me)
>    - Have me make a specific change or fix
>    - Have me pick the next item from the Phase 2d queue
>
> While you find those, I'll verify the live site is healthy.

Then run the smoke tests in §3.

---

*Last updated 2026-05-28 alongside Phase 2c. The previous Claude
(running on Prateek's machine) was the author. Update this file
when the world changes — it's only useful if it's accurate.*
