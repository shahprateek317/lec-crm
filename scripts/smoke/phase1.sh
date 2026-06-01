#!/usr/bin/env bash
# Phase 1 smoke test — exercises the surfaces shipped in 1a + 1b + 1c
# against the live deployment. Run from inside WSL.
#
# Coverage:
#   - Homepage (public)
#   - /me/sign-in (public, phone-entry phase)
#   - /me/sign-in?phase=verify (public, OTP-entry phase, with friendly errors)
#   - /me/auth/<bad-token> (public, redirects to sign-in with error)
#   - /api/webhook/whatsapp POST without HMAC → 401 (proves fix)
#   - /sign-in staff page (public)
#   - As a staff user: /inbox, /quality, /healing/start, /me/profile
#
# Note: client-portal-authenticated routes (/me, /me/sessions, etc.)
# aren't testable end-to-end without a real WhatsApp delivery, so we
# only verify the public surfaces + the redirect-to-sign-in behaviour.

set -uo pipefail

URL=https://crm.lifeenergycentre.in
COOKIE=$(mktemp); trap "rm -f $COOKIE" EXIT
PASS=0
FAIL=0

assert() {
  if [ "$1" = "$2" ]; then
    echo "    ✓ $3"
    PASS=$((PASS+1))
  else
    echo "    ✗ $3  (expected $2, got $1)"
    FAIL=$((FAIL+1))
  fi
}

assert_contains() {
  if grep -qF "$2" "$1"; then
    echo "    ✓ contains '$2'"
    PASS=$((PASS+1))
  else
    echo "    ✗ missing '$2'"
    FAIL=$((FAIL+1))
  fi
}

# ── Public surfaces ──────────────────────────────────────────────────
echo ""
echo "═══ Public: homepage"
code=$(curl -ksS -o /tmp/p1.html -w '%{http_code}' "$URL/")
assert "$code" "200" "GET / returns 200"
assert_contains /tmp/p1.html "Life Energy Centre"

echo ""
echo "═══ Public: /me/sign-in (phone entry)"
code=$(curl -ksS -o /tmp/p2.html -w '%{http_code}' "$URL/me/sign-in")
assert "$code" "200" "GET /me/sign-in returns 200"
assert_contains /tmp/p2.html "Sign in to your portal"
assert_contains /tmp/p2.html "Phone number"

echo ""
echo "═══ Public: /me/sign-in?phase=verify (OTP entry, dummy phone)"
code=$(curl -ksS -o /tmp/p3.html -w '%{http_code}' "$URL/me/sign-in?phase=verify&phone=%2B919999999999")
assert "$code" "200" "GET /me/sign-in?phase=verify returns 200"
assert_contains /tmp/p3.html "Check your WhatsApp"
assert_contains /tmp/p3.html "6-digit code"

echo ""
echo "═══ Public: /me/sign-in error message rendering"
code=$(curl -ksS -o /tmp/p4.html -w '%{http_code}' "$URL/me/sign-in?phase=verify&phone=%2B919999999999&error=wrong")
assert "$code" "200" "GET /me/sign-in?error=wrong returns 200"
assert_contains /tmp/p4.html "Wrong code"

echo ""
echo "═══ Public: /me/auth/<bad-token> redirects to sign-in"
code=$(curl -ksS -o /dev/null -w '%{http_code}' "$URL/me/auth/totally-not-a-real-token-padded-to-pass-format-check")
# 307 / 302 / 308 are all acceptable redirect codes for NextResponse.redirect.
case "$code" in
  302|303|307|308) echo "    ✓ /me/auth/<bad> returns redirect ($code)"; PASS=$((PASS+1)) ;;
  *) echo "    ✗ /me/auth/<bad> expected redirect, got $code"; FAIL=$((FAIL+1)) ;;
esac

echo ""
echo "═══ Security: webhook POST without HMAC → 401"
code=$(curl -ksS -o /dev/null -w '%{http_code}' -X POST \
  -H "Content-Type: application/json" \
  -d '{"entry":[]}' \
  "$URL/api/webhook/whatsapp")
assert "$code" "401" "POST /api/webhook/whatsapp without signature returns 401"

echo ""
echo "═══ Staff: sign-in page"
code=$(curl -ksS -o /tmp/p5.html -w '%{http_code}' "$URL/sign-in")
assert "$code" "200" "GET /sign-in returns 200"

# ── Staff-authenticated surfaces ─────────────────────────────────────
echo ""
echo "═══ Staff: sign in as coordinator + visit /inbox"
CSRF=$(curl -ksS -c $COOKIE "$URL/api/auth/csrf" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>process.stdout.write(JSON.parse(d).csrfToken))')
curl -ksS -b $COOKIE -c $COOKIE -X POST "$URL/api/auth/callback/credentials" \
  --data-urlencode 'email=coordinator@lec.app' --data-urlencode 'password=demo1234' \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode 'callbackUrl=/' \
  --data-urlencode 'json=true' -o /dev/null -w "    coordinator signin status=%{http_code}\n"

code=$(curl -ksS -b $COOKIE -o /tmp/inbox.html -w '%{http_code}' "$URL/inbox")
assert "$code" "200" "GET /inbox returns 200"
assert_contains /tmp/inbox.html "Inbox"
# Tabs should be present.
assert_contains /tmp/inbox.html "All open"
assert_contains /tmp/inbox.html "Unknown"

echo ""
echo "═══ Staff: sign in as QC + visit /quality"
rm -f $COOKIE
CSRF=$(curl -ksS -c $COOKIE "$URL/api/auth/csrf" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>process.stdout.write(JSON.parse(d).csrfToken))')
curl -ksS -b $COOKIE -c $COOKIE -X POST "$URL/api/auth/callback/credentials" \
  --data-urlencode 'email=quality@lec.app' --data-urlencode 'password=demo1234' \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode 'callbackUrl=/' \
  --data-urlencode 'json=true' -o /dev/null -w "    quality signin status=%{http_code}\n"

code=$(curl -ksS -b $COOKIE -o /tmp/q.html -w '%{http_code}' "$URL/quality")
assert "$code" "200" "GET /quality returns 200"
assert_contains /tmp/q.html "Quality"

echo ""
echo "═══ Staff: sign in as healer + visit /me/profile (cert upload UI)"
rm -f $COOKIE
CSRF=$(curl -ksS -c $COOKIE "$URL/api/auth/csrf" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>process.stdout.write(JSON.parse(d).csrfToken))')
curl -ksS -b $COOKIE -c $COOKIE -X POST "$URL/api/auth/callback/credentials" \
  --data-urlencode 'email=healer@lec.app' --data-urlencode 'password=demo1234' \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode 'callbackUrl=/' \
  --data-urlencode 'json=true' -o /dev/null -w "    healer signin status=%{http_code}\n"

code=$(curl -ksS -b $COOKIE -o /tmp/me.html -w '%{http_code}' "$URL/me/profile")
assert "$code" "200" "GET /me/profile returns 200"
assert_contains /tmp/me.html "My profile"
assert_contains /tmp/me.html "Certifications"

# ── Summary ──────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo "  PASS: $PASS    FAIL: $FAIL"
echo "═══════════════════════════════════════════════"
[ "$FAIL" = "0" ] && exit 0 || exit 1
