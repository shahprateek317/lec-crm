#!/usr/bin/env bash
set -e
URL="${URL:-https://lec-crm.vercel.app}"
COOKIE=$(mktemp); trap "rm -f $COOKIE" EXIT

CSRF=$(curl -s -c "$COOKIE" "$URL/api/auth/csrf" | python3 -c 'import json,sys;print(json.load(sys.stdin)["csrfToken"])')
curl -s -b "$COOKIE" -c "$COOKIE" -X POST "$URL/api/auth/callback/credentials" \
  --data-urlencode "email=admin@lec.app" --data-urlencode "password=demo1234" \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode "callbackUrl=$URL/dashboard" \
  --data-urlencode "json=true" > /dev/null

curl -s -b "$COOKIE" -o /tmp/ms.html -w 'code=%{http_code} size=%{size_download}\n' "$URL/my-schedule"
echo "---first 60 lines---"
head -60 /tmp/ms.html
