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

-- Note: No SELECT policy is needed for 'task-images' because the bucket is Public.
-- Public buckets allow viewing files via public URL directly. Adding a SELECT policy 
-- allows listing all files in the bucket, which is a security risk.

CREATE POLICY "Users can delete their own task images"
  ON storage.objects FOR DELETE
  USING (auth.uid() IS NOT NULL AND bucket_id = 'task-images');

-- ============================================================
-- Phase 2 upgrades: GPS Verification & Push Notifications
-- ============================================================

-- Add GPS fields to public.tasks
ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS location_verified_at BIGINT;

-- Table for Web Push Notification Subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- Enable RLS for push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies for push_subscriptions
DROP POLICY IF EXISTS "Users manage their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage their own subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Unique constraint on endpoint to prevent duplicate entries
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);

-- ── DATABASE WEBHOOK FOR PUSH NOTIFICATIONS ───────────────────
-- You can configure this either via Supabase Dashboard -> Database -> Webhooks
-- OR by running the following SQL commands:

-- Create the trigger function to invoke the edge function
-- CREATE OR REPLACE FUNCTION public.handle_new_task_push()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   PERFORM
--     net.http_post(
--       url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-push',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
--       ),
--       body := jsonb_build_object(
--         'type', 'INSERT',
--         'table', 'tasks',
--         'record', row_to_json(NEW)
--       )::text,
--       timeout_milliseconds := 5000
--     );
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- CREATE TRIGGER tr_new_task_push
--   AFTER INSERT ON public.tasks
--   FOR EACH ROW
--   EXECUTE FUNCTION public.handle_new_task_push();


-- ============================================================
-- Phase 4 upgrades: Profile Settings & Avatar Upload
-- ============================================================

-- Add avatar_url to public.users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Enable storage public buckets for avatars
-- Note: Must be run inside Supabase SQL editor or handled by dashboard settings
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;

-- RLS policies for avatars storage bucket
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


-- ============================================================
-- Foreign Key Cascade & On Delete Hardening Upgrades
-- ============================================================

-- 1. Ensure user profile deletion cascades when auth user is deleted
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE public.users 
  ADD CONSTRAINT users_id_fkey 
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Clear employee links in tasks when user is deleted (preserve task data for metrics)
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_employee_id_fkey;
ALTER TABLE public.tasks 
  ADD CONSTRAINT tasks_employee_id_fkey 
  FOREIGN KEY (employee_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;
ALTER TABLE public.tasks 
  ADD CONSTRAINT tasks_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. Clear employee links in visits when user is deleted
ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_employee_id_fkey;
ALTER TABLE public.visits 
  ADD CONSTRAINT visits_employee_id_fkey 
  FOREIGN KEY (employee_id) REFERENCES public.users(id) ON DELETE SET NULL;




