-- ============================================================
-- TaskFlow Migration - SaaS Platform Audit Logs & Billing (v1.4.0)
-- ============================================================

-- 1. Create Platform Audit Logs table
CREATE TABLE IF NOT EXISTS public.platform_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  company_name TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Add billing columns to companies table
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_public_key TEXT,
  ADD COLUMN IF NOT EXISTS stripe_webhook_secret TEXT;

-- 3. Enable RLS on platform_audit_logs
ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Create policy for Super Admin to read logs
CREATE POLICY "Super Admins can read all platform audit logs" 
  ON public.platform_audit_logs
  FOR SELECT 
  TO authenticated 
  USING (public.is_super_admin());

-- 5. Create policy for Super Admin to insert logs
CREATE POLICY "Super Admins can insert platform audit logs" 
  ON public.platform_audit_logs
  FOR INSERT 
  TO authenticated 
  WITH CHECK (public.is_super_admin());
