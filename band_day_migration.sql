-- 1. Create calendar_events table
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    event_type TEXT NOT NULL, -- e.g., 'AMAVASYA'
    lunar_month TEXT,
    regional_name TEXT, -- e.g., 'అమావాస్య'
    tithi_start TIMESTAMPTZ,
    tithi_end TIMESTAMPTZ,
    timezone TEXT DEFAULT 'Asia/Kolkata',
    location TEXT,
    source TEXT,
    year INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by date
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON public.calendar_events(date);

-- Enable RLS for calendar_events
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read calendar events
CREATE POLICY "Enable read access for all authenticated users" ON public.calendar_events
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow service role or authenticated users to insert/update
CREATE POLICY "Enable insert for authenticated users" ON public.calendar_events
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.calendar_events
    FOR UPDATE USING (auth.role() = 'authenticated');

-- 2. Create project_day_status table
CREATE TABLE IF NOT EXISTS public.project_day_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('WORKING', 'BAND')),
    reason TEXT,
    source TEXT DEFAULT 'MANUAL', -- 'MANUAL' or 'CALENDAR'
    calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, date)
);

-- Index for fast lookup by project and date range
CREATE INDEX IF NOT EXISTS idx_project_day_status_proj_date ON public.project_day_status(project_id, date);

-- Enable RLS for project_day_status
ALTER TABLE public.project_day_status ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read project_day_status
CREATE POLICY "Enable read access for all authenticated users" ON public.project_day_status
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert/update/delete
CREATE POLICY "Enable insert for authenticated users" ON public.project_day_status
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.project_day_status
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.project_day_status
    FOR DELETE USING (auth.role() = 'authenticated');
