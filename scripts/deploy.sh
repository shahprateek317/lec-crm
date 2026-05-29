#!/usr/bin/env bash
# Deploy main branch to EC2 by pulling from GitHub on the server side.
#
# Use this script when your changes are already committed + pushed:
#   git add -A && git commit -m "..." && git push origin main
#   bash scripts/deploy.sh
#
# This is the default deploy path. It works from any OS with `ssh`
# (Linux, macOS, Windows Git Bash, WSL). No `rsync` required.
#
# For uncommitted-working-tree deploys (faster iteration during local
# development), use scripts/deploy-rsync.sh instead — that one needs
# `rsync` locally, which Windows doesn't ship with.

set -e

EIP=${EIP:-13.204.229.25}
KEY=${KEY:-$HOME/.ssh/lec-aws.pem}
REMOTE_DIR=${REMOTE_DIR:-/opt/lec-crm}

if [ ! -f "$KEY" ]; then
  echo "✗ SSH key not found at $KEY" >&2
  echo "   Set the KEY env var or copy your key to ~/.ssh/lec-aws.pem" >&2
  exit 1
fi

SSH="ssh -o StrictHostKeyChecking=accept-new -i $KEY"

echo "→ pulling latest main on EC2"
$SSH "ubuntu@$EIP" "cd $REMOTE_DIR && git pull origin main"

echo "→ building + restarting the app container (5–10 min on first run)"
$SSH "ubuntu@$EIP" "cd $REMOTE_DIR && sudo docker compose up -d --build 2>&1 | tail -20"

echo ""
echo "→ container status"
$SSH "ubuntu@$EIP" "cd $REMOTE_DIR && sudo docker compose ps"

echo ""
echo "→ tailing app logs for 30s to confirm boot..."
$SSH "ubuntu@$EIP" "cd $REMOTE_DIR && timeout 30 sudo docker compose logs -f --tail=40 app 2>&1 || true"

echo ""
echo "✓ deploy complete"
echo "  Run smoke tests: bash scripts/smoke/phase1.sh && bash scripts/smoke/phase2a.sh && bash scripts/smoke/phase2b.sh && bash scripts/smoke/phase2c.sh"
