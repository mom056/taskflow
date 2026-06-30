-- Migration: 20260630140000_security_hardening.sql
-- Description: Implement database-level triggers and RLS policy constraints to prevent privilege escalation, cross-tenant leaks, and data spoofing/deletion.

-- =========================================================================
-- 1. SECURITY DEFINER Functions & Triggers for Role/Profile Insert Control
-- =========================================================================

CREATE OR REPLACE FUNCTION public.check_user_insert()
RETURNS TRIGGER AS $$
DECLARE
  user_count INT;
  jwt_metadata JSONB;
  company_name_val TEXT;
BEGIN
  -- A. Allow Deno Edge Functions using the service_role key to bypass checks
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- B. Allow first platform user to register as super_admin
  SELECT COUNT(*)::INT INTO user_count FROM public.users;
  IF user_count = 0 THEN
    IF NEW.role::text != 'super_admin' THEN
      NEW.role := 'super_admin';
    END IF;
    RETURN NEW;
  END IF;

  -- C. Block normal users from inserting themselves as super_admin
  IF NEW.role::text = 'super_admin' THEN
    RAISE EXCEPTION 'غير مسموح بإنشاء مشرف عام جديد إلا من قبل النظام.';
  END IF;

  -- D. For managers, verify that they signed up creating a company (metadata contains company_name)
  IF NEW.role::text = 'manager' THEN
    BEGIN
      jwt_metadata := auth.jwt() -> 'user_metadata';
      IF jwt_metadata IS NOT NULL THEN
        company_name_val := jwt_metadata ->> 'company_name';
      ELSE
        company_name_val := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      company_name_val := NULL;
    END;

    IF company_name_val IS NULL OR trim(company_name_val) = '' THEN
      RAISE EXCEPTION 'غير مسموح بإنشاء مدير جديد إلا عند تسجيل شركة جديدة.';
    END IF;
    
    RETURN NEW;
  END IF;

  -- E. For employees, block direct inserts (employees must be added by managers via Edge Function)
  IF NEW.role::text = 'employee' THEN
    RAISE EXCEPTION 'يجب إضافة الموظفين من قبل مدير الشركة عبر التطبيق.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
DROP TRIGGER IF EXISTS check_user_insert_trigger ON public.users;
CREATE TRIGGER check_user_insert_trigger
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.check_user_insert();


-- =========================================================================
-- 2. SECURITY DEFINER Functions & Triggers for Task Update Control
-- =========================================================================

CREATE OR REPLACE FUNCTION public.check_task_update()
RETURNS TRIGGER AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Allow service_role key to bypass checks
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Retrieve caller role
  SELECT role::text INTO caller_role FROM public.users WHERE id = auth.uid();

  -- If employee is updating, restrict changes to progress & verification columns only
  IF caller_role = 'employee' THEN
    IF OLD.title IS DISTINCT FROM NEW.title OR
       OLD.description IS DISTINCT FROM NEW.description OR
       OLD.due_date IS DISTINCT FROM NEW.due_date OR
       OLD.company_id IS DISTINCT FROM NEW.company_id OR
       OLD.created_by IS DISTINCT FROM NEW.created_by OR
       OLD.employee_id IS DISTINCT FROM NEW.employee_id OR
       OLD.target_latitude IS DISTINCT FROM NEW.target_latitude OR
       OLD.target_longitude IS DISTINCT FROM NEW.target_longitude THEN
      RAISE EXCEPTION 'غير مسموح للموظف بتعديل تفاصيل المهمة الأساسية.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
DROP TRIGGER IF EXISTS check_task_update_trigger ON public.tasks;
CREATE TRIGGER check_task_update_trigger
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.check_task_update();


-- =========================================================================
-- 3. Hardened RLS Policies for Companies, Visits, Activity Logs, and Storage
-- =========================================================================

-- A. Companies Select Policy
DROP POLICY IF EXISTS "companies_select_policy" ON public.companies;
CREATE POLICY "companies_select_policy" ON public.companies 
  FOR SELECT USING (
    is_super_admin() OR 
    id = (SELECT company_id FROM public.users WHERE id = auth.uid()) OR
    -- Allow signup flow (user is authenticated but profile is not inserted yet)
    NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid())
  );

-- B. Visits Insert Policy (Impersonation Protection)
DROP POLICY IF EXISTS "visits_insert_policy" ON public.visits;
CREATE POLICY "visits_insert_policy" ON public.visits 
  FOR INSERT WITH CHECK (
    is_super_admin() OR (
      company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
      AND (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'manager'::user_role
        OR employee_id = auth.uid()
      )
    )
  );

-- C. Activity Log Insert Policy (Spoofing Protection)
DROP POLICY IF EXISTS "activity_log_insert_policy" ON public.activity_log;
CREATE POLICY "activity_log_insert_policy" ON public.activity_log 
  FOR INSERT TO authenticated 
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND actor_id = auth.uid()
  );

-- D. Storage: Company Logos Upload Isolation
DROP POLICY IF EXISTS "Manager Insert Access" ON storage.objects;
CREATE POLICY "Manager Insert Access" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'company-logos'
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'super_admin')
    AND (storage.filename(name)) LIKE ((SELECT company_id::text FROM public.users WHERE id = auth.uid()) || '%')
  );

DROP POLICY IF EXISTS "Manager Update Access" ON storage.objects;
CREATE POLICY "Manager Update Access" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'company-logos'
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'super_admin')
    AND (storage.filename(name)) LIKE ((SELECT company_id::text FROM public.users WHERE id = auth.uid()) || '%')
  )
  WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'company-logos'
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'super_admin')
    AND (storage.filename(name)) LIKE ((SELECT company_id::text FROM public.users WHERE id = auth.uid()) || '%')
  );

DROP POLICY IF EXISTS "Manager Delete Access" ON storage.objects;
CREATE POLICY "Manager Delete Access" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'company-logos'
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'super_admin')
    AND (storage.filename(name)) LIKE ((SELECT company_id::text FROM public.users WHERE id = auth.uid()) || '%')
  );

-- E. Storage: Task Images Security Isolation
DROP POLICY IF EXISTS "Task Images Upload Access" ON storage.objects;
CREATE POLICY "Task Images Upload Access" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-images'
    AND (
      is_super_admin() OR
      EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id::text = (storage.foldername(name))[1]
        AND t.company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Task Images Delete Access" ON storage.objects;
CREATE POLICY "Task Images Delete Access" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'task-images'
    AND (
      is_super_admin() OR
      EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id::text = (storage.foldername(name))[1]
        AND t.company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
      )
    )
  );
