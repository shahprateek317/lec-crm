#!/usr/bin/env bash
# Install the daily email digest cron entry on this EC2 host.
#
# Runs at 02:30 UTC (08:00 IST) — same window as the reconciler.
# POSTs /api/cron/send-daily-digest with CRON_SECRET.
# Idempotent: existing digest line is replaced.

set -e

ENV_FILE=/opt/lec-crm/.env
LOG=/var/log/lec-digest.log

if [ ! -f "$ENV_FILE" ]; then
  echo "✗ $ENV_FILE not found — are we on the EC2 host?" >&2
  exit 1
fi

CRON_LINE="30 2 * * * set -a; . $ENV_FILE; set +a; /usr/bin/curl -sS -H \"Authorization: Bearer \$CRON_SECRET\" http://127.0.0.1:3000/api/cron/send-daily-digest >> $LOG 2>&1"

sudo touch $LOG
sudo chown ubuntu:ubuntu $LOG

sudo tee /etc/logrotate.d/lec-digest >/dev/null <<'EOF'
/var/log/lec-digest.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
}
EOF

( crontab -l 2>/dev/null | grep -v 'send-daily-digest' ; echo "$CRON_LINE" ) | crontab -

echo "✓ digest cron installed (runs daily at 02:30 UTC / 08:00 IST)"
crontab -l | grep digest

echo ""
echo "→ to test now: set -a; . /opt/lec-crm/.env; set +a; curl -sS -H \"Authorization: Bearer \$CRON_SECRET\" http://127.0.0.1:3000/api/cron/send-daily-digest | jq ."
echo "→ to read log: tail -n 50 $LOG"
