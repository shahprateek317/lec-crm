#!/usr/bin/env bash
# Install the pre-session reminder cron entry on this EC2 host.
#
# What it does: every 10 minutes, POSTs the local app at
# /api/cron/send-session-reminders with CRON_SECRET. The route finds
# HealingSessions starting in 55–65 minutes (with reminderSentAt
# IS NULL) and sends the healing_reminder_1h WhatsApp template.
# Idempotent — re-sends won't happen because reminderSentAt is set
# on success.
#
# Why every 10 minutes (not exactly hourly):
#   The window is 10 minutes wide and we want every session in the
#   window to be reminded even if the cron lags slightly. Running
#   the cron at the same cadence as the window width means no
#   session falls between two runs. The "have we sent yet?" check
#   on each row is what keeps it idempotent.

set -e

ENV_FILE=/opt/lec-crm/.env
LOG=/var/log/lec-reminder.log

if [ ! -f "$ENV_FILE" ]; then
  echo "✗ $ENV_FILE not found — are we on the EC2 host?" >&2
  exit 1
fi

# Inline shell that pulls CRON_SECRET from .env at run-time and curls
# the local app. Output is appended to the log; logrotate trims it.
CRON_LINE="*/10 * * * * set -a; . $ENV_FILE; set +a; /usr/bin/curl -sS -H \"Authorization: Bearer \$CRON_SECRET\" http://127.0.0.1:3000/api/cron/send-session-reminders >> $LOG 2>&1"

sudo touch $LOG
sudo chown ubuntu:ubuntu $LOG

# Logrotate so the log doesn't grow forever.
sudo tee /etc/logrotate.d/lec-reminder >/dev/null <<'EOF'
/var/log/lec-reminder.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
}
EOF

# Install cron line if not present; replace any existing reminder line.
( crontab -l 2>/dev/null | grep -v 'send-session-reminders' ; echo "$CRON_LINE" ) | crontab -

echo "✓ reminder cron installed (runs every 10 minutes)"
crontab -l | tail -3

echo ""
echo "→ to test now: set -a; . /opt/lec-crm/.env; set +a; curl -sS -H \"Authorization: Bearer \$CRON_SECRET\" http://127.0.0.1:3000/api/cron/send-session-reminders | jq ."
echo "→ to read log: tail -n 50 $LOG"
