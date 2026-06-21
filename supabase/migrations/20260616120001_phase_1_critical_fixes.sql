-- ============================================================
-- Phase 1 Critical Fixes Migration
-- Run this script in the Supabase SQL Editor to apply database fixes
-- ============================================================

-- 1. Add missing start location tracking columns to public.tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS start_latitude DECIMAL(10, 8);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS start_longitude DECIMAL(11, 8);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS start_location_verified_at BIGINT;

-- 2. Create activity_log table if not exists
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,           -- 'task_created', 'task_completed', 'employee_added', 'company_suspended', etc.
  target_type TEXT,               -- 'task', 'user', 'company'
  target_id TEXT,                 -- ID of the affected entity
  metadata JSONB DEFAULT '{}',    -- Additional context (old values, new values, etc.)
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL
);

-- 3. Enable RLS on activity_log
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- 4. Recreate select policy for activity_log
DROP POLICY IF EXISTS "activity_log_select_policy" ON public.activity_log;
CREATE POLICY "activity_log_select_policy" ON public.activity_log
  FOR SELECT
  TO authenticated
  USING (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

-- 5. Recreate insert policy for activity_log
DROP POLICY IF EXISTS "activity_log_insert_policy" ON public.activity_log;
CREATE POLICY "activity_log_insert_policy" ON public.activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  );
