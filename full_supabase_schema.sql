-- ========================================
-- Labour Management System - Full Fresh Schema
-- Run this entire file in Supabase SQL Editor on an empty database
-- ========================================

create extension if not exists pgcrypto;

-- Drop old objects safely if they still exist
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS income CASCADE;
DROP TABLE IF EXISTS materials CASCADE;
DROP TABLE IF EXISTS extra_work CASCADE;
DROP TABLE IF EXISTS labour CASCADE;
DROP TABLE IF EXISTS labour_types CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- ========================================
-- 1. Master Tables
-- ========================================

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_name TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT projects_status_check CHECK (status IN ('ACTIVE', 'COMPLETED'))
);

CREATE TABLE labour_types (
  code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL UNIQUE,
  default_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE labour (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  gender TEXT NOT NULL DEFAULT 'Male',
  type TEXT NOT NULL DEFAULT 'Mistry (Skilled)',
  daily_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT labour_gender_check CHECK (gender IN ('Male', 'Female')),
  CONSTRAINT labour_type_check CHECK (type IN ('Mistry (Skilled)', 'Labour (Women)', 'Parakadu (Helper)'))
);

-- ========================================
-- 2. Transaction Tables
-- ========================================

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  labour_id UUID NOT NULL REFERENCES labour(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  days_worked NUMERIC(4,2) NOT NULL DEFAULT 1,
  overtime_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  overtime_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  custom_rate NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_unique_labour_project_date UNIQUE (labour_id, project_id, date)
);

CREATE TABLE income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'bags',
  cost_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE extra_work (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  labour_id UUID NOT NULL REFERENCES labour(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL,
  payment_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================
-- 3. Seed Data
-- ========================================

INSERT INTO labour_types (code, display_name, default_rate)
VALUES
  ('MISTRY', 'Mistry (Skilled)', 1300),
  ('LABOUR_WOMEN', 'Labour (Women)', 800),
  ('PARAKADU', 'Parakadu (Helper)', 1000)
ON CONFLICT (code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  default_rate = EXCLUDED.default_rate;

-- ========================================
-- 4. Indexes
-- ========================================

CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX idx_labour_name ON labour(name);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_labour_id ON attendance(labour_id);
CREATE INDEX idx_attendance_project_id ON attendance(project_id);
CREATE INDEX idx_income_project_id ON income(project_id);
CREATE INDEX idx_income_date ON income(date);
CREATE INDEX idx_materials_project_id ON materials(project_id);
CREATE INDEX idx_materials_date ON materials(date);
CREATE INDEX idx_extra_work_project_id ON extra_work(project_id);
CREATE INDEX idx_extra_work_date ON extra_work(date);
CREATE INDEX idx_payments_labour_id ON payments(labour_id);
CREATE INDEX idx_payments_project_id ON payments(project_id);
CREATE INDEX idx_payments_date ON payments(date);

-- ========================================
-- 5. Helpful Comments
-- ========================================

COMMENT ON COLUMN projects.owner_name IS 'Project owner or client name';
COMMENT ON COLUMN projects.description IS 'Project address or description';
COMMENT ON COLUMN projects.status IS 'ACTIVE or COMPLETED';
COMMENT ON COLUMN labour.type IS 'Allowed worker role values used by the app';
COMMENT ON COLUMN labour.gender IS 'Male or Female only';
COMMENT ON COLUMN attendance.custom_rate IS 'Optional daily rate override for that attendance entry';
COMMENT ON COLUMN materials.total_amount IS 'Manual total amount entered in the app';
COMMENT ON COLUMN payments.project_id IS 'Optional project mapping for grouped weekly reports';

-- ========================================
-- 6. Row Level Security Policies
-- ========================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE labour_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE labour ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all projects" ON projects;
CREATE POLICY "Allow all projects" ON projects FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all labour_types" ON labour_types;
CREATE POLICY "Allow all labour_types" ON labour_types FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all labour" ON labour;
CREATE POLICY "Allow all labour" ON labour FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all attendance" ON attendance;
CREATE POLICY "Allow all attendance" ON attendance FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all income" ON income;
CREATE POLICY "Allow all income" ON income FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all materials" ON materials;
CREATE POLICY "Allow all materials" ON materials FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all extra_work" ON extra_work;
CREATE POLICY "Allow all extra_work" ON extra_work FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all payments" ON payments;
CREATE POLICY "Allow all payments" ON payments FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- ========================================
-- 7. Storage Bucket for Receipt Sharing
-- ========================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Optional permissive policies for development
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read receipts'
  ) THEN
    CREATE POLICY "Public read receipts"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'receipts');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated upload receipts'
  ) THEN
    CREATE POLICY "Authenticated upload receipts"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'receipts');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated update receipts'
  ) THEN
    CREATE POLICY "Authenticated update receipts"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'receipts')
    WITH CHECK (bucket_id = 'receipts');
  END IF;
END $$;

-- ========================================
-- Done
-- ========================================
SELECT 'Full schema created successfully' AS status;
