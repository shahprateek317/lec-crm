#!/usr/bin/env bash
# LEC CRM — restore Postgres from an S3 backup.
#
# Usage:
#   List backups:
#     scripts/restore-pg.sh --list
#   Restore latest:
#     scripts/restore-pg.sh --latest
#   Restore specific:
#     scripts/restore-pg.sh daily/2026-05-17_213000Z.sql.gz
#
# ⚠️ Restore DROPS existing data — the dump uses --clean --if-exists. Confirm
# before running in any environment with real data.

set -euo pipefail
cd /opt/lec-crm
BUCKET="lec-crm-backups-397068653443"
AWS=$(command -v aws)

set -a; . ./.env; set +a

case "${1:-}" in
  --list)
    echo "Backups in s3://$BUCKET/daily/ (most recent first):"
    $AWS s3 ls "s3://$BUCKET/daily/" --recursive | sort -r | head -30
    exit 0
    ;;
  --latest)
    KEY=$($AWS s3 ls "s3://$BUCKET/daily/" --recursive | sort -r | head -1 | awk '{print $4}')
    if [ -z "$KEY" ]; then echo "No backups found." >&2; exit 1; fi
    ;;
  "")
    echo "Usage: $0 [--list | --latest | <key>]" >&2
    exit 1
    ;;
  *)
    KEY="$1"
    ;;
esac

TMP=/tmp/lec-restore-$$.sql.gz
echo "→ downloading s3://$BUCKET/$KEY"
$AWS s3 cp "s3://$BUCKET/$KEY" "$TMP"

read -p "About to restore '$KEY' into '${POSTGRES_DB:-lec_crm}' — this WILL drop existing data. Continue? [y/N] " ok
case "$ok" in
  y|Y|yes|YES) ;;
  *) echo "Aborted."; rm -f "$TMP"; exit 1 ;;
esac

echo "→ restoring (this may take a minute)"
gunzip -c "$TMP" | docker compose exec -T db psql -U "${POSTGRES_USER:-lec}" -d "${POSTGRES_DB:-lec_crm}"

rm -f "$TMP"
echo "✓ restore complete"
