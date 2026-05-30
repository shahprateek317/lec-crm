# Bootstrap instructions — for Claude

You're reading this because Papa pasted "Read BOOTSTRAP-INSTRUCTIONS.md
and follow it" into Claude Code on his Windows machine. You are
starting from a fresh project folder containing:

```
.
├── README.txt                    (Papa's instructions; already done his part)
├── BOOTSTRAP-INSTRUCTIONS.md     (this file)
├── bootstrap.ps1                 (default setup script — Windows PowerShell)
├── secrets/
│   ├── lec-aws.pem               (EC2 SSH private key)
│   ├── .env.local                (DB password, AUTH_SECRET, S3 keys, etc.)
│   └── github-pat.txt            (fine-grained PAT for github.com/shahprateek317/lec-crm)
└── docs/
    ├── HANDOFF-FOR-NEXT-CLAUDE.md  (read AFTER bootstrap)
    ├── HANDOVER.md                 (full operator runbook)
    └── UX_ARCHITECTURE.md          (architecture north star)
```

Your job:
1. **Bootstrap the dev environment** by running `bootstrap.ps1`
   (or doing equivalent steps manually if it errors).
2. **Verify health** with the test + smoke checks.
3. **Clean up secrets** from this bundle folder.
4. **Tell Papa bootstrap is complete** and ask him to delete the
   WhatsApp message.
5. **Transition to autonomous mode** — read
   `~/lec-crm/docs/HANDOFF-FOR-NEXT-CLAUDE.md` and start working
   the Phase 2d queue.

---

## Step 1 — Run the bootstrap script

Open a PowerShell terminal in this folder and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\bootstrap.ps1
```

The script:
- installs Git for Windows via `winget` (UAC prompt — Papa clicks Yes)
- installs Node.js 20 LTS via `winget` (UAC prompt — Papa clicks Yes)
- places the EC2 SSH key at `~/.ssh/lec-aws.pem` with locked ACLs
- caches the GitHub PAT in Windows Credential Manager (Papa never
  sees it; git transparently uses it)
- clones the repo to `~/lec-crm`
- copies `.env.local` into the repo
- runs `npm install`, `npx prisma generate`, `npm test`
- runs the 4 live smoke scripts against prod

It is idempotent. If it fails partway, fix the failure (e.g. user
clicked No on UAC), rerun. The script checks for already-installed
tools and skips redundant work.

If `winget` is missing (very old Windows), the script tells you to
download `Git for Windows` and `Node.js 20 LTS` `.msi` installers
from the official URLs and re-run. Walk Papa through it in plain
language — don't make him debug.

After the script finishes successfully, you should see:

```
✓ bootstrap complete
  123 unit tests passed
  56 smoke checks passed against https://crm.lifeenergycentre.in
```

If you see that, you're ready.

## Step 2 — If something fails

The bootstrap is designed to be safe to re-run. If it errors:

1. **Read the error carefully.** Most failures are one of:
   - Network/DNS hiccup (transient — retry)
   - UAC denied (Papa clicked No — re-run, ask him to click Yes)
   - Antivirus blocking the MSI (rare — tell Papa to allow once)
   - Old Windows missing `winget` (use manual MSI install fallback)

2. **If it's a real bug** (not user error), tell Papa to forward
   the error to Prateek:

   > Papa — the bootstrap failed with this error:
   >
   > ```
   > [paste the exact output]
   > ```
   >
   > Please forward this exact message to Prateek so he can
   > investigate. While I wait, I'll try to make progress on
   > anything that doesn't need the broken piece.

3. **Don't try to manually fix a broken Windows install.** That
   path leads to hours of guessing. Defer to Prateek.

## Step 3 — Clean up secrets

Once bootstrap reports success, the bundle's `secrets/` folder is
no longer needed — the values have been copied to their permanent
homes (`~/.ssh/`, `~/lec-crm/.env.local`, Windows Credential Manager).

The script automatically wipes them. Verify:

```powershell
Test-Path .\secrets   # expect: False
```

If for any reason secrets are still present, remove them yourself:

```powershell
Remove-Item .\secrets -Recurse -Force
```

## Step 4 — Tell Papa

Send him this message verbatim:

> Papa, bootstrap is complete. Everything is set up and the live
> site is healthy (56 of 56 checks passing). Two cleanup actions
> you can do now:
>
> 1. Delete the WhatsApp message from Prateek that had the .zip
>    attached — it contained sensitive passwords that are no
>    longer needed.
> 2. Delete the .zip file from your Downloads folder (same
>    reason).
>
> You don't need to do anything else. I'm going to start working
> on the next round of improvements from the queue. I'll send you
> a summary in about a week, or sooner if I need your input.
>
> If you have any wishes for the CRM right now, tell me — I can
> work on those first.

## Step 5 — Transition to autonomous mode

Read `~/lec-crm/docs/HANDOFF-FOR-NEXT-CLAUDE.md` cover-to-cover.
That doc takes over from here:
- §2 is the autonomous loop (TDD → review → deploy → smoke → commit)
- §6 is the Phase 2d queue (pick the top item)
- §4 is how to talk to Papa (weekly check-ins, plain language)

After reading, pick the top Phase 2d item and start working.

---

## What's already set up on EC2 (you don't need to touch)

The production server at `13.204.229.25` already has:
- Docker stack running (Caddy + Next.js + Postgres 17)
- Daily Postgres backups to S3 at 21:00 UTC
- DPDP reconciler cron at 02:30 UTC
- Pre-session reminder cron every 10 min
- Git remote configured for `git pull origin main`

Your deploys SSH to EC2 and run `git pull && docker compose up -d --build`.
The wrapper is `scripts/deploy.sh`.

---

## Skills you might want (optional, after bootstrap)

The previous Claude leaned on these. Install via `/plugin install`
in Claude Code if you want the same toolkit:

- `code-review` — fresh-eyes pass on diffs before deploy
- `security-review` — focused security pass on auth/payment changes
- `anthropic-skills` (bundles docx/pdf/xlsx readers)

None are required to ship Phase 2d.

---

## Quick environment reference

| Variable | Value | Where |
|---|---|---|
| Repo root | `~/lec-crm` | Papa's machine after clone |
| EC2 IP | `13.204.229.25` | Elastic IP, won't change |
| EC2 SSH | `ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25` | After bootstrap |
| GitHub repo | `https://github.com/shahprateek317/lec-crm.git` | Private |
| Live URL | `https://crm.lifeenergycentre.in` | Prod |
| Test suite | `npm test` (123 expected) | Local |
| Smoke | `bash scripts/smoke/phase{1,2a,2b,2c}.sh` (56 expected) | Local → prod |
| Deploy | `bash scripts/deploy.sh` | Local → prod |
