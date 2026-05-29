#!/usr/bin/env bash
# Phase 2c live smoke — TOTP 2FA settings page + admin soft-delete UI.
# We can't fully exercise the TOTP enroll flow over curl (it needs an
# authenticator app), so we verify surfaces + the auth allowlist behaviour.
set -uo pipefail
URL=https://crm.lifeenergycentre.in
COOKIE=$(mktemp); trap "rm -f $COOKIE" EXIT
PASS=0
FAIL=0

echo ""
echo "═══ /settings/security accessible to any signed-in staff"
# Sign in as healer (non-admin) and visit the security page.
CSRF=$(curl -ksS -c $COOKIE "$URL/api/auth/csrf" | python3 -c 'import json,sys;print(json.load(sys.stdin)["csrfToken"])')
curl -ksS -b $COOKIE -c $COOKIE -X POST "$URL/api/auth/callback/credentials" \
  --data-urlencode 'email=healer@lec.app' --data-urlencode 'password=demo1234' \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode 'callbackUrl=/' \
  --data-urlencode 'json=true' -o /dev/null -w "    healer signin status=%{http_code}\n"
code=$(curl -ksS -b $COOKIE -o /tmp/sec.html -w '%{http_code}' "$URL/settings/security")
if [ "$code" = "200" ]; then echo "    ✓ /settings/security 200 for healer"; PASS=$((PASS+1)); else echo "    ✗ got $code"; FAIL=$((FAIL+1)); fi
if grep -qF "Two-factor" /tmp/sec.html; then echo "    ✓ contains '2FA' wording"; PASS=$((PASS+1)); else echo "    ✗ missing"; FAIL=$((FAIL+1)); fi
if grep -qF "Set up two-factor" /tmp/sec.html; then echo "    ✓ shows 'Set up two-factor' CTA (state=off)"; PASS=$((PASS+1)); else echo "    ✗ missing CTA"; FAIL=$((FAIL+1)); fi

echo ""
echo "═══ Sign-in page renders without errors"
code=$(curl -ksS -o /tmp/si.html -w '%{http_code}' "$URL/sign-in")
if [ "$code" = "200" ]; then echo "    ✓ /sign-in 200"; PASS=$((PASS+1)); else echo "    ✗ got $code"; FAIL=$((FAIL+1)); fi
# Step-1 should NOT render the TOTP field
if grep -qF 'name="totpCode"' /tmp/si.html; then echo "    ✗ TOTP field shown on step 1 (should be hidden)"; FAIL=$((FAIL+1)); else echo "    ✓ TOTP field hidden on step 1"; PASS=$((PASS+1)); fi

echo ""
echo "═══ Sign-in page step-2 renders TOTP field when error=totp_required"
code=$(curl -ksS -o /tmp/si2.html -w '%{http_code}' "$URL/sign-in?error=totp_required&email=admin%40lec.app")
if [ "$code" = "200" ]; then echo "    ✓ /sign-in?error=totp_required 200"; PASS=$((PASS+1)); else echo "    ✗ got $code"; FAIL=$((FAIL+1)); fi
if grep -qF 'name="totpCode"' /tmp/si2.html; then echo "    ✓ TOTP field rendered on step 2"; PASS=$((PASS+1)); else echo "    ✗ TOTP field missing"; FAIL=$((FAIL+1)); fi
if grep -qF 'value="admin@lec.app"' /tmp/si2.html; then echo "    ✓ email pre-filled"; PASS=$((PASS+1)); else echo "    ✗ email not pre-filled"; FAIL=$((FAIL+1)); fi
if grep -qF 'readOnly' /tmp/si2.html || grep -qiF 'readonly' /tmp/si2.html; then echo "    ✓ email is readonly on step 2"; PASS=$((PASS+1)); else echo "    ✗ email not readonly"; FAIL=$((FAIL+1)); fi

echo ""
echo "═══ totp_invalid error banner"
code=$(curl -ksS -o /tmp/si3.html -w '%{http_code}' "$URL/sign-in?error=totp_invalid&email=admin%40lec.app")
if grep -qF "didn" /tmp/si3.html; then echo "    ✓ wrong-code message shown"; PASS=$((PASS+1)); else echo "    ✗ no wrong-code message"; FAIL=$((FAIL+1)); fi

echo ""
echo "═══ Admin /leads/[id] shows Danger zone (soft-delete UI)"
rm -f $COOKIE
CSRF=$(curl -ksS -c $COOKIE "$URL/api/auth/csrf" | python3 -c 'import json,sys;print(json.load(sys.stdin)["csrfToken"])')
curl -ksS -b $COOKIE -c $COOKIE -X POST "$URL/api/auth/callback/credentials" \
  --data-urlencode 'email=admin@lec.app' --data-urlencode 'password=demo1234' \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode 'callbackUrl=/' \
  --data-urlencode 'json=true' -o /dev/null -w "    admin signin status=%{http_code}\n"
# Find any client ID via /leads listing
leads_html=$(curl -ksS -b $COOKIE "$URL/leads")
client_id=$(echo "$leads_html" | grep -oE '/leads/[a-z0-9]{20,}' | head -1 | sed 's|/leads/||')
if [ -z "$client_id" ]; then
  echo "    ✗ no client id found via /leads — can't test danger zone"
  FAIL=$((FAIL+1))
else
  echo "    using client id: $client_id"
  code=$(curl -ksS -b $COOKIE -o /tmp/lead.html -w '%{http_code}' "$URL/leads/$client_id")
  if [ "$code" = "200" ]; then echo "    ✓ admin /leads/[id] 200"; PASS=$((PASS+1)); else echo "    ✗ got $code"; FAIL=$((FAIL+1)); fi
  if grep -qF "Danger zone" /tmp/lead.html; then echo "    ✓ Danger zone visible to admin"; PASS=$((PASS+1)); else echo "    ✗ Danger zone missing"; FAIL=$((FAIL+1)); fi
  if grep -qF "Soft-delete client" /tmp/lead.html; then echo "    ✓ soft-delete button present"; PASS=$((PASS+1)); else echo "    ✗ button missing"; FAIL=$((FAIL+1)); fi
fi

echo ""
echo "═══ Coordinator /leads/[id] hides Danger zone"
if [ -n "$client_id" ]; then
  rm -f $COOKIE
  CSRF=$(curl -ksS -c $COOKIE "$URL/api/auth/csrf" | python3 -c 'import json,sys;print(json.load(sys.stdin)["csrfToken"])')
  curl -ksS -b $COOKIE -c $COOKIE -X POST "$URL/api/auth/callback/credentials" \
    --data-urlencode 'email=coordinator@lec.app' --data-urlencode 'password=demo1234' \
    --data-urlencode "csrfToken=$CSRF" --data-urlencode 'callbackUrl=/' \
    --data-urlencode 'json=true' -o /dev/null -w "    coord signin status=%{http_code}\n"
  code=$(curl -ksS -b $COOKIE -o /tmp/lead_coord.html -w '%{http_code}' "$URL/leads/$client_id")
  if [ "$code" = "200" ]; then echo "    ✓ coordinator /leads/[id] 200"; PASS=$((PASS+1)); else echo "    ✗ got $code"; FAIL=$((FAIL+1)); fi
  if grep -qF "Danger zone" /tmp/lead_coord.html; then echo "    ✗ Danger zone leaked to coordinator"; FAIL=$((FAIL+1)); else echo "    ✓ Danger zone hidden from coordinator"; PASS=$((PASS+1)); fi
fi

echo ""
echo "═══ Security tile present on /settings (admin view)"
rm -f $COOKIE
CSRF=$(curl -ksS -c $COOKIE "$URL/api/auth/csrf" | python3 -c 'import json,sys;print(json.load(sys.stdin)["csrfToken"])')
curl -ksS -b $COOKIE -c $COOKIE -X POST "$URL/api/auth/callback/credentials" \
  --data-urlencode 'email=admin@lec.app' --data-urlencode 'password=demo1234' \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode 'callbackUrl=/' \
  --data-urlencode 'json=true' -o /dev/null -w "    admin signin status=%{http_code}\n"
code=$(curl -ksS -b $COOKIE -o /tmp/settings.html -w '%{http_code}' "$URL/settings")
if grep -qF 'href="/settings/security"' /tmp/settings.html; then echo "    ✓ Security tile present"; PASS=$((PASS+1)); else echo "    ✗ Security tile missing"; FAIL=$((FAIL+1)); fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  PASS: $PASS    FAIL: $FAIL"
echo "═══════════════════════════════════════════════"
[ "$FAIL" = "0" ] && exit 0 || exit 1
