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
