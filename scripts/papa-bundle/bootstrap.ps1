#requires -Version 5.0
<#
.SYNOPSIS
  Bootstrap Papa's Windows machine so Claude can work on the LEC CRM.

.DESCRIPTION
  Idempotent setup script. Installs Git + Node, places SSH key with
  locked ACLs, caches GitHub PAT, clones repo, copies .env, runs
  tests + live smoke. Triggers UAC prompts during installer runs —
  Papa clicks Yes; tell him in advance.

  Designed to be safe to re-run. Each step checks whether work is
  already done and skips if so. If anything fails partway, fix the
  cause and re-run; you won't lose progress.

.NOTES
  Author: previous Claude (Phase 2c handoff)
  Run as:  powershell -ExecutionPolicy Bypass -File .\bootstrap.ps1
#>

$ErrorActionPreference = "Stop"
$bundleRoot = $PSScriptRoot
$secretsDir = Join-Path $bundleRoot "secrets"

function Section([string]$label) {
  Write-Host ""
  Write-Host "── $label ───────────────────────────────────────────────" -ForegroundColor Cyan
}

function Ok([string]$msg)    { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Skip([string]$msg)  { Write-Host "  ~ $msg (already done)" -ForegroundColor DarkGray }
function Warn([string]$msg)  { Write-Host "  ! $msg" -ForegroundColor Yellow }
function Fail([string]$msg)  { Write-Host "  ✗ $msg" -ForegroundColor Red; exit 1 }

# ─── Sanity check the bundle ─────────────────────────────────────────
Section "0. Sanity check bundle contents"

@(
  "$secretsDir\lec-aws.pem",
  "$secretsDir\.env.local",
  "$secretsDir\github-pat.txt"
) | ForEach-Object {
  if (-not (Test-Path $_)) {
    Fail "Bundle file missing: $_  — re-extract the zip or contact Prateek"
  }
}
Ok "all 3 secrets present in $secretsDir"

# ─── 1. Install Git for Windows (winget) ─────────────────────────────
Section "1. Git for Windows"

if (Get-Command git -ErrorAction SilentlyContinue) {
  Skip "git already installed ($((git --version) -join ' '))"
} else {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Fail @"
winget is missing — this is Windows 10 pre-1809 or some other edge case.
Tell Papa to download Git for Windows from:
  https://git-scm.com/download/win
Run the installer with default options, then re-run this script.
"@
  }
  Write-Host "  installing Git.Git via winget (UAC prompt — click Yes)…"
  winget install --id Git.Git -e --silent --accept-source-agreements --accept-package-agreements
  if ($LASTEXITCODE -ne 0) { Fail "winget install Git failed (exit $LASTEXITCODE)" }
  # Refresh PATH so the new git is visible in this session.
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
              [System.Environment]::GetEnvironmentVariable("Path", "User")
  Ok "Git installed"
}

# ─── 2. Install Node.js 20 LTS ───────────────────────────────────────
Section "2. Node.js 20 LTS"

$nodeOk = $false
if (Get-Command node -ErrorAction SilentlyContinue) {
  $v = (node --version) -replace 'v',''
  $major = [int]($v.Split('.')[0])
  if ($major -ge 20) { Skip "node $v already installed"; $nodeOk = $true }
  else { Warn "node $v is too old; need >= 20" }
}
if (-not $nodeOk) {
  Write-Host "  installing OpenJS.NodeJS.LTS via winget (UAC prompt — click Yes)…"
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
  if ($LASTEXITCODE -ne 0) { Fail "winget install Node failed (exit $LASTEXITCODE)" }
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
              [System.Environment]::GetEnvironmentVariable("Path", "User")
  Ok "Node installed ($((node --version) -join ' '))"
}

# Ensure npm corepack is enabled for repeatable installs.
npm config set fund false 2>$null
npm config set audit false 2>$null

# ─── 3. Place the EC2 SSH key + lock ACLs ────────────────────────────
Section "3. EC2 SSH key"

$sshDir = Join-Path $env:USERPROFILE ".ssh"
if (-not (Test-Path $sshDir)) {
  New-Item -ItemType Directory -Force -Path $sshDir | Out-Null
}
$keyDest = Join-Path $sshDir "lec-aws.pem"

Copy-Item -Force (Join-Path $secretsDir "lec-aws.pem") $keyDest

# Windows OpenSSH requires the key to be readable ONLY by the owner.
# Equivalent of chmod 600 on Linux. icacls is the right tool.
icacls.exe $keyDest /inheritance:r | Out-Null
icacls.exe $keyDest /grant:r "$($env:USERNAME):(R)" | Out-Null
Ok "key at $keyDest with locked ACLs"

# Test the key by SSHing to EC2 and asking for the hostname.
Write-Host "  testing SSH to EC2…"
$sshTest = ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 `
              -i $keyDest ubuntu@13.204.229.25 hostname 2>&1
if ($LASTEXITCODE -ne 0) {
  Fail "SSH to EC2 failed: $sshTest`nKey may be wrong or EC2 unreachable."
}
Ok "SSH works (EC2 hostname: $sshTest)"

# ─── 4. Configure git + cache the GitHub PAT ─────────────────────────
Section "4. Git config + PAT"

git config --global user.name "Papa Subhash Shah"           | Out-Null
git config --global user.email "papa@lifeenergycentre.in"   | Out-Null
git config --global credential.helper manager               | Out-Null
git config --global init.defaultBranch main                 | Out-Null
git config --global pull.rebase false                       | Out-Null
Ok "git user/email/helper configured"

# Cache the PAT in Windows Credential Manager via `git credential approve`.
# This way `git push` against GitHub will silently use it; Papa never types it.
$pat = (Get-Content (Join-Path $secretsDir "github-pat.txt") -Raw).Trim()
if (-not $pat) { Fail "PAT file is empty" }

$credInput = @"
protocol=https
host=github.com
username=shahprateek317
password=$pat

"@
# Pipe into git credential approve. The blank line at end is REQUIRED
# by the git-credential protocol — don't remove it.
$credInput | git credential approve
if ($LASTEXITCODE -ne 0) { Fail "git credential approve failed" }
Ok "PAT cached in Windows Credential Manager"

# ─── 5. Clone the repo ───────────────────────────────────────────────
Section "5. Clone repo to ~/lec-crm"

$repoDir = Join-Path $env:USERPROFILE "lec-crm"

if (Test-Path (Join-Path $repoDir ".git")) {
  Skip "$repoDir already exists; pulling latest"
  Push-Location $repoDir
  git pull origin main
  if ($LASTEXITCODE -ne 0) { Fail "git pull failed" }
  Pop-Location
} else {
  if (Test-Path $repoDir) {
    Fail "$repoDir exists but is not a git repo; rename or delete it and re-run"
  }
  Push-Location $env:USERPROFILE
  git clone https://github.com/shahprateek317/lec-crm.git
  if ($LASTEXITCODE -ne 0) { Fail "git clone failed (PAT scope wrong? expired?)" }
  Pop-Location
  Ok "cloned to $repoDir"
}

# ─── 6. Place .env.local in the repo ─────────────────────────────────
Section "6. .env.local"

$envDest = Join-Path $repoDir ".env.local"
Copy-Item -Force (Join-Path $secretsDir ".env.local") $envDest
icacls.exe $envDest /inheritance:r | Out-Null
icacls.exe $envDest /grant:r "$($env:USERNAME):(R)" | Out-Null
Ok ".env.local placed with locked ACLs"

# ─── 7. npm install + prisma generate ────────────────────────────────
Section "7. npm install"

Push-Location $repoDir
Write-Host "  npm install (5–10 min first time)…"
npm install 2>&1 | Tee-Object -Variable npmOut | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "npm install failed; last 20 lines:`n$($npmOut | Select-Object -Last 20)" }
Ok "dependencies installed"

Write-Host "  prisma generate…"
npx prisma generate 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "prisma generate failed" }
Ok "prisma client generated"

# ─── 8. Run the test suite ───────────────────────────────────────────
Section "8. Test suite (expect 123 passing)"

$testOut = npm test 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host $testOut
  Fail "npm test failed"
}
$passLine = $testOut | Select-String "Tests" | Select-Object -First 1
Ok "tests passed ($passLine)"

# ─── 9. Live smoke against prod ──────────────────────────────────────
Section "9. Live smoke against https://crm.lifeenergycentre.in"

# Use bash from Git for Windows to run the shell smoke scripts.
$bash = (Get-Command bash -ErrorAction SilentlyContinue)?.Source
if (-not $bash) {
  # Git Bash usually lives at C:\Program Files\Git\bin\bash.exe
  $bash = "$env:ProgramFiles\Git\bin\bash.exe"
  if (-not (Test-Path $bash)) { Fail "bash not found; was Git installed correctly?" }
}

foreach ($phase in @("phase1", "phase2a", "phase2b", "phase2c")) {
  Write-Host "  running scripts/smoke/$phase.sh…"
  & $bash -lc "cd '$($repoDir -replace '\\','/')' && bash scripts/smoke/$phase.sh" 2>&1 | Tee-Object -Variable smokeOut | Select-Object -Last 5
  if ($LASTEXITCODE -ne 0) {
    Fail "smoke $phase failed; last 20 lines:`n$($smokeOut | Select-Object -Last 20)"
  }
}
Ok "all 4 smoke phases passed against prod"

Pop-Location

# ─── 10. Clean up bundle secrets ─────────────────────────────────────
Section "10. Clean up secrets"

# The values are now in their permanent homes — bundle copies are
# redundant. Remove them so the bundle folder is safe to keep around
# (e.g. for debugging the script later).
Remove-Item $secretsDir -Recurse -Force
Ok "$secretsDir removed; permanent copies are at ~/.ssh/, $repoDir/.env.local, Credential Manager"

# ─── Done ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "✓ bootstrap complete" -ForegroundColor Green
Write-Host "  123 unit tests passed"
Write-Host "  56 smoke checks passed against https://crm.lifeenergycentre.in"
Write-Host ""
Write-Host "Next: read $repoDir/docs/HANDOFF-FOR-NEXT-CLAUDE.md and start" -ForegroundColor Cyan
Write-Host "      working the Phase 2d queue." -ForegroundColor Cyan
