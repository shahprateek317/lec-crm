#!/usr/bin/env bash
URL="${URL:-https://lec-crm.vercel.app}"
KNOWN="54z3R8TMwkxT4obnRvBO8"
for i in $(seq 1 30); do
  BID=$(curl -s "$URL/sign-in" | grep -oE '"b":"[A-Za-z0-9]+"' | head -1 | cut -d'"' -f4)
  echo "$(date +%T) build=$BID"
  if [ -n "$BID" ] && [ "$BID" != "$KNOWN" ]; then
    echo "→ new build deployed"
    exit 0
  fi
  sleep 20
done
echo "→ timeout waiting for new build"
exit 1
