# Handoff for the next Claude

You are picking up the **Life Energy Centre CRM**, an active
production system at `https://crm.lifeenergycentre.in`. Your job
is to **autonomously continue the Phase 2d queue** in §6 —
shipping, deploying, smoke-testing, and committing as you go. You
do not need Papa's permission to keep working.

The previous Claude (a 1M-context Claude Opus 4.7 instance running
on Prateek Shah's machine) shipped Phases 1, 2a, 2b, and 2c. It
left this handoff so you can pick up cleanly.

**The human at your keyboard is Papa (Subhash Shah)** — a yoga
master and the centre's founder. He is your stakeholder and
beneficiary, not your collaborator on the code. He will:

- give you product feedback on what you've shipped
- ask you to fix bugs or build small things he wants
- use his phone for TOTP codes when signing into the CRM
- use his browser to log into AWS Console, Meta Business, or Razorpay when needed

**Papa does not run commands. Ever.** Do not show him a terminal
command and ask him to run it — he won't, and it will crash things
if he tries anyway. You have SSH access, AWS CLI, and git. Use them
yourself. Tell Papa only the outcome.

The only things that genuinely require Papa's physical action:
- Entering a TOTP code from his authenticator app
- Logging into a web dashboard (AWS Console, Meta Business, Razorpay)
  where credentials are his personal login

When you talk to him, **use plain language** — describe outcomes
("the site is back up", "healers can now see their monthly earnings"),
not mechanism ("ran docker compose up -d"). He is sharp but not a developer.

---

## 1. Bootstrap — verify everything before your first ship

Prateek pre-staged Papa's machine using `docs/SETUP-PAPA-MACHINE.md`.
If that ran cleanly, the seven things below already exist. Verify
each — failures here mean Prateek's setup didn't finish; don't try
to fix them yourself, send Papa the recovery message at the bottom
of this section.

```bash
cd ~/lec-crm                              # 1. repo present
git status                                # 2. clean tree, on main
node --version                            # 3. v20.x
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25 hostname
                                          # 4. SSH key works → "ip-..."
grep AUTH_SECRET .env.local               # 5. secrets staged
npm test                                  # 6. 123 passing
bash scripts/smoke/phase1.sh && \
bash scripts/smoke/phase2a.sh && \
bash scripts/smoke/phase2b.sh && \
bash scripts/smoke/phase2c.sh             # 7. 56 passing against prod
```

If 1–7 all pass, you're ready to ship. Skip to §3.

### 1.1 If something fails

Don't try to fix the setup yourself — Papa can't help and you'll
spend hours guessing. Send Papa this message verbatim:

> Papa — the bootstrap check failed at step `[N]` with this error:
>
> ```
> [paste the exact terminal output]
> ```
>
> Please forward this exact message to Prateek and let me know
> when he's reset the setup. While we wait, I'll work on whatever
> I can without the broken piece. If nothing, I'll tell you I'm
> idle.

Then pick a Phase 2d item from §6 that doesn't need the broken
piece. Pure-logic changes + tests don't need SSH or deploy. UI
work doesn't need the database. You can almost always make
forward progress on something.

---

## 2. The autonomous loop

This is the rhythm. Stay in it.

```
1. TaskList — see what's queued; if empty, pick the top Phase 2d
   item from §6 and create a task.
2. TaskUpdate — mark in_progress.
3. Read the relevant existing files. Stay on existing patterns
   (auth model per surface, polymorphic Document, audit conventions,
   in-memory-fake test stores).
4. Get an independent code-review agent (subagent) on any change
   that touches auth, security, payments, or audit logging
   BEFORE you write a line of code — ask it for the design pitfalls
   you should pre-empt.
5. TDD: write the pure-logic tests against an in-memory fake
   first. Pattern: src/lib/reconciler.test.ts, reminders.test.ts,
   totp.test.ts.
6. Implement until tests pass.
7. npx tsc --noEmit       # typecheck clean
8. npm test               # full suite green (you added cases; total grows)
9. Commit (small, focused). Use HEREDOC for the commit message.
10. Push to main: git push origin main.
11. Deploy: bash scripts/deploy.sh   — ALWAYS use this script, NEVER run
    `docker compose build --no-cache` directly. The EC2 is a t3.small;
    --no-cache rebuilds every layer from scratch and OOM-kills the server.
    The deploy script uses cached layers and stays within memory limits.
    (background it; the harness
    notifies you on completion). This SSHes to EC2, git-pulls
    main, rebuilds the app container, tails logs. Use
    scripts/deploy-rsync.sh instead for uncommitted-working-tree
    iteration (needs rsync; not available in Git Bash on Windows).
12. Smoke against prod: bash scripts/smoke/phase{1,2a,2b,2c}.sh.
    If you added a new surface, EXTEND the relevant smoke script
    and re-run all four.
13. Get an independent code-review agent on the diff after deploy
    too — fresh eyes catch what you missed.
14. TaskUpdate — mark completed. Update HANDOVER.md and this
    HANDOFF if the world changed.
15. Loop back to step 1.
```

**Never skip steps 4 (review-before), 7 (typecheck), or 12
(live smoke).** Each has caught a real bug in the previous Claude's
ship cycle. Step 13 (review-after) caught a high-severity ordering
bug in Phase 2b that would have double-sent WhatsApp messages.

**Commit cadence:** one logical change per commit. If you're
building something big, ship it in 2–4 commits with clear
boundaries (e.g. "schema + migration", "pure lib + tests", "UI +
server actions", "review fixes").

**When you should NOT just keep going:**

- A schema migration that destroys data (DROP COLUMN, TYPE change
  losing precision). Stop, ask Papa to confirm.
- A payment flow change. Stop, ask Papa to confirm.
- A change to the staff sign-in critical path that could lock
  Papa out. Verify with an agent + add a recovery path before
  shipping.
- A change touching the WhatsApp template approved by Meta.
  Stop, ask Papa to re-approve with Meta.
- You've been heads-down for 2+ hours and want feedback. Send a
  progress check-in (§4).

---

## 3. Live state snapshot

| | |
|---|---|
| **Production URL** | `https://crm.lifeenergycentre.in` |
| **Vercel fallback** | `lec-crm.vercel.app` (still up; decommission once Papa's testing settles) |
| **EC2 instance** | `i-05b7646efee508b07` (t3.small, Ubuntu 24.04, ap-south-1a) |
| **Public IP** | `13.204.229.25` (Elastic IP, won't change) |
| **GitHub** | `https://github.com/shahprateek317/lec-crm.git` (main) |
| **Latest commit** | check `git log -1` — Phase 2d items 1–7 shipped |
| **Tests** | 176 passing (`npm test`) |
| **Live smoke** | 56 passing across 4 phase scripts |
| **Database** | Postgres 17 in Docker, single AZ, daily backups to S3 |
| **Backups** | S3 bucket `lec-crm-backups`, 90-day retention, daily 21:00 UTC |
| **Crons on EC2** | `crontab -l` — 4 entries (backup, reconciler, reminder, daily digest) |
| **SKIP_SEED** | `true` on EC2 — Razorpay is live; demo seed disabled |
| **Razorpay** | **LIVE** — `rzp_live_*` keys in DB, webhook configured, payments working |
| **WhatsApp** | **LIVE** — `meta` provider, phone ID `1149468414922168`, permanent token needed (see §7) |
| **AWS root MFA** | Not yet configured — strongly recommended |

---

## 4. When and how to talk to Papa

**Weekly progress check-in.** Once a week (or after a meaningful
chunk of work — 3+ commits or a full Phase 2d item), send Papa a
2-paragraph summary:

> Paragraph 1: what's new for the centre (outcomes, plain
> language). Example: *"Healers can now see their earnings on a
> new page. Admins can soft-delete a client; the data
> auto-anonymises after 30 days. The site is now stricter about
> who can sign in as admin (2-factor codes from a phone app)."*
>
> Paragraph 2: anything you need from him — external blockers
> you've been waiting on, product decisions you'd like his call
> on, or "nothing right now; I'll keep going on the queue."

**Mid-work questions.** Only ask if the answer materially changes
what you build. Example yes:

> Papa — quick call: when a client refers two friends and earns
> two free healing sessions, should those credits expire (in
> e.g. 6 months) or stay forever? It changes the data model. I'm
> leaning forever because that's how the centre operates today —
> say "yes go forever" or "no, expire" and I'll proceed.

Example no (just decide, don't ask):

> ~~Papa — should the soft-delete confirmation say "Yes, delete"
> or "Delete forever"?~~ ← pick one, ship it, iterate on feedback.

**Reporting bugs.** Plain language with reproduction steps:

> Papa — I found a bug where if a healer's profile doesn't have a
> per-session charge set, the earnings page shows ₹0 with no
> explanation. Fixing now. To reproduce: sign in as a healer
> without a fee, visit `/my-earnings`. Will deploy the fix in
> ~15 min.

**Asking for external-blocker chase.** Be specific about what you
need:

> Papa — to wire real WhatsApp messages, I need three things from
> the Meta Business Manager:
>   1. WABA Phone Number ID (looks like `123456789012345`)
>   2. System User access token (long string starting `EAAB...`)
>   3. The display name "Life Energy Centre" approved (check status
>      at Meta Business Manager → WhatsApp → Phone Numbers).
> Can you check today / forward to Prateek to chase?

---

## 5. Rollback ritual — if a deploy breaks prod

```bash
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25
cd /opt/lec-crm
git log -5 --oneline                   # find the previous good SHA
git reset --hard <previous-sha>
docker compose build app && docker compose up -d app
docker compose logs -f app             # watch for "✓ Ready"
bash /tmp/smoke-phase1.sh              # confirm green
```

If the database is the problem (a migration that destroyed rows):

```bash
sudo bash /opt/lec-crm/scripts/restore-pg.sh --latest
# Then re-deploy the rolled-back code
```

**Then send Papa a short note:**
> Papa — I deployed a change that broke X. Rolled back; site is
> healthy. Investigating root cause. Will retry the fix once I
> understand what went wrong.

If you cannot get the site healthy in 30 minutes, **stop and tell
Papa to ping Prateek**. Don't keep digging — 2 hours of downtime
is much worse than admitting defeat at 30 minutes.

---

## 6. Phase 2d queue — ALL SHIPPED ✓

All 7 Phase 2d items were completed by Prateek's Claude (June 2026).

| # | Item | Status |
|---|---|---|
| 1 | TOTP enforcement for admin roles | ✅ Shipped |
| 2 | Soft-delete affordance on `/me/profile` | ✅ Shipped |
| 3 | Tighten Phase 2c follow-ups (TOTP TTL cron, S3 reconciler) | ✅ Shipped |
| 4 | Backup codes for TOTP | ✅ Shipped |
| 5 | HealerPayout model + admin UI + healer earnings view | ✅ Shipped |
| 6 | Notification preferences per user | ✅ Shipped |
| 7 | Daily email digest via Resend + EC2 cron | ✅ Shipped |
| 8 | Razorpay live integration | ✅ **LIVE** — `rzp_live_*` keys |
| 9 | WhatsApp live integration | ✅ **LIVE** — permanent token needed (see §7) |

### Next phase suggestions — ask Papa what he wants

Now that Phase 2d is complete and both major integrations are live,
the obvious next builds are:

- **Razorpay credits flow** — client pays a link → webhook grants credits automatically
- **Course enrollment + fees** — link course fees to Razorpay payment links
- **Two-way `/me/messages`** — clients can reply to messages in their portal
- **Playwright E2E smoke** — replace curl-based smoke with real browser tests
- **Client portal improvements** — Papa will know what clients ask for

Ask Papa: *"Phase 2d is complete. What's the most important thing
for clients right now — automatic credit grants when they pay, or
something else?"*

---

## 7. External blockers — current status

| Blocker | Status | What to do |
|---|---|---|
| **Razorpay** | ✅ **LIVE** — `rzp_live_SzsAmTboymQblN` in DB | Nothing. Working. |
| **WhatsApp permanent token** | ⚠️ **ACTION NEEDED** — temporary token may expire | See instructions below |
| **AWS root MFA** | ⚠️ Recommended — not yet done | See instructions below |

### WhatsApp permanent token — how to fix it yourself

The WhatsApp token entered on June 11 was a temporary user token (24h).
A permanent system user token does NOT expire. Here is exactly how to get one:

1. Go to **https://business.facebook.com/settings/system-users?business_id=3142025962748450**
   (log in with the Life Energy Centre Facebook account)
2. Click on **lec_crm** system user
3. Click **Generate new token**
4. Select app: **LEC CRM** (app ID 26435455006147117)
5. Tick these two permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
6. Click **Generate token** — copy the long string starting with `EAA...`
7. Go to **https://crm.lifeenergycentre.in/settings/whatsapp**
8. Paste the token in the **Access token** field → **Save**

**Note**: The Meta Business account showing as "Mahesh Shah" is Papa's own Facebook account — he has full admin access and can always generate this token himself.

### AWS root MFA — how Papa does it

1. Go to **https://console.aws.amazon.com** → sign in as **Root user** (the email used to create the AWS account — NOT the IAM claude-deployer user)
2. Click account name (top right) → **Security credentials**
3. Under **Multi-factor authentication (MFA)** → **Assign MFA device**
4. Name it (e.g. `root-phone`), select **Authenticator app** → Next
5. Open Google Authenticator / Authy → scan QR code
6. Enter two consecutive 6-digit codes from the app → **Add MFA**
7. Done — AWS account is now protected

The AWS account number is **397068653443**. The IAM user for deploys is `claude-deployer` — that's separate from root and already has its own access keys in `.env.local`.

---

## 8. Gotchas worth knowing

1. **`/me/*` server-rendered redirects via NEXT_REDIRECT template
   marker**, not HTTP status. `curl -L` doesn't follow them. Smoke
   scripts grep for `NEXT_REDIRECT;replace;/me/sign-in` in the body.

2. **`auth.config.ts` path allowlist uses exact-segment matching**.
   `pathname === p || pathname.startsWith(p + "/")`. Adding a new
   `/api/*` route that should bypass NextAuth needs to be added to
   the allowlist explicitly. Don't loosen to `startsWith(p)` — it
   accidentally widens to e.g. `/api/metrics` matching `/api/me`.

3. **NextAuth `authorize()` `null` vs throwing**. `null` is "bad
   credentials, generic". A thrown `CredentialsSignin` subclass
   with a `code` property signals a specific error (e.g.
   `totp_required`). The sign-in action reads `err.code` and
   surfaces it as `?error=...` to the page.

4. **`prisma migrate dev` will WIPE your local database** if it
   detects drift. Always `prisma migrate deploy` against production.
   Never `dev` against a real DB.

5. **Atomic claim BEFORE WhatsApp send** in the reminder cron.
   Reordering causes double-sends. The pattern is: `updateMany SET
   reminderSentAt = now() WHERE id = ? AND reminderSentAt IS NULL`
   — only proceed if `count === 1`.

6. **Document model uses polymorphic FK + CHECK constraint**.
   `ownerUserId XOR ownerClientId` enforced in migration SQL, not
   Prisma. Any insert must pick exactly one side.

7. **Cron route auth fails closed**. If `CRON_SECRET` is unset in
   `.env`, routes return 500. Intentional. Don't add a fallback.

8. **`AUTH_SECRET` is the master key**. It encrypts WhatsApp /
   Razorpay tokens (`settings.ts`) AND TOTP secrets (`User` row).
   Rotating it makes every encrypted value unrecoverable. Build
   a re-encrypt job FIRST if rotation is ever needed.

9. **EC2 deploy script** is at `scripts/deploy.sh` (git-pull based,
   runs on Windows Git Bash + Linux + macOS). For uncommitted-
   working-tree iteration, `scripts/deploy-rsync.sh` is available
   but needs `rsync` locally — not present on Windows Git Bash.
   Both run `docker compose up -d --build` on EC2; migrations run
   inside the build chain. Background it with the harness — the
   notification fires on completion.

10. **Demo seed runs on every deploy** unless `SKIP_SEED=true` in
    `.env`. When real customers are live, set the flag so demo
    Asha Patel doesn't reappear.

11. **NEXT_REDIRECT for /me/* is fine, not a leak**. The streaming
    layout renders, the page suspends, server aborts the page
    render with a template marker, client picks it up. Page
    content (the data) is never serialized. Verified in the
    Phase 2b smoke.

12. **Two-step sign-in form preserves password in a hidden field**
    across the TOTP step. This is safer than a half-session cookie
    (no expiry / revocation surface). Don't refactor to sessions
    unless you also build the lifecycle properly.

---

## 9. Reference docs

All four are in `~/lec-crm/docs/`.

- **`HANDOFF-FOR-NEXT-CLAUDE.md`** — this file. Read first. Update
  it when the world changes.
- **`HANDOVER.md`** — the full operator runbook (sections 1–18).
  Read for deploys, schema changes, backups, restores, EC2
  lifecycle, S3 policy.
- **`UX_ARCHITECTURE.md`** — the long-term architecture north
  star. Read when adding a new feature to stay on the established
  patterns.
- **`SETUP-PAPA-MACHINE.md`** — Prateek's one-time setup
  checklist. **Read this if §1 bootstrap fails** so you can tell
  Papa exactly what step might have gone wrong when you ask him
  to forward to Prateek.

---

## 10. Useful skills if you have them available

The previous Claude leaned on these. If your harness has them,
use them — if not, the tool list at the top of your prompt is
enough.

- **Plan** subagent — for designing a multi-step change before
  writing code. Use BEFORE touching auth / payments / audit.
- **general-purpose** subagent — for independent code review.
  Use BEFORE deploy on any security-relevant change, and AFTER
  deploy as a fresh-eyes pass. Stay specific about what to
  pressure-test; ask for "BLOCK / HIGH / MEDIUM / LOW severity
  with file:line, what's wrong, and fix."
- **Explore** subagent — for quick recon ("where is X defined,
  how is Y wired").
- **mcp__ccd_session__mark_chapter** — chapter the session so
  Prateek can navigate transcript later.
- **mcp__ccd_session__spawn_task** — flag genuinely out-of-scope
  fixes you spot for separate work, instead of bloating the
  current commit.

---

*Last updated 2026-06-12 alongside Phase 2d completion. Updated by Prateek's Claude after all 7 items shipped, Razorpay went live, and WhatsApp was connected. Update this file when the world changes — it's only useful if it's accurate.*
