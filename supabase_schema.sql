-- ============================================================
-- TaskFlow - Supabase Schema (Multi-Tenant SaaS Version)
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- User role enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('manager', 'employee', 'super_admin');
    END IF;
END $$;

-- Adding values to enums must be run outside of a transaction/DO block in PostgreSQL
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- ── TABLES ────────────────────────────────────────────────────

-- 1. Companies Table (New)
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,           -- Unique identifier for URL/slug
  logo_url TEXT,                       -- Company logo URL
  plan TEXT NOT NULL DEFAULT 'free',   -- Subscription plan: free, basic, premium
  max_employees INT NOT NULL DEFAULT 5,-- Limit of employees
  created_at BIGINT NOT NULL,
  is_active BOOLEAN DEFAULT true       -- To deactivate companies if needed
);

-- 2. Users Table (Modified to include company_id)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  avatar_url TEXT,
  created_at BIGINT NOT NULL
);

-- 3. Tasks Table (Modified to include company_id)
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  employee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  location TEXT,
  due_date BIGINT,
  notes TEXT,
  image_url TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location_verified_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT
);

-- 4. Visits Table (Modified to include company_id)
CREATE TABLE IF NOT EXISTS public.visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location TEXT NOT NULL,
  notes TEXT,
  employee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL
);

-- 5. Push Subscriptions Table (Modified to include company_id)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ── HELPER FUNCTIONS FOR MULTI-TENANCY ───────────────────────

-- Helper function to get current user's company_id
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if current user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to count total users, bypassing RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_user_count()
RETURNS INT AS $$
  SELECT COUNT(*)::INT FROM public.users;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── COMPANIES POLICIES ────────────────────────────────────────

DROP POLICY IF EXISTS "companies_select_policy" ON public.companies;
CREATE POLICY "companies_select_policy" ON public.companies 
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "companies_insert_policy" ON public.companies;
CREATE POLICY "companies_insert_policy" ON public.companies 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR is_super_admin());

DROP POLICY IF EXISTS "companies_update_policy" ON public.companies;
CREATE POLICY "companies_update_policy" ON public.companies 
  FOR UPDATE USING (id = get_my_company_id() OR is_super_admin())
  WITH CHECK (id = get_my_company_id() OR is_super_admin());

DROP POLICY IF EXISTS "companies_delete_policy" ON public.companies;
CREATE POLICY "companies_delete_policy" ON public.companies 
  FOR DELETE USING (is_super_admin());

-- ── USERS POLICIES ────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can read all users" ON public.users;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
CREATE POLICY "users_select_policy" ON public.users 
  FOR SELECT USING (auth.uid() = id OR company_id = get_my_company_id() OR is_super_admin());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
CREATE POLICY "users_update_policy" ON public.users 
  FOR UPDATE USING (auth.uid() = id OR is_super_admin())
  WITH CHECK (auth.uid() = id OR is_super_admin());

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
CREATE POLICY "users_insert_policy" ON public.users 
  FOR INSERT WITH CHECK (auth.uid() = id OR is_super_admin());

DROP POLICY IF EXISTS "users_delete_policy" ON public.users;
CREATE POLICY "users_delete_policy" ON public.users 
  FOR DELETE USING (is_super_admin());

-- ── TASKS POLICIES ────────────────────────────────────────────

DROP POLICY IF EXISTS "Managers can read all tasks, employees can read their own" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
CREATE POLICY "tasks_select_policy" ON public.tasks 
  FOR SELECT USING (
    is_super_admin() OR (
      company_id = get_my_company_id()
      AND (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text = 'manager')
        OR employee_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Managers and employees can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
CREATE POLICY "tasks_insert_policy" ON public.tasks 
  FOR INSERT WITH CHECK (
    is_super_admin() OR (
      company_id = get_my_company_id()
      AND (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text = 'manager')
        OR (auth.uid() IS NOT NULL AND employee_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Managers can update all tasks, employees can update their own" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;
CREATE POLICY "tasks_update_policy" ON public.tasks 
  FOR UPDATE USING (
    is_super_admin() OR (
      company_id = get_my_company_id()
      AND (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text = 'manager')
        OR employee_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    is_super_admin() OR (
      company_id = get_my_company_id()
      AND (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text = 'manager')
        OR employee_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Managers can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON public.tasks;
CREATE POLICY "tasks_delete_policy" ON public.tasks 
  FOR DELETE USING (
    is_super_admin() OR (
      company_id = get_my_company_id()
      AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text = 'manager')
    )
  );

-- ── VISITS POLICIES ───────────────────────────────────────────

DROP POLICY IF EXISTS "Managers can read all visits" ON public.visits;
DROP POLICY IF EXISTS "Employees can read their own visits" ON public.visits;
DROP POLICY IF EXISTS "visits_select_policy" ON public.visits;
CREATE POLICY "visits_select_policy" ON public.visits 
  FOR SELECT USING (
    is_super_admin() OR (
      company_id = get_my_company_id()
      AND (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text = 'manager')
        OR employee_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Employees can insert their own visits" ON public.visits;
DROP POLICY IF EXISTS "visits_insert_policy" ON public.visits;
CREATE POLICY "visits_insert_policy" ON public.visits 
  FOR INSERT WITH CHECK (
    is_super_admin() OR (
      company_id = get_my_company_id()
      AND auth.uid() IS NOT NULL
    )
  );

-- ── PUSH SUBSCRIPTIONS POLICIES ───────────────────────────────

DROP POLICY IF EXISTS "Users manage their own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_policy" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_policy" ON public.push_subscriptions 
  FOR ALL USING (
    is_super_admin() OR (
      company_id = get_my_company_id() AND auth.uid() = user_id
    )
  )
  WITH CHECK (
    is_super_admin() OR (
      company_id = get_my_company_id() AND auth.uid() = user_id
    )
  );

-- ── STORAGE: Buckets and Policies ─────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('task-images', 'task-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true) 
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload task images" ON storage.objects;
CREATE POLICY "Authenticated users can upload task images"
  ON storage.objects FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND bucket_id = 'task-images');

DROP POLICY IF EXISTS "Users can delete their own task images" ON storage.objects;
CREATE POLICY "Users can delete their own task images"
  ON storage.objects FOR DELETE
  USING (auth.uid() IS NOT NULL AND bucket_id = 'task-images');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND bucket_id = 'avatars' 
    AND name LIKE (auth.uid()::text || '%')
  );

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND bucket_id = 'avatars' 
    AND name LIKE (auth.uid()::text || '%')
  );

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
