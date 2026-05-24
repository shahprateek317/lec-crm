#!/usr/bin/env bash
# Install the nightly DPDP-reconciler cron entry on this EC2 host.
#
# What it does: 02:30 UTC (08:00 IST), POSTs the local app at
# /api/cron/reconcile-deleted-clients with CRON_SECRET. The route
# anonymizes Client rows past the 30-day tombstone and removes their
# documents from S3. See docs/UX_ARCHITECTURE.md §7.
#
# Idempotent — safe to run multiple times. Reads CRON_SECRET from
# /opt/lec-crm/.env so the cron line itself doesn't need to embed it.

set -e

ENV_FILE=/opt/lec-crm/.env
LOG=/var/log/lec-reconciler.log

if [ ! -f "$ENV_FILE" ]; then
  echo "✗ $ENV_FILE not found — are we on the EC2 host?" >&2
  exit 1
fi

# Inline shell that pulls CRON_SECRET from .env at run-time and curls
# the local app. Output is appended to the log; logrotate trims it.
CRON_LINE="30 2 * * * set -a; . $ENV_FILE; set +a; /usr/bin/curl -sS -H \"Authorization: Bearer \$CRON_SECRET\" http://127.0.0.1:3000/api/cron/reconcile-deleted-clients >> $LOG 2>&1"

sudo touch $LOG
sudo chown ubuntu:ubuntu $LOG

# Logrotate so the log doesn't grow forever.
sudo tee /etc/logrotate.d/lec-reconciler >/dev/null <<'EOF'
/var/log/lec-reconciler.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
}
EOF

# Install cron line if not present; replace any existing reconciler line.
( crontab -l 2>/dev/null | grep -v 'reconcile-deleted-clients' ; echo "$CRON_LINE" ) | crontab -

echo "✓ reconciler cron installed (runs daily 02:30 UTC / 08:00 IST)"
crontab -l | tail -3

echo ""
echo "→ to test now: set -a; . /opt/lec-crm/.env; set +a; curl -sS -H \"Authorization: Bearer \$CRON_SECRET\" http://127.0.0.1:3000/api/cron/reconcile-deleted-clients | jq ."
echo "→ to read log: tail -n 50 $LOG"
