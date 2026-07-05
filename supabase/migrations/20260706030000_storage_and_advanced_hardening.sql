-- ============================================================
-- Migration: Storage Privacy & Advanced Hardening
-- ============================================================

-- 1. Restrict task-images bucket to private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'task-images';

-- 2. Drop all public and legacy task-images storage policies
DROP POLICY IF EXISTS "Task Images Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Task Images Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Task Images Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Task Images Delete Access" ON storage.objects;

-- 3. Recreate Storage policies with secure dual-index checks (supporting both task-images/taskId/file and taskId/file paths)
CREATE POLICY "Task Images Read Access" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'task-images' AND (
      is_super_admin() OR
      EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE (t.id::text = (storage.foldername(name))[1] OR t.id::text = (storage.foldername(name))[2])
        AND t.company_id = get_my_company_id()
      )
    )
  );

CREATE POLICY "Task Images Upload Access" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-images' AND (
      is_super_admin() OR
      EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE (t.id::text = (storage.foldername(name))[1] OR t.id::text = (storage.foldername(name))[2])
        AND t.company_id = get_my_company_id()
      )
    )
  );

CREATE POLICY "Task Images Delete Access" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'task-images' AND (
      is_super_admin() OR
      EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE (t.id::text = (storage.foldername(name))[1] OR t.id::text = (storage.foldername(name))[2])
        AND t.company_id = get_my_company_id()
      )
    )
  );

-- 4. Enforce task status transition state machine rules in check_task_update function
CREATE OR REPLACE FUNCTION public.check_task_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

  -- Enforce status transition state machine rules
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT (
      public.is_super_admin() OR
      caller_role = 'manager' OR
      (OLD.status = 'new' AND NEW.status IN ('in_progress', 'pending')) OR
      (OLD.status = 'in_progress' AND NEW.status IN ('completed', 'pending')) OR
      (OLD.status = 'pending' AND NEW.status IN ('new', 'in_progress'))
    ) THEN
      RAISE EXCEPTION 'انتقال حالة غير مسموح: % ← %', NEW.status, OLD.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Delete the get_user_count RPC from database to prevent statistics exposure
DROP FUNCTION IF EXISTS public.get_user_count();
