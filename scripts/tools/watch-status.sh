#!/usr/bin/env bash
for i in $(seq 1 30); do
  s=$(gh api repos/shahprateek317/lec-crm/commits/main/status --jq ".state" 2>/dev/null)
  echo "$(date +%T) state=$s"
  if [ "$s" = "success" ] || [ "$s" = "failure" ]; then break; fi
  sleep 12
done
echo "---last status---"
gh api repos/shahprateek317/lec-crm/commits/main/status --jq ".statuses[0] | {state, description, target_url}"
