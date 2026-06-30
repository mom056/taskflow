-- ============================================================
-- SQL Migration: 20260630110000_performance_indexing.sql
-- Goal: Accelerate multi-tenant SaaS lookups and dashboard loads
-- ============================================================

-- 1. Users Table Indexes
CREATE INDEX IF NOT EXISTS idx_users_company_id ON public.users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_company_role ON public.users(company_id, role);

-- 2. Tasks Table Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON public.tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_employee_id ON public.tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_employee_status ON public.tasks(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_company_created ON public.tasks(company_id, created_at DESC);

-- 3. Visits Table Indexes
CREATE INDEX IF NOT EXISTS idx_visits_company_created ON public.visits(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_employee_id ON public.visits(employee_id);

-- 4. Push Subscriptions Table Indexes
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_company_id ON public.push_subscriptions(company_id);

-- 5. Activity Log Table Indexes
CREATE INDEX IF NOT EXISTS idx_activity_log_company_created ON public.activity_log(company_id, created_at DESC);
