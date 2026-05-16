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

## 12. Known limitations & follow-ups

- **No CI/CD** — deploys are manual rsync + rebuild. Acceptable for one-server, single-developer ops.
- **Single AZ** — no automatic failover. If `ap-south-1a` has issues, we're down. Adding a multi-AZ RDS + auto-scaling would 3-4× the bill and is overkill for this scale.
- **Image not tagged by SHA** — rollback requires identifying old image SHA manually. Easy improvement when desired.
- **No staging environment** — changes deploy direct to prod. Fine while we have low traffic; add staging when traffic justifies.
- **WhatsApp permanent token via System Users** — see /settings/whatsapp; deferred until Meta's display name approval clears.
- **Vercel deployment is still live** at `lec-crm.vercel.app`. Once this server is verified working, point dad's testing there and eventually decommission the Vercel deployment.
