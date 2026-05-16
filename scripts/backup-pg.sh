#!/usr/bin/env bash
# LEC CRM — daily Postgres backup to S3.
#
# Runs on the EC2 host (NOT inside a container).
# Uses the EC2 instance profile for AWS credentials (no keys on disk).
#
# Cron entry (installed by scripts/install-backup-cron.sh):
#   0 21 * * * /opt/lec-crm/scripts/backup-pg.sh >> /var/log/lec-backup.log 2>&1
# (21:00 UTC = 02:30 IST — runs daily during low-traffic hours.)

set -euo pipefail

cd /opt/lec-crm
BUCKET="lec-crm-backups-397068653443"
STAMP=$(date -u +%Y-%m-%d_%H%M%SZ)
TMP=/tmp/lec-pg-${STAMP}.sql.gz

# Load .env for POSTGRES_USER / POSTGRES_DB
set -a; . ./.env; set +a

echo "[$(date -Is)] → dumping database via compose"
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-lec}" -d "${POSTGRES_DB:-lec_crm}" \
  --no-owner --no-acl --clean --if-exists \
  | gzip -9 > "$TMP"

SIZE=$(du -h "$TMP" | cut -f1)
echo "[$(date -Is)] ✓ dump complete: $TMP ($SIZE)"

# Find AWS CLI (could be /usr/bin/aws or /usr/local/bin/aws depending on install).
AWS=$(command -v aws || echo "/usr/local/bin/aws")
if [ ! -x "$AWS" ]; then
  # Install AWS CLI v2 if missing (first-run convenience).
  # Invoked via `sudo bash ./aws/install` because /tmp is sometimes mounted
  # noexec, which makes direct shebang invocation fail with "command not found".
  echo "[$(date -Is)] → AWS CLI not found, installing v2..."
  cd /tmp
  rm -rf aws awscliv2.zip
  curl -sSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
  python3 -c 'import zipfile; zipfile.ZipFile("awscliv2.zip").extractall(".")'
  find aws -name 'aws*' -type f -exec chmod +x {} \;
  sudo bash ./aws/install --update 2>&1 | tail -3
  cd /opt/lec-crm
  AWS=/usr/local/bin/aws
fi

KEY="daily/${STAMP}.sql.gz"
echo "[$(date -Is)] → uploading to s3://$BUCKET/$KEY"
$AWS s3 cp "$TMP" "s3://$BUCKET/$KEY" \
  --storage-class STANDARD_IA \
  --metadata "host=$(hostname),size=$SIZE"

rm -f "$TMP"
echo "[$(date -Is)] ✓ backup complete"

# Sanity check: list the 5 most recent backups so the log shows retention.
echo "[$(date -Is)] → recent backups:"
$AWS s3 ls "s3://$BUCKET/daily/" --recursive | sort -r | head -5
