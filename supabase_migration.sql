-- ========================================
-- Labour Management System - FULL Fresh Database Migration
-- WARNING: This script drops all existing tables and data!
-- Run this script in Supabase SQL Editor to start completely fresh.
-- ========================================

-- 1. Drop existing tables completely to wipe out all data
DROP TABLE IF EXISTS extra_work CASCADE;
DROP TABLE IF EXISTS materials CASCADE;
DROP TABLE IF EXISTS income CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS labour CASCADE;
DROP TABLE IF EXISTS labour_types CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- 2. Create base tables
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_name TEXT,
  status TEXT DEFAULT 'ACTIVE',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE labour_types (
  code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  default_rate NUMERIC NOT NULL
);

CREATE TABLE labour (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('Male', 'Female')),
  phone TEXT,
  daily_rate NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create dependent tracking tables
CREATE TABLE attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  labour_id UUID REFERENCES labour(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL,
  custom_rate NUMERIC,
  advance_amount NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT attendance_unique_labour_project_date UNIQUE (labour_id, project_id, date)
);

CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  labour_id UUID REFERENCES labour(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  payment_type TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE income (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  source TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE extra_work (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  work_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Seed initial default Data
INSERT INTO labour_types (code, display_name, default_rate)
VALUES 
  ('MISTRY', 'Mistry (Skilled)', 1300),
  ('LABOUR_WOMEN', 'Labour (Women)', 800),
  ('PARAKADU', 'Parakadu (Helper)', 1000);

-- 5. Create performance indexes
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_labour_id ON attendance(labour_id);
CREATE INDEX idx_attendance_project_id ON attendance(project_id);

CREATE INDEX idx_payments_date ON payments(date);
CREATE INDEX idx_payments_labour_id ON payments(labour_id);

CREATE INDEX idx_income_date ON income(date);
CREATE INDEX idx_income_project_id ON income(project_id);

CREATE INDEX idx_materials_date ON materials(date);
CREATE INDEX idx_materials_project_id ON materials(project_id);

CREATE INDEX idx_extra_work_date ON extra_work(date);
CREATE INDEX idx_extra_work_project_id ON extra_work(project_id);

-- Migration complete!
SELECT 'Fresh Database Migration completed successfully!' AS status;
