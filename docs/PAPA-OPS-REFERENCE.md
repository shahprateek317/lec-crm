# Papa's Operations Reference

This file answers "how do I do X" for every routine operation.
Papa's Claude should read this file first before asking Prateek for anything.

## CRITICAL: Never ask Papa to run commands

Papa is not a developer. He will not run bash commands, SSH into servers,
or paste anything into a terminal. **You (Claude) do all of that yourself.**

You have everything you need:
- SSH key at `~/.ssh/lec-aws.pem` — use it to SSH into the EC2 directly
- AWS CLI credentials in WSL (`~/.aws/credentials`) — use them to reboot/start/stop EC2
- Git and deploy scripts in `~/lec-crm/` — run them yourself

If something is broken, fix it yourself using the commands in this file.
Only tell Papa the outcome: "The site is back up" or "I've deployed the update."
Never show Papa a command and ask him to run it.

The only things Papa ever needs to do himself are things that require
**his phone** (TOTP codes, authenticator app) or **his browser login**
(AWS Console root account, Meta Business, Razorpay dashboard).
Everything else is yours to handle.

Last updated: 2026-06-18

---

## Quick links

| Task | Where |
|---|---|
| Admin sign-in | https://crm.lifeenergycentre.in/sign-in |
| Settings (admin only) | https://crm.lifeenergycentre.in/settings |
| WhatsApp settings | https://crm.lifeenergycentre.in/settings/whatsapp |
| Razorpay settings | https://crm.lifeenergycentre.in/settings/razorpay |
| Email digest settings | https://crm.lifeenergycentre.in/settings/email |
| Audit log | https://crm.lifeenergycentre.in/settings/audit-log |
| EC2 IP | `13.204.229.25` (Elastic IP — permanent, never changes) |

---

## Admin login

- Email: `mkshah@pecon.co.in`
- Password: `LEC@2024`
- TOTP: Papa has the authenticator code on his phone. The 6-digit code refreshes every 30 seconds — use the CURRENT code, not the one from 30 seconds ago.
- If the code says "didn't match": wait for the code to refresh (up to 30 seconds), try again with the new code.

---

## Deploy a code change

```bash
cd ~/lec-crm
git add -A && git commit -m "describe the change"
git push origin main
bash scripts/deploy.sh
```

`deploy.sh` SSHes to EC2, pulls the new code, rebuilds the container.
Wait for "✓ Ready" in the logs (~2–3 minutes).

**NEVER run any of these directly on the EC2 — they will crash the server:**
```
# DO NOT RUN THESE:
docker compose build --no-cache   ← kills the server every time (OOM)
docker compose build              ← also risky without the deploy script
npm install / npm run build       ← not enough RAM on t3.small
```

The deploy script uses Docker layer caching which keeps memory usage low.
`--no-cache` discards all cached layers and rebuilds from scratch — the server
runs out of RAM and dies mid-build. Always use `bash scripts/deploy.sh`.

---

## EC2 management

### SSH in
```bash
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25
```

### Check containers
```bash
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25 'docker ps'
```
All three should show "Up": `lec-crm-app-1`, `lec-crm-caddy-1`, `lec-crm-db-1`

### Restart the app (after env change, not a code change)
```bash
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25 'cd /opt/lec-crm && docker compose restart app'
```

### View live app logs
```bash
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25 'docker compose -f /opt/lec-crm/docker-compose.yml logs -f app --tail 50'
```

### Reboot EC2 (if SSH fails / site is down)
```bash
aws ec2 reboot-instances --instance-ids i-05b7646efee508b07 --region ap-south-1
# Wait 60 seconds, then:
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25 'cd /opt/lec-crm && docker compose up -d'
```

### EC2 is OOM-killed (containers stop unexpectedly)
Check console output:
```bash
aws ec2 get-console-output --instance-id i-05b7646efee508b07 --region ap-south-1 --output text | tail -30
```
If you see "Out of memory: Kill process" → reboot as above. The EC2 has 2 GB swap pre-configured; it should recover automatically after reboot.

---

## Rollback a bad deploy

```bash
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25
cd /opt/lec-crm
git log --oneline -10          # find the last good commit SHA
git reset --hard <SHA>
docker compose build app && docker compose up -d app
docker compose logs -f app     # wait for "✓ Ready"
```

---

## WhatsApp stopped sending messages

**Most likely cause**: access token expired.

**Fix**:
1. Go to https://business.facebook.com/settings/system-users?business_id=3142025962748450
   (log in with LEC's Facebook account)
2. Click **lec_crm** system user → **Generate new token**
3. Select **LEC CRM** app
4. Tick: `whatsapp_business_messaging` + `whatsapp_business_management`
5. Copy the token (starts with `EAA...`)
6. Go to https://crm.lifeenergycentre.in/settings/whatsapp → paste → Save

**Note**: The Meta Business account is under **Mahesh Shah** — that is Papa's own Facebook account. Papa has full admin access and can always generate this token himself without needing Prateek.

---

## Razorpay stopped working

**Check**: go to https://crm.lifeenergycentre.in/settings/razorpay → click "Test connection"

If test fails:
- Keys may have been regenerated in Razorpay dashboard
- Go to dashboard.razorpay.com → Settings → API Keys → Generate Live Key
- Paste new Key ID + Secret at /settings/razorpay → Save → Test connection

**Webhook**: if payments aren't granting credits automatically, check the webhook:
- Razorpay Dashboard → Settings → Webhooks → the webhook URL should be `https://crm.lifeenergycentre.in/api/webhook/razorpay`
- If the webhook secret changed, regenerate it at /settings/razorpay → "Generate new" → paste the new secret into Razorpay

---

## Database backup

Backups run automatically every day at 21:00 UTC (02:30 IST) to S3 bucket `lec-crm-backups`.

To run a manual backup now:
```bash
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25 'bash /opt/lec-crm/scripts/backup-pg.sh'
```

To restore from backup:
```bash
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25 'sudo bash /opt/lec-crm/scripts/restore-pg.sh --latest'
```

---

## SSL certificate

Caddy renews SSL automatically — no action needed. The cert renews itself before expiry.
If the site shows "certificate error", restart Caddy:
```bash
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25 'docker compose -f /opt/lec-crm/docker-compose.yml restart caddy'
```

---

## Add a new staff member

1. Go to https://crm.lifeenergycentre.in/settings/users
2. Click "Invite user"
3. Fill in name, email, role
4. They receive a sign-in link by email (if email digest is configured) or Papa tells them to sign in

---

## Email digest not sending

1. Go to https://crm.lifeenergycentre.in/settings/email
2. Confirm status shows "Live — sending via Resend"
3. If showing "Demo mode": enter the Resend API key (get from resend.com/api-keys) and set Provider to "Resend"
4. Click "Send test to my email" to confirm it works

---

## Cron jobs on EC2

```bash
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25 'crontab -u ubuntu -l'
```

Should show 4 jobs: backup, reconciler, reminder, daily digest.

---

## Environment variables

Two locations:
- `~/.env.local` (Prateek's machine / local dev) — has AWS credentials, AUTH_SECRET, etc.
- `/opt/lec-crm/.env` (EC2 production) — has the same plus live secrets

To update a production env var:
```bash
ssh -i ~/.ssh/lec-aws.pem ubuntu@13.204.229.25 'echo "VAR_NAME=value" >> /opt/lec-crm/.env'
# Then restart the app container for it to take effect:
docker compose -f /opt/lec-crm/docker-compose.yml restart app
```

**Never rotate AUTH_SECRET** — it encrypts all WhatsApp/Razorpay tokens and TOTP secrets in the DB. Rotating it makes them all unrecoverable.

---

## AWS credentials (for EC2 management)

AWS CLI is configured on Prateek's machine with IAM user `claude-deployer` (account 397068653443, region `ap-south-1`).
Test it works: `aws sts get-caller-identity`

---

## Contacts / account ownership

| Account | Owner | Notes |
|---|---|---|
| AWS | Subhash Shah (Papa) — root email | root MFA not yet set up |
| GitHub (`shahprateek317/lec-crm`) | Prateek | Papa has read access via deploy key |
| Razorpay | LEC business account | Live keys in DB |
| Meta / Facebook app (LEC CRM) | Prateek's personal account (Mahesh Shah) | WhatsApp system user `lec_crm` |
| Resend (email) | TBC — configure at /settings/email |
| Domain `lifeenergycentre.in` | TBC — check registrar |

---

## Things that will NEVER need Prateek (Papa's Claude can handle alone)

- Deploying code changes
- EC2 reboots and container restarts
- Database operations (backup, restore, queries)
- Adding/removing staff users
- Updating Razorpay or email settings (if keys are available)
- Debugging app errors (logs + rollback)
- Building new features

## Things that will NEVER need Prateek

Nothing. The Meta Business account (Mahesh Shah) is Papa's own account.
Papa has full control over all integrations.

---

*If you've read this entire file and still can't solve the problem, it's probably something new. Describe the error clearly and Prateek can help in minutes.*
