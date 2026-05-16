#!/usr/bin/env bash
# Install the daily Postgres-backup cron entry on this EC2 host.
# Idempotent — safe to run multiple times.

set -e

CRON_LINE="0 21 * * * cd /opt/lec-crm && /opt/lec-crm/scripts/backup-pg.sh >> /var/log/lec-backup.log 2>&1"
LOG=/var/log/lec-backup.log

sudo touch $LOG
sudo chown ubuntu:ubuntu $LOG

# Add a logrotate config so the log doesn't grow forever.
sudo tee /etc/logrotate.d/lec-backup >/dev/null <<'EOF'
/var/log/lec-backup.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
}
EOF

# Install cron line if not present.
( crontab -l 2>/dev/null | grep -v 'backup-pg.sh' ; echo "$CRON_LINE" ) | crontab -

echo "✓ backup cron installed (runs daily 21:00 UTC / 02:30 IST)"
crontab -l | tail -5

echo ""
echo "→ to test: ssh in and run /opt/lec-crm/scripts/backup-pg.sh manually"
echo "→ to list backups: /opt/lec-crm/scripts/restore-pg.sh --list"
