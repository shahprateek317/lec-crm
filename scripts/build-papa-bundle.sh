#!/usr/bin/env bash
# Assemble the encrypted bundle that Papa receives via WhatsApp.
#
# Run from Prateek's machine (WSL Ubuntu). Produces a single zip
# containing everything Papa's Claude needs to bootstrap autonomously.
# After Papa receives it, extracts it, and points Claude Code at the
# folder, Claude reads BOOTSTRAP-INSTRUCTIONS.md and runs bootstrap.ps1
# to set up the entire dev environment.
#
# This script is idempotent — re-run to rebuild.

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────
LEC_REPO="${LEC_REPO:-$HOME/lec-crm}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/lec-aws.pem}"
EC2_EIP="${EC2_EIP:-13.204.229.25}"
OUT_DIR="${OUT_DIR:-$HOME/papa-bundle}"
OUT_ZIP="${OUT_ZIP:-$HOME/papa-bundle.zip}"

# ─── Sanity checks ────────────────────────────────────────────────────
[ -d "$LEC_REPO" ]    || { echo "✗ Repo missing at $LEC_REPO"; exit 1; }
[ -f "$SSH_KEY" ]     || { echo "✗ SSH key missing at $SSH_KEY"; exit 1; }
command -v scp >/dev/null || { echo "✗ Need 'scp' command"; exit 1; }
# Zip step uses python3's zipfile module to avoid a sudo dependency
# on minimal WSL/EC2 installs. Falls back to the `zip` binary if py3
# is missing.
HAVE_PYTHON_ZIP=$(command -v python3 >/dev/null && python3 -c 'import zipfile' 2>/dev/null && echo yes || echo no)
HAVE_ZIP_BIN=$(command -v zip >/dev/null && echo yes || echo no)
if [ "$HAVE_PYTHON_ZIP" = "no" ] && [ "$HAVE_ZIP_BIN" = "no" ]; then
  echo "✗ Need either python3 + zipfile, or the 'zip' binary"; exit 1
fi

# ─── Prompt for the fine-grained PAT ──────────────────────────────────
# We do NOT keep this PAT on disk between bundle builds. Prateek pastes
# a fresh one each time; we drop it into the bundle, ship, then it
# never touches Prateek's machine again.
#
# Generate one at:
#   https://github.com/settings/personal-access-tokens
# Fine-grained, 90-day expiry, scoped to shahprateek317/lec-crm,
# Contents=Read+Write, Pull requests=Read+Write.

echo ""
echo "→ Paste your fresh fine-grained GitHub PAT for shahprateek317/lec-crm"
echo "  (input is hidden; press Enter when done)"
read -rs GITHUB_PAT
echo ""
[ -n "$GITHUB_PAT" ] || { echo "✗ Empty PAT"; exit 1; }

# ─── Build the bundle directory ───────────────────────────────────────
echo "→ rebuilding $OUT_DIR from scratch"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"/{secrets,docs}

# Copy the SSH key
echo "→ copying SSH key"
cp "$SSH_KEY" "$OUT_DIR/secrets/lec-aws.pem"
chmod 600 "$OUT_DIR/secrets/lec-aws.pem"

# Fetch the live .env from EC2 (always pull fresh so it matches prod)
echo "→ fetching .env.local from EC2"
scp -q -o StrictHostKeyChecking=accept-new -i "$SSH_KEY" \
  "ubuntu@$EC2_EIP:/opt/lec-crm/.env" \
  "$OUT_DIR/secrets/.env.local"
chmod 600 "$OUT_DIR/secrets/.env.local"

# Drop the PAT in
echo "→ writing PAT"
printf '%s' "$GITHUB_PAT" > "$OUT_DIR/secrets/github-pat.txt"
chmod 600 "$OUT_DIR/secrets/github-pat.txt"

# Copy the reference docs
echo "→ copying docs"
cp "$LEC_REPO/docs/HANDOFF-FOR-NEXT-CLAUDE.md" "$OUT_DIR/docs/"
cp "$LEC_REPO/docs/HANDOVER.md"                "$OUT_DIR/docs/"
cp "$LEC_REPO/docs/UX_ARCHITECTURE.md"         "$OUT_DIR/docs/"

# Bundle the templates (README.txt + BOOTSTRAP-INSTRUCTIONS.md + bootstrap.ps1)
echo "→ copying bundle templates"
cp "$LEC_REPO/scripts/papa-bundle/README.txt"               "$OUT_DIR/"
cp "$LEC_REPO/scripts/papa-bundle/BOOTSTRAP-INSTRUCTIONS.md" "$OUT_DIR/"
cp "$LEC_REPO/scripts/papa-bundle/bootstrap.ps1"            "$OUT_DIR/"

# ─── Zip it up ────────────────────────────────────────────────────────
echo "→ zipping to $OUT_ZIP"
rm -f "$OUT_ZIP"
if [ "$HAVE_PYTHON_ZIP" = "yes" ]; then
  python3 - <<PY
import os, zipfile, pathlib
src = pathlib.Path(r"$OUT_DIR")
out = pathlib.Path(r"$OUT_ZIP")
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for p in src.rglob("*"):
        if p.is_file():
            z.write(p, src.name + "/" + str(p.relative_to(src)).replace(os.sep, "/"))
print("zipped", out, "with", len(list(src.rglob('*'))), "entries")
PY
else
  ( cd "$(dirname "$OUT_DIR")" && zip -r "$OUT_ZIP" "$(basename "$OUT_DIR")" >/dev/null )
fi

SIZE=$(du -h "$OUT_ZIP" | cut -f1)
echo ""
echo "✓ bundle ready: $OUT_ZIP ($SIZE)"
echo ""
echo "Next steps:"
echo "  1. Send $OUT_ZIP to Papa via WhatsApp (E2E encrypted)."
echo "  2. Tell him to download + extract to his Desktop, then open"
echo "     Claude Code in the extracted folder."
echo "  3. He pastes the single line from README.txt into Claude."
echo "  4. Once Claude reports 'bootstrap complete', delete the"
echo "     WhatsApp message + the zip on Papa's machine."
echo ""
echo "Working bundle dir kept at $OUT_DIR for inspection. Wipe it"
echo "with 'rm -rf $OUT_DIR' once you've confirmed the zip works."
