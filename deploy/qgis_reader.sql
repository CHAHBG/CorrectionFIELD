-- =============================================================
--  CorrectionFIELD — QGIS Direct Connect Setup
--  Creates a read-only role for QGIS desktop users to view
--  live corrections and features without write access.
-- =============================================================

-- 1. Create the role/user
-- IMPORTANT: Change the password in production!
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'qgis_reader') THEN
    CREATE ROLE qgis_reader WITH LOGIN PASSWORD 'qgis_reader_2026';
  END IF;
END
$$;

-- 2. Grant connection to the database
GRANT CONNECT ON DATABASE postgres TO qgis_reader;

-- 3. Grant usage on the public schema
GRANT USAGE ON SCHEMA public TO qgis_reader;

-- 4. Grant SELECT permission on the relevant tables and views
GRANT SELECT ON public.projects TO qgis_reader;
GRANT SELECT ON public.layers TO qgis_reader;
GRANT SELECT ON public.features TO qgis_reader;
GRANT SELECT ON public.corrections TO qgis_reader;
GRANT SELECT ON public.features_corrected TO qgis_reader;

-- 5. Set default privileges so future tables in public schema are also readable (Optional, but safe)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO qgis_reader;

-- Usage in QGIS:
-- Add PostGIS Layer -> New Connection
-- Host: <GCP_IP> (e.g. 34.27.247.149)
-- Port: 5432
-- Database: postgres
-- Username: qgis_reader
-- Password: qgis_reader_2026
