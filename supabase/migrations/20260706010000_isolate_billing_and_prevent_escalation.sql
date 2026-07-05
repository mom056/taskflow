-- ============================================================
-- Migration: Isolate Stripe Billing & Prevent Plan Escalation
-- ============================================================

-- 1. Create check_company_insert function to enforce free plan on signups
CREATE OR REPLACE FUNCTION public.check_company_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  company_count INT;
BEGIN
  -- Allow super admins or service_role key to bypass registration restrictions
  IF auth.role() = 'service_role' OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  -- Allow system initialization (first company gets default initial config)
  SELECT COUNT(*)::INT INTO company_count FROM public.companies;
  IF company_count = 0 THEN
    RETURN NEW;
  END IF;

  -- Enforce free tier bounds for all public self-registration requests
  NEW.plan := 'free';
  NEW.max_employees := 5;
  NEW.is_active := true;

  RETURN NEW;
END;
$$;

-- 2. Attach before-insert trigger to companies table
DROP TRIGGER IF EXISTS check_company_insert_trigger ON public.companies;
CREATE TRIGGER check_company_insert_trigger
  BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.check_company_insert();

-- 3. Create isolated company_billing table to store sensitive Stripe secrets
CREATE TABLE IF NOT EXISTS public.company_billing (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_webhook_secret TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable Row Level Security (RLS) on the isolated billing table
ALTER TABLE public.company_billing ENABLE ROW LEVEL SECURITY;

-- 5. Create security policies allowing ONLY Super Admins to query/manage billing records
CREATE POLICY "Super Admins can access company billing"
  ON public.company_billing
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 6. Safely migrate existing billing credentials from public.companies to public.company_billing
INSERT INTO public.company_billing (company_id, stripe_customer_id, stripe_subscription_id, stripe_webhook_secret)
SELECT id, stripe_customer_id, stripe_subscription_id, stripe_webhook_secret
FROM public.companies
WHERE stripe_customer_id IS NOT NULL
   OR stripe_subscription_id IS NOT NULL
   OR stripe_webhook_secret IS NOT NULL
ON CONFLICT (company_id) DO NOTHING;

-- 7. Drop the sensitive billing columns from the public.companies table
ALTER TABLE public.companies DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE public.companies DROP COLUMN IF EXISTS stripe_subscription_id;
ALTER TABLE public.companies DROP COLUMN IF EXISTS stripe_webhook_secret;
