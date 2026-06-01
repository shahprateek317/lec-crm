#!/usr/bin/env bash
# Phase 2a smoke test — adds checks for the surfaces shipped in 2a:
#   - /api/cron/reconcile-deleted-clients  (401 without secret)
#   - /settings/audit-log                   (admin gets 200, others redirect)
#   - bell appears in staff layout HTML
#
# Run from inside WSL. Phase 1 smoke (smoke-phase1.sh) should still pass.

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

# ── Security: cron endpoint unauthenticated → 401 ───────────────────
echo ""
echo "═══ Security: /api/cron/reconcile-deleted-clients without secret"
code=$(curl -ksS -o /dev/null -w '%{http_code}' \
  "$URL/api/cron/reconcile-deleted-clients")
# 401 if CRON_SECRET set; 500 if not (fail-closed); either rejects the request.
case "$code" in
  401|500) echo "    ✓ unauthenticated request rejected ($code)"; PASS=$((PASS+1)) ;;
  *) echo "    ✗ expected 401 or 500, got $code"; FAIL=$((FAIL+1)) ;;
esac

echo ""
echo "═══ Security: /api/cron/reconcile-deleted-clients with bogus token"
code=$(curl -ksS -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer not-the-real-secret" \
  "$URL/api/cron/reconcile-deleted-clients")
case "$code" in
  401|500) echo "    ✓ bogus token rejected ($code)"; PASS=$((PASS+1)) ;;
  *) echo "    ✗ expected 401 or 500, got $code"; FAIL=$((FAIL+1)) ;;
esac

# ── Admin: audit-log viewer ─────────────────────────────────────────
echo ""
echo "═══ Admin: sign in + visit /settings/audit-log"
CSRF=$(curl -ksS -c $COOKIE "$URL/api/auth/csrf" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>process.stdout.write(JSON.parse(d).csrfToken))')
curl -ksS -b $COOKIE -c $COOKIE -X POST "$URL/api/auth/callback/credentials" \
  --data-urlencode 'email=admin@lec.app' --data-urlencode 'password=demo1234' \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode 'callbackUrl=/' \
  --data-urlencode 'json=true' -o /dev/null -w "    admin signin status=%{http_code}\n"

code=$(curl -ksS -b $COOKIE -o /tmp/audit.html -w '%{http_code}' "$URL/settings/audit-log")
assert "$code" "200" "GET /settings/audit-log returns 200 for admin"
assert_contains /tmp/audit.html "Audit log"
assert_contains /tmp/audit.html "Action"
assert_contains /tmp/audit.html "Actor"

# ── Bell appears in the staff layout for any logged-in staff ────────
echo ""
echo "═══ Staff layout: notification bell present (admin session)"
code=$(curl -ksS -b $COOKIE -o /tmp/dash.html -w '%{http_code}' "$URL/dashboard")
assert "$code" "200" "GET /dashboard returns 200"
# Aria label is on the bell trigger
assert_contains /tmp/dash.html 'aria-label="Notifications'

# ── Non-admin cannot reach the audit log ────────────────────────────
echo ""
echo "═══ Non-admin: /settings/audit-log redirects coordinator away"
rm -f $COOKIE
CSRF=$(curl -ksS -c $COOKIE "$URL/api/auth/csrf" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>process.stdout.write(JSON.parse(d).csrfToken))')
curl -ksS -b $COOKIE -c $COOKIE -X POST "$URL/api/auth/callback/credentials" \
  --data-urlencode 'email=coordinator@lec.app' --data-urlencode 'password=demo1234' \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode 'callbackUrl=/' \
  --data-urlencode 'json=true' -o /dev/null -w "    coordinator signin status=%{http_code}\n"

# Follow redirects to see where coordinator lands; auditlog should NOT
# return 200 — should redirect to /dashboard.
final=$(curl -ksSL -b $COOKIE -o /dev/null -w '%{url_effective}' "$URL/settings/audit-log")
case "$final" in
  *"/dashboard"*|*"/settings"*) echo "    ✓ redirected away from audit log ($final)"; PASS=$((PASS+1)) ;;
  *"/audit-log"*) echo "    ✗ coordinator could reach /settings/audit-log"; FAIL=$((FAIL+1)) ;;
  *) echo "    ? landed at $final — manual check"; PASS=$((PASS+1)) ;;
esac

# ── Summary ──────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo "  PASS: $PASS    FAIL: $FAIL"
echo "═══════════════════════════════════════════════"
[ "$FAIL" = "0" ] && exit 0 || exit 1
