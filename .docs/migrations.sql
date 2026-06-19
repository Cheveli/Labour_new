-- Migration Script for Contractor Subscription & Access Management System

-- 1. Create public.users table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  mobile_number VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'contractor', -- 'superadmin', 'admin', 'contractor'
  account_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  subscription_status VARCHAR(50) NOT NULL DEFAULT 'inactive', -- 'pending', 'active', 'inactive'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_login TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security (RLS) on public.users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid duplication errors
DROP POLICY IF EXISTS "Allow select for all authenticated users" ON public.users;
DROP POLICY IF EXISTS "Allow insert for all users" ON public.users;
DROP POLICY IF EXISTS "Allow update for owners and superadmins" ON public.users;

-- Create policies for public.users
CREATE POLICY "Allow select for all authenticated users" ON public.users 
  FOR SELECT USING (true);

CREATE POLICY "Allow insert for all users" ON public.users 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update for owners and superadmins" ON public.users 
  FOR UPDATE USING (true);


-- 2. Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  utr_number VARCHAR(50) UNIQUE NOT NULL,
  screenshot_url TEXT NOT NULL,
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending_verification', -- 'pending_verification', 'approved', 'rejected'
  submitted_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  approved_date TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES public.users(id)
);

-- Enable Row Level Security on public.payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow select for payments" ON public.payments;
DROP POLICY IF EXISTS "Allow insert for own payments" ON public.payments;
DROP POLICY IF EXISTS "Allow update for superadmins" ON public.payments;

-- Create policies for public.payments
CREATE POLICY "Allow select for payments" ON public.payments 
  FOR SELECT USING (true);

CREATE POLICY "Allow insert for own payments" ON public.payments 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow update for superadmins" ON public.payments 
  FOR UPDATE USING (true);


-- 3. Create or update company_settings entry for subscription amount
CREATE TABLE IF NOT EXISTS public.company_settings (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on company_settings
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Allow all for settings" ON public.company_settings;

CREATE POLICY "Allow select for company settings" ON public.company_settings 
  FOR SELECT USING (true);

CREATE POLICY "Allow all for settings" ON public.company_settings 
  FOR ALL USING (true);

-- Insert or update the subscription amount setting (default to 1)
INSERT INTO public.company_settings (key, value)
VALUES ('subscription_amount', '1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
