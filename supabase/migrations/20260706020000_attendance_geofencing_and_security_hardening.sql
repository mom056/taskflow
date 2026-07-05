-- ============================================================
-- Migration: Server-Side Attendance Geofencing & Security Hardening
-- ============================================================

-- 1. Redefine public.check_attendance_insert to calculate Haversine distance and enforce geofencing
CREATE OR REPLACE FUNCTION public.check_attendance_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  comp_start_time TEXT;
  check_in_local_time TIME;
  user_company_id UUID;
  hq_lat DECIMAL(10, 8);
  hq_lng DECIMAL(11, 8);
  hq_rad INT;
  dist FLOAT;
  r FLOAT := 6371000.0; -- Earth radius in meters
  lat1 FLOAT;
  lat2 FLOAT;
  dlat FLOAT;
  dlng FLOAT;
  a FLOAT;
  c FLOAT;
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

  -- Fetch company geofencing parameters
  SELECT hq_latitude, hq_longitude, hq_radius_meters, work_start_time
  INTO hq_lat, hq_lng, hq_rad, comp_start_time
  FROM public.companies 
  WHERE id = NEW.company_id;

  -- Server-Side Haversine Geofencing Check (Option A: Auto-convert to field if out of bounds)
  IF hq_lat IS NOT NULL AND hq_lng IS NOT NULL AND NEW.check_in_lat IS NOT NULL AND NEW.check_in_lng IS NOT NULL THEN
    -- Convert degrees to radians
    lat1 := radians(NEW.check_in_lat);
    lat2 := radians(hq_lat);
    dlat := radians(hq_lat - NEW.check_in_lat);
    dlng := radians(hq_lng - NEW.check_in_lng);

    -- Haversine formula calculation
    a := sin(dlat / 2.0) * sin(dlat / 2.0) + cos(lat1) * cos(lat2) * sin(dlng / 2.0) * sin(dlng / 2.0);
    c := 2.0 * asin(sqrt(a));
    dist := r * c;

    -- If check-in distance exceeds company HQ radius, force type to 'field'
    IF dist > COALESCE(hq_rad, 200) THEN
      IF NEW.check_in_type = 'office' THEN
        NEW.check_in_type := 'field';
        NEW.notes := COALESCE(NEW.notes || ' ', '') || '(تم تحويله تلقائياً لدوام ميداني لعدم التواجد بمقر الشركة)';
      END IF;
    END IF;
  END IF;

  -- Fetch start hour settings of company and mark lateness
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
$$;

-- 2. Restrict tasks insertion RLS policy to enforce created_by = auth.uid()
DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
CREATE POLICY "tasks_insert_policy" ON public.tasks 
  FOR INSERT WITH CHECK (
    is_super_admin() OR (
      company_id = get_my_company_id()
      AND created_by = auth.uid()
      AND (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text = 'manager')
        OR (auth.uid() IS NOT NULL AND employee_id = auth.uid())
      )
    )
  );

-- 3. Lock down search paths on all existing SECURITY DEFINER functions to prevent search path hijacking
ALTER FUNCTION public.get_my_company_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_super_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_count() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_user_update() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_user_insert() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_employee_limit() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_task_update() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_company_update() SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_own_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_attendance_update() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_new_task() SET search_path = public, pg_temp;
