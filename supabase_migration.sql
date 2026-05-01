-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE labour_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE labour ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create Policies to allow your Next.js app to read/write freely
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
