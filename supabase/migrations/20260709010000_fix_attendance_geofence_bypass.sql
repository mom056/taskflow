-- Migration: Fix Attendance Geofence Bypass
-- Description: Enforce geofencing on NULL coordinates check-ins.

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
  r FLOAT := 6371000.0;
  lat1 FLOAT; lat2 FLOAT; dlat FLOAT; dlng FLOAT; a FLOAT; c FLOAT;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.employee_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'غير مسموح بتسجيل الحضور لموظف آخر.';
  END IF;

  SELECT company_id INTO user_company_id FROM public.users WHERE id = auth.uid();
  NEW.company_id := user_company_id;

  SELECT hq_latitude, hq_longitude, hq_radius_meters, work_start_time
  INTO hq_lat, hq_lng, hq_rad, comp_start_time
  FROM public.companies WHERE id = NEW.company_id;

  IF hq_lat IS NOT NULL AND hq_lng IS NOT NULL THEN
    -- ✅ Force 'field' classification if user fails to provide coordinate details
    IF NEW.check_in_lat IS NULL OR NEW.check_in_lng IS NULL THEN
      NEW.check_in_type := 'field';
      NEW.notes := COALESCE(NEW.notes || ' ', '') || '(لم تُرسل إحداثيات صالحة، صُنّف تلقائياً كدوام ميداني)';
    ELSE
      lat1 := radians(NEW.check_in_lat);
      lat2 := radians(hq_lat);
      dlat := radians(hq_lat - NEW.check_in_lat);
      dlng := radians(hq_lng - NEW.check_in_lng);
      a := sin(dlat/2.0)*sin(dlat/2.0) + cos(lat1)*cos(lat2)*sin(dlng/2.0)*sin(dlng/2.0);
      c := 2.0 * asin(sqrt(a));
      dist := r * c;

      IF dist > COALESCE(hq_rad, 200) THEN
        IF NEW.check_in_type = 'office' THEN
          NEW.check_in_type := 'field';
          NEW.notes := COALESCE(NEW.notes || ' ', '') || '(تم تحويله تلقائياً لدوام ميداني لعدم التواجد بمقر الشركة)';
        END IF;
      END IF;
    END IF;
  END IF;

  IF comp_start_time IS NOT NULL THEN
    check_in_local_time := (to_timestamp(NEW.check_in_time / 1000.0) AT TIME ZONE 'Asia/Riyadh')::time;
    NEW.is_late := check_in_local_time > comp_start_time::time;
  END IF;

  RETURN NEW;
END;
$$;
