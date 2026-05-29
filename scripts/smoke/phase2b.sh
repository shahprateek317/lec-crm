#!/usr/bin/env bash
# Phase 2b live smoke — reminder cron, /me/documents, /my-earnings.
set -uo pipefail
URL=https://crm.lifeenergycentre.in
COOKIE=$(mktemp); trap "rm -f $COOKIE" EXIT
PASS=0
FAIL=0

echo ""
echo "═══ Reminder cron without secret → 401/500"
code=$(curl -ksS -o /dev/null -w '%{http_code}' "$URL/api/cron/send-session-reminders")
case "$code" in
  401|500) echo "    ✓ unauth rejected ($code)"; PASS=$((PASS+1)) ;;
  *) echo "    ✗ got $code"; FAIL=$((FAIL+1)) ;;
esac

echo ""
echo "═══ Reminder cron with bogus token → 401/500"
code=$(curl -ksS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer bogus" "$URL/api/cron/send-session-reminders")
case "$code" in
  401|500) echo "    ✓ bogus rejected ($code)"; PASS=$((PASS+1)) ;;
  *) echo "    ✗ got $code"; FAIL=$((FAIL+1)) ;;
esac

echo ""
echo "═══ Healer sign-in + /my-earnings"
CSRF=$(curl -ksS -c $COOKIE "$URL/api/auth/csrf" | python3 -c 'import json,sys;print(json.load(sys.stdin)["csrfToken"])')
curl -ksS -b $COOKIE -c $COOKIE -X POST "$URL/api/auth/callback/credentials" \
  --data-urlencode 'email=healer@lec.app' --data-urlencode 'password=demo1234' \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode 'callbackUrl=/' \
  --data-urlencode 'json=true' -o /dev/null -w "    healer signin status=%{http_code}\n"
code=$(curl -ksS -b $COOKIE -o /tmp/earn.html -w '%{http_code}' "$URL/my-earnings")
if [ "$code" = "200" ]; then echo "    ✓ GET /my-earnings → 200"; PASS=$((PASS+1)); else echo "    ✗ got $code"; FAIL=$((FAIL+1)); fi
if grep -qF "My earnings" /tmp/earn.html; then echo "    ✓ contains 'My earnings'"; PASS=$((PASS+1)); else echo "    ✗ missing 'My earnings'"; FAIL=$((FAIL+1)); fi
if grep -qF "This month" /tmp/earn.html; then echo "    ✓ contains 'This month' bucket"; PASS=$((PASS+1)); else echo "    ✗ missing buckets"; FAIL=$((FAIL+1)); fi

echo ""
echo "═══ Coordinator denied /my-earnings"
rm -f $COOKIE
CSRF=$(curl -ksS -c $COOKIE "$URL/api/auth/csrf" | python3 -c 'import json,sys;print(json.load(sys.stdin)["csrfToken"])')
curl -ksS -b $COOKIE -c $COOKIE -X POST "$URL/api/auth/callback/credentials" \
  --data-urlencode 'email=coordinator@lec.app' --data-urlencode 'password=demo1234' \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode 'callbackUrl=/' \
  --data-urlencode 'json=true' -o /dev/null -w "    coord signin status=%{http_code}\n"
final=$(curl -ksS -b $COOKIE -o /dev/null -w '%{url_effective}' -L "$URL/my-earnings")
case "$final" in
  *dashboard*) echo "    ✓ coordinator redirected away from /my-earnings"; PASS=$((PASS+1)) ;;
  *) echo "    ✗ coord landed at $final"; FAIL=$((FAIL+1)) ;;
esac

echo ""
echo "═══ /me/documents requires client sign-in"
# Next.js streams the layout then aborts the page with a NEXT_REDIRECT
# template marker. curl -L doesn't follow that, but the body is still
# proof: page content isn't rendered, redirect target is encoded.
body=$(curl -ksS -c /dev/null -b /dev/null "$URL/me/documents")
if echo "$body" | grep -qF "NEXT_REDIRECT;replace;/me/sign-in?next=%2Fme%2Fdocuments"; then
  echo "    ✓ unauth /me/documents → NEXT_REDIRECT to /me/sign-in"
  PASS=$((PASS+1))
else
  echo "    ✗ no redirect marker found"
  FAIL=$((FAIL+1))
fi
if echo "$body" | grep -qF "Upload a medical report"; then
  echo "    ✗ page content leaked (uploader rendered without auth)"
  FAIL=$((FAIL+1))
else
  echo "    ✓ page content not rendered for anon user"
  PASS=$((PASS+1))
fi

echo ""
echo "═══ /api/me/documents/[bogus] requires client sign-in"
# API route uses NextResponse — should issue an actual HTTP redirect
# (302/307) for unauth. Without -L we see the raw status.
code=$(curl -ksS -o /dev/null -w '%{http_code}' "$URL/api/me/documents/totally-not-real-id")
case "$code" in
  302|303|307|308) echo "    ✓ unauth /api/me/documents → redirect ($code)"; PASS=$((PASS+1)) ;;
  401|403)         echo "    ✓ unauth /api/me/documents → $code (also acceptable)"; PASS=$((PASS+1)) ;;
  *)               echo "    ✗ got $code"; FAIL=$((FAIL+1)) ;;
esac

echo ""
echo "═══════════════════════════════════════════════"
echo "  PASS: $PASS    FAIL: $FAIL"
echo "═══════════════════════════════════════════════"
[ "$FAIL" = "0" ] && exit 0 || exit 1
