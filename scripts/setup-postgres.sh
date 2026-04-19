#!/usr/bin/env bash
# One-time Postgres setup for local development.
# Run this ONCE in WSL Ubuntu: bash scripts/setup-postgres.sh
# You will be prompted for your sudo password.
set -euo pipefail

echo "==> Installing PostgreSQL 16..."
sudo apt-get update -qq
sudo apt-get install -y postgresql postgresql-contrib

echo "==> Starting PostgreSQL service..."
sudo service postgresql start

echo "==> Creating database and user for lec-crm..."
sudo -u postgres psql <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lec_crm') THEN
    CREATE ROLE lec_crm WITH LOGIN PASSWORD 'lec_crm_dev_password';
  END IF;
END$$;

SELECT 'CREATE DATABASE lec_crm OWNER lec_crm'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lec_crm')\gexec

GRANT ALL PRIVILEGES ON DATABASE lec_crm TO lec_crm;
ALTER ROLE lec_crm CREATEDB;
SQL

echo "==> Enabling Postgres autostart on WSL shell login..."
if ! grep -q "service postgresql start" ~/.bashrc; then
  cat >> ~/.bashrc <<'BASHRC'

# Auto-start Postgres in WSL (safe to run multiple times)
if ! pgrep -x postgres >/dev/null 2>&1; then
  sudo service postgresql start >/dev/null 2>&1 || true
fi
BASHRC
fi

echo ""
echo "=========================================="
echo "PostgreSQL setup complete."
echo "Database: lec_crm"
echo "User:     lec_crm"
echo "Password: lec_crm_dev_password (local dev only)"
echo "Connect:  postgres://lec_crm:lec_crm_dev_password@localhost:5432/lec_crm"
echo "=========================================="
