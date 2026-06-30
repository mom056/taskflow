-- Migration: 20260630150000_attendance_system.sql
-- Description: Provision tables, columns, policies, and triggers for Attendance, Leaves, and enhanced Visits.

-- =========================================================================
-- 1. Modify existing tables
-- =========================================================================

-- A. Expand companies with HQ location & shift timings
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS hq_latitude DECIMAL(10, 8);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS hq_longitude DECIMAL(11, 8);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS hq_radius_meters INT DEFAULT 200;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS work_start_time TEXT DEFAULT '08:00';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS work_end_time TEXT DEFAULT '17:00';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS work_days TEXT[] DEFAULT ARRAY['Sun','Mon','Tue','Wed','Thu'];

-- B. Expand visits with geolocation, times, images, client names
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS visit_type TEXT DEFAULT 'client_visit';
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS duration_minutes INT;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS check_in_time BIGINT;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS check_out_time BIGINT;


-- =========================================================================
-- 2. Create new tables
-- =========================================================================

-- A. Attendance Table
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  check_in_time BIGINT NOT NULL,
  check_in_lat DECIMAL(10, 8),
  check_in_lng DECIMAL(11, 8),
  check_in_type TEXT DEFAULT 'office', -- 'office' | 'field'
  check_out_time BIGINT,
  check_out_lat DECIMAL(10, 8),
  check_out_lng DECIMAL(11, 8),
  total_hours DECIMAL(5, 2),
  notes TEXT,
  is_late BOOLEAN DEFAULT false,
  created_at BIGINT NOT NULL
);

-- B. Leave Requests Table
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL DEFAULT 'excuse', -- 'excuse' | 'sick' | 'annual' | 'emergency'
  reason TEXT NOT NULL,
  start_date BIGINT NOT NULL,
  end_date BIGINT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at BIGINT,
  review_note TEXT,
  created_at BIGINT NOT NULL
);


-- =========================================================================
-- 3. Row Level Security Configuration
-- =========================================================================

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- A. Attendance Policies
DROP POLICY IF EXISTS "attendance_select_policy" ON public.attendance;
CREATE POLICY "attendance_select_policy" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    is_super_admin() OR
    employee_id = auth.uid() OR
    (
      company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
      AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'manager'::user_role
    )
  );

DROP POLICY IF EXISTS "attendance_insert_policy" ON public.attendance;
CREATE POLICY "attendance_insert_policy" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin() OR
    employee_id = auth.uid()
  );

DROP POLICY IF EXISTS "attendance_update_policy" ON public.attendance;
CREATE POLICY "attendance_update_policy" ON public.attendance
  FOR UPDATE TO authenticated
  USING (
    is_super_admin() OR
    employee_id = auth.uid()
  )
  WITH CHECK (
    is_super_admin() OR
    employee_id = auth.uid()
  );

DROP POLICY IF EXISTS "attendance_delete_policy" ON public.attendance;
CREATE POLICY "attendance_delete_policy" ON public.attendance
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- B. Leave Requests Policies
DROP POLICY IF EXISTS "leave_requests_select_policy" ON public.leave_requests;
CREATE POLICY "leave_requests_select_policy" ON public.leave_requests
  FOR SELECT TO authenticated
  USING (
    is_super_admin() OR
    employee_id = auth.uid() OR
    (
      company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
      AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'manager'::user_role
    )
  );

DROP POLICY IF EXISTS "leave_requests_insert_policy" ON public.leave_requests;
CREATE POLICY "leave_requests_insert_policy" ON public.leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
    AND company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "leave_requests_update_policy" ON public.leave_requests;
CREATE POLICY "leave_requests_update_policy" ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (
    is_super_admin() OR
    (
      company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
      AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'manager'::user_role
    )
  )
  WITH CHECK (
    is_super_admin() OR
    (
      company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
      AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'manager'::user_role
    )
  );

DROP POLICY IF EXISTS "leave_requests_delete_policy" ON public.leave_requests;
CREATE POLICY "leave_requests_delete_policy" ON public.leave_requests
  FOR DELETE TO authenticated
  USING (is_super_admin());


-- =========================================================================
-- 4. Database triggers for business rules enforcement
-- =========================================================================

-- A. Validate attendance check-in and determine lateness automatically
CREATE OR REPLACE FUNCTION public.check_attendance_insert()
RETURNS TRIGGER AS $$
DECLARE
  comp_start_time TEXT;
  check_in_local_time TIME;
  user_company_id UUID;
BEGIN
  -- Bypass for service_role
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Ensure employee_id is matching caller's profile
  IF NEW.employee_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'غير مسموح بتسجيل الحضور لموظف آخر.';
  END IF;

  -- Resolve company_id matching caller profile
  SELECT company_id INTO user_company_id FROM public.users WHERE id = auth.uid();
  NEW.company_id := user_company_id;

  -- Fetch start hour settings of company
  SELECT work_start_time INTO comp_start_time FROM public.companies WHERE id = NEW.company_id;
  IF comp_start_time IS NOT NULL THEN
    -- Convert epoch timestamp to local TIME representation
    check_in_local_time := (to_timestamp(NEW.check_in_time / 1000.0) AT TIME ZONE 'Asia/Riyadh')::time;
    IF check_in_local_time > comp_start_time::time THEN
      NEW.is_late := true;
    ELSE
      NEW.is_late := false;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_attendance_insert_trigger ON public.attendance;
CREATE TRIGGER check_attendance_insert_trigger
  BEFORE INSERT ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.check_attendance_insert();

-- B. Calculate work hours when check-out is submitted
CREATE OR REPLACE FUNCTION public.check_attendance_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate check-out calculations
  IF NEW.check_out_time IS NOT NULL AND OLD.check_out_time IS NULL THEN
    IF NEW.check_out_time < NEW.check_in_time THEN
      RAISE EXCEPTION 'تاريخ الانصراف لا يمكن أن يكون قبل تاريخ الحضور.';
    END IF;
    -- Math calculation: hours = diff in milliseconds / 3600000.0
    NEW.total_hours := ROUND(((NEW.check_out_time - NEW.check_in_time) / 3600000.0)::numeric, 2);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_attendance_update_trigger ON public.attendance;
CREATE TRIGGER check_attendance_update_trigger
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.check_attendance_update();
