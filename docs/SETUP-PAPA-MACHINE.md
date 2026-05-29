# Setup checklist — Papa's machine

**Audience: Prateek (the human reading this).** Do this once on Papa's
machine — sitting next to him or via a remote-desktop session.
Expected duration: **30–45 minutes**, mostly waiting for installers.

After you complete this, Papa opens Claude Code, says "read
`docs/HANDOFF-FOR-NEXT-CLAUDE.md` and continue", and his Claude
autonomously bootstraps + works the Phase 2d queue. Papa never
touches a credential.

Verify each step before moving to the next — failures compound.

---

## What we're installing

| Component | Why | Source |
|---|---|---|
| Git for Windows | Provides Git Bash + ssh + bash + standard Unix tools | `git-scm.com/download/win` |
| Node.js 20 LTS | Runs the app + tests locally on Papa's machine | `nodejs.org/en/download` (pick 20.x LTS, Windows Installer .msi) |
| Claude Code (Anthropic) | The agent that does the work | `claude.ai/download` or `https://docs.anthropic.com/en/docs/claude-code` |
| Repo clone | Source code | private via PAT (you'll generate one in step 3) |
| EC2 SSH key | Deploy + remote diagnostics | the `lec-aws.pem` file on your machine |
| GitHub PAT | Pull / push without prompts | you'll generate in step 3 |
| Local `.env.local` | Secrets (DB password, AUTH_SECRET, etc.) | SCP from `/opt/lec-crm/.env` on EC2 |

**Things you do NOT install:** WSL, Docker, rsync, AWS CLI. All
heavy deps stay on the EC2 server.

---

## Step 1 — Install Git for Windows + Node 20

1. Open a browser on Papa's machine.
2. Download Git for Windows (`64-bit Git for Windows Setup`). Run
   the installer. **Default options are fine** EXCEPT one screen:
   pick "Use Windows' default console window" if asked, and on
   "Choosing the SSH executable", pick **"Use bundled OpenSSH"**.
3. Download Node.js 20 LTS (`.msi` installer). Run it. **Tick
   "Automatically install the necessary tools"** when offered.
4. Open Git Bash from the Start menu. Verify:
   ```bash
   git --version    # expect git version 2.x
   node --version   # expect v20.x
   npm --version    # expect 10.x
   ssh -V           # expect OpenSSH_for_Windows_8.x or newer
   ```
   If any fail, restart the machine and try again — installers
   sometimes don't update PATH until reboot.

**Checkpoint:** Git Bash works, four versions return cleanly.

---

## Step 2 — Set up SSH access to the EC2 server

In Git Bash on Papa's machine:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
```

Now copy `lec-aws.pem` (the EC2 SSH key) from YOUR machine onto
Papa's at `C:\Users\<papa-username>\.ssh\lec-aws.pem`. Don't email
it; use a USB drive, encrypted Drop, or 1Password Send.

Once placed, fix the Windows ACLs (Windows OpenSSH refuses to use
keys with loose permissions — this is the equivalent of `chmod 600`):

```bash
# In Git Bash, as Papa
USER_NAME=$(whoami)
icacls.exe "C:\\Users\\$USER_NAME\\.ssh\\lec-aws.pem" /inheritance:r
icacls.exe "C:\\Users\\$USER_NAME\\.ssh\\lec-aws.pem" /grant:r "$USER_NAME:(R)"
```

Test the connection:

```bash
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25 hostname
# Expected output: ip-172-31-...
```

If it returns the hostname, SSH works. If it complains about
permissions, re-run the `icacls` commands above.

**Checkpoint:** SSH to EC2 returns the hostname.

---

## Step 3 — Generate a GitHub PAT + clone the repo

Generate a fine-grained Personal Access Token on YOUR github
account (you own the repo) — Papa won't even see this token.

1. Open `https://github.com/settings/personal-access-tokens`
2. Click **"Generate new token" → "Fine-grained"**
3. Token name: `papa-claude-lec-crm`
4. Expiration: **90 days** (rotate later if needed)
5. Resource owner: your account
6. Repository access: **"Only select repositories"** → pick
   `shahprateek317/lec-crm`
7. Permissions → Repository permissions:
   - Contents: **Read and write**
   - Metadata: Read (auto-selected)
   - Pull requests: **Read and write** (optional, for future)
8. Click "Generate token". **Copy it now — you can't see it again.**

Store it on Papa's machine so git uses it transparently. In Git Bash:

```bash
# Cache the token in Windows Credential Manager via the git helper
git config --global credential.helper manager
git config --global user.name  "Papa Subhash Shah"
git config --global user.email "papa@lifeenergycentre.in"  # any valid email

cd ~
git clone https://github.com/shahprateek317/lec-crm.git
# When prompted for username: type your GitHub username (shahprateek317)
# When prompted for password: paste the PAT
# The Credential Manager caches it; Papa won't be re-prompted.

cd ~/lec-crm
git status                        # should say "clean"
git log -1 --oneline              # should show the latest commit
```

**Checkpoint:** `~/lec-crm` exists, `git status` is clean.

---

## Step 4 — Pull `.env.local` down from the EC2 server

The production `.env` lives at `/opt/lec-crm/.env` on EC2. It
contains `AUTH_SECRET`, DB password, S3 keys, etc. Papa's Claude
needs a local copy for running tests + `prisma generate`.

```bash
cd ~/lec-crm
scp -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25:/opt/lec-crm/.env .env.local
chmod 600 .env.local
ls -la .env.local                 # expect a non-zero-byte file
grep AUTH_SECRET .env.local       # expect one line returned
```

**Checkpoint:** `.env.local` exists and contains `AUTH_SECRET`.

---

## Step 5 — Install dependencies + run the test suite

This is where you find out if anything's broken before handing
off to Papa.

```bash
cd ~/lec-crm
npm install                       # 3–8 min first time
npx prisma generate               # 10–30 seconds
npm test                          # expect 123 passing
```

If all 123 tests pass, the local toolchain works. If anything
fails, fix it now — Papa's Claude will struggle to debug a
broken baseline.

Run the live smoke against prod to confirm the EC2 side is healthy:

```bash
bash scripts/smoke/phase1.sh
bash scripts/smoke/phase2a.sh
bash scripts/smoke/phase2b.sh
bash scripts/smoke/phase2c.sh
# Expect 22+9+9+16 = 56 PASS, 0 FAIL across the four
```

**Checkpoint:** 123 unit tests + 56 smoke checks all green.

---

## Step 6 — Install Claude Code on Papa's machine

Follow the install instructions at
`https://docs.anthropic.com/en/docs/claude-code`. Sign in with
Papa's Anthropic account (or yours, if Papa doesn't have one — you
can move the subscription to him later).

After install, in Git Bash:

```bash
cd ~/lec-crm
claude                            # opens Claude Code in the repo
```

In the Claude Code prompt, run:

```
/init
```

Then close it. We just wanted Claude Code to scan the codebase
and write a `CLAUDE.md` for itself.

**Checkpoint:** Claude Code launches in the repo, scans, exits
cleanly.

---

## Step 7 — Optional: install helpful skills

The previous Claude leaned on a few skills. None are required —
the basic Claude Code toolset is enough to do all of Phase 2d.
Skip this step if you want to keep setup minimal.

If you want to give Papa's Claude the same toolkit Prateek's had:

- **anthropic-skills** plugin (provides docx/pdf/xlsx readers,
  skill-creator, and `consolidate-memory`)
- **code-review** skill (independent review pass)
- **security-review** skill (focused security pass)

Install via Claude Code's `/plugin` command after the first
launch. See Anthropic's docs for current install syntax.

---

## Step 8 — Hand off to Papa

Tell Papa:

> The CRM development environment is set up on your machine. To
> continue improving the system, just open Git Bash (it's a
> program on your desktop now), then type:
>
> ```bash
> cd ~/lec-crm
> claude
> ```
>
> When Claude opens, paste this one line:
>
> ```
> Please read docs/HANDOFF-FOR-NEXT-CLAUDE.md and continue the work.
> ```
>
> Claude will then go off and improve the CRM on its own. Check
> back once a week — it'll send you a summary of what it shipped
> and ask if you have any feedback.
>
> If something breaks badly, message Prateek.

That's it. Papa's autonomous.

---

## What you've left Papa with

| Thing | Where | Notes |
|---|---|---|
| Code | `~/lec-crm/` | Git-tracked, PAT cached for push |
| Secrets | `~/lec-crm/.env.local` (chmod 600) | Don't share |
| EC2 SSH key | `~/.ssh/lec-aws.pem` (ACLs locked) | Don't share |
| GitHub PAT | Windows Credential Manager | Invisible to Papa; auto-used by git |
| Bootstrap doc | `~/lec-crm/docs/HANDOFF-FOR-NEXT-CLAUDE.md` | What Papa's Claude reads first |
| Smoke tests | `~/lec-crm/scripts/smoke/*.sh` | Verifies prod after deploy |
| Deploy script | `~/lec-crm/scripts/deploy.sh` | git-pull based, runs from Git Bash |

---

## Rollback — if you discover something broken after handing off

If Papa later reports a problem, SSH yourself into the EC2 from
either machine:

```bash
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25
cd /opt/lec-crm
git log -5 --oneline              # find the last good commit
git reset --hard <good-sha>
sudo docker compose up -d --build
```

Then tell Papa "I rolled back to a working version, please continue."

---

## What you DON'T need to set up

- WSL (Linux on Windows) — not needed; Git Bash provides enough
  Unix-flavoured tools
- Docker locally — the database + app run on EC2, not Papa's
  machine
- AWS CLI locally — Papa's Claude reaches AWS via SSH to EC2
  (EC2 has an IAM role)
- A staging environment — deploys are direct to prod (acceptable
  at current scale; document if you outgrow this)

---

*Generated alongside Phase 2c. If this checklist breaks at any
step, please update it — the next setup is only as smooth as
this doc is accurate.*
