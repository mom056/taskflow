-- ============================================================
-- TaskFlow - Supabase Schema (Final Clean Version)
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- User role enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('manager', 'employee');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ── TABLES ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  employee_id UUID REFERENCES public.users(id),
  location TEXT,
  due_date BIGINT,
  notes TEXT,
  image_url TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at BIGINT NOT NULL,
  updated_at BIGINT
);

CREATE TABLE IF NOT EXISTS public.visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location TEXT NOT NULL,
  notes TEXT,
  employee_id UUID REFERENCES public.users(id),
  created_at BIGINT NOT NULL
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies (safe to re-run)
DROP POLICY IF EXISTS "Users can read all users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;

DROP POLICY IF EXISTS "Managers can read all tasks, employees can read their own" ON public.tasks;
DROP POLICY IF EXISTS "Managers can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Managers and employees can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Managers can update all tasks, employees can update their own status/notes" ON public.tasks;
DROP POLICY IF EXISTS "Managers can update all tasks, employees can update their own" ON public.tasks;
DROP POLICY IF EXISTS "Managers can delete tasks" ON public.tasks;

DROP POLICY IF EXISTS "Managers can read all visits" ON public.visits;
DROP POLICY IF EXISTS "Employees can read their own visits" ON public.visits;
DROP POLICY IF EXISTS "Employees can insert their own visits" ON public.visits;

-- ── USERS POLICIES ────────────────────────────────────────────

-- Anyone authenticated can read all users (needed for manager to list employees)
CREATE POLICY "Users can read all users"
  ON public.users FOR SELECT USING (true);

-- Users can only update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE USING (auth.uid() = id);

-- Users can only insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- ── TASKS POLICIES ────────────────────────────────────────────

-- Managers see all tasks; employees see only their own
CREATE POLICY "Managers can read all tasks, employees can read their own"
  ON public.tasks FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
    OR employee_id = auth.uid()
  );

-- Managers can insert any task; employees can insert tasks assigned to themselves
CREATE POLICY "Managers and employees can insert tasks"
  ON public.tasks FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
    OR (auth.uid() IS NOT NULL AND employee_id = auth.uid())
  );

-- Managers can update any task; employees can update their own tasks (any status)
CREATE POLICY "Managers can update all tasks, employees can update their own"
  ON public.tasks FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
    OR employee_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
    OR employee_id = auth.uid()
  );

-- Only managers can delete tasks
CREATE POLICY "Managers can delete tasks"
  ON public.tasks FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
  );

-- ── VISITS POLICIES ───────────────────────────────────────────

CREATE POLICY "Managers can read all visits"
  ON public.visits FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager')
  );

CREATE POLICY "Employees can read their own visits"
  ON public.visits FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY "Employees can insert their own visits"
  ON public.visits FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── STORAGE: task-images bucket ───────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('task-images', 'task-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload task images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view task images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own task images" ON storage.objects;

CREATE POLICY "Authenticated users can upload task images"
  ON storage.objects FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND bucket_id = 'task-images');

CREATE POLICY "Anyone can view task images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'task-images');

CREATE POLICY "Users can delete their own task images"
  ON storage.objects FOR DELETE
  USING (auth.uid() IS NOT NULL AND bucket_id = 'task-images');
