#!/usr/bin/env bash
set -e
URL="${URL:-https://lec-crm.vercel.app}"
COOKIE=$(mktemp); trap "rm -f $COOKIE" EXIT

echo "→ Wait for csrf"
for _ in $(seq 1 40); do
  body=$(curl -s -c "$COOKIE" "$URL/api/auth/csrf")
  if echo "$body" | grep -q csrfToken; then break; fi
  sleep 8
done

CSRF=$(echo "$body" | python3 -c 'import json,sys;print(json.load(sys.stdin)["csrfToken"])')
curl -s -b "$COOKIE" -c "$COOKIE" -X POST "$URL/api/auth/callback/credentials" \
  --data-urlencode "email=admin@lec.app" \
  --data-urlencode "password=demo1234" \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "callbackUrl=$URL/dashboard" \
  --data-urlencode "json=true" > /dev/null

check() {
  local label=$1 url=$2; shift 2
  local html
  html=$(curl -s -b "$COOKIE" "$url")
  echo "=== $label ($url) ==="
  for marker in "$@"; do
    if echo "$html" | grep -qF "$marker"; then echo "  ✓ $marker"; else echo "  ✗ $marker"; fi
  done
}

# Wait for new deploy markers (kanban / command palette)
for _ in $(seq 1 24); do
  if curl -s -b "$COOKIE" "$URL/leads?view=board" | grep -q "kanban"; then break; fi
  if curl -s -b "$COOKIE" "$URL/dashboard" | grep -q "Press"; then break; fi
  sleep 10
done

check "Dashboard"               "$URL/dashboard" "Welcome," "Funnel" "Set up your centre"
check "Leads list"              "$URL/leads" "Add lead" "Filter" "List" "Board"
check "Leads kanban"            "$URL/leads?view=board" "data-slot" "min-w-max" "draggable"
check "Counselling new"         "$URL/leads/cmo8o242w000146t8ob6cp6fs/counselling/new" "Suggested for this client" "Pick a date"
check "Search clients API"      "$URL/api/search/clients?q=demo" "results"
check "WhatsApp settings"       "$URL/settings/whatsapp" "Webhook URL" "Test connection"

# Verify ⌘K hint visible on dashboard
echo ""
echo "=== ⌘K hint visible ==="
if curl -s -b "$COOKIE" "$URL/dashboard" | grep -q "Press"; then echo "  ✓ Hint rendered"; else echo "  ✗ Hint missing"; fi
