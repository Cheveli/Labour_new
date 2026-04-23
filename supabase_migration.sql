-- ========================================
-- Labour Management System - Database Migration
-- Run this script in Supabase SQL Editor
-- ========================================

-- 1. Add missing columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Add gender to labour table
ALTER TABLE labour ADD COLUMN IF NOT EXISTS gender TEXT;

-- 3. Add custom_rate to attendance table (for rate override)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS custom_rate NUMERIC;

-- 4. Add total_amount to materials table (manual entry)
ALTER TABLE materials ADD COLUMN IF NOT EXISTS total_amount NUMERIC;

-- 4b. Add missing columns to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT;

-- 5. Add unique constraint to prevent duplicate attendance
-- First, drop existing constraint if it exists
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_unique_labour_project_date;

-- Add the unique constraint
ALTER TABLE attendance ADD CONSTRAINT attendance_unique_labour_project_date 
UNIQUE (labour_id, project_id, date);

-- 6. Insert fixed labour types (if they don't exist)
INSERT INTO labour_types (code, display_name, default_rate)
VALUES 
  ('MISTRY', 'Mistry (Skilled)', 1300),
  ('LABOUR_WOMEN', 'Labour (Women)', 800),
  ('PARAKADU', 'Parakadu (Helper)', 1000)
ON CONFLICT (code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  default_rate = EXCLUDED.default_rate;

-- 7. Update existing labour records to have gender based on type
UPDATE labour SET gender = 'Male' WHERE type = 'Maistry (Men)' AND gender IS NULL;
UPDATE labour SET gender = 'Female' WHERE type = 'Labour (Women)' AND gender IS NULL;
UPDATE labour SET gender = 'Male' WHERE type = 'Parakadu (Helper)' AND gender IS NULL;

-- 8. Create extra_work table if it doesn't exist
CREATE TABLE IF NOT EXISTS extra_work (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  work_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Ensure proper indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_labour_id ON attendance(labour_id);
CREATE INDEX IF NOT EXISTS idx_attendance_project_id ON attendance(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_labour_id ON payments(labour_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);
CREATE INDEX IF NOT EXISTS idx_income_project_id ON income(project_id);
CREATE INDEX IF NOT EXISTS idx_income_date ON income(date);
CREATE INDEX IF NOT EXISTS idx_materials_project_id ON materials(project_id);
CREATE INDEX IF NOT EXISTS idx_materials_date ON materials(date);
CREATE INDEX IF NOT EXISTS idx_extra_work_project_id ON extra_work(project_id);
CREATE INDEX IF NOT EXISTS idx_extra_work_date ON extra_work(date);

-- 10. Add comments for documentation
COMMENT ON COLUMN attendance.custom_rate IS 'Override rate for this specific attendance entry (nullable, uses default if null)';
COMMENT ON COLUMN materials.total_amount IS 'Manual total amount entry (not auto-calculated)';
COMMENT ON COLUMN projects.owner_name IS 'Project owner name';
COMMENT ON COLUMN projects.status IS 'Project status: ACTIVE or COMPLETED';
COMMENT ON COLUMN projects.description IS 'Project description/address';
COMMENT ON COLUMN labour.gender IS 'Worker gender (Male/Female)';

-- Migration complete!
SELECT 'Migration completed successfully!' AS status;
