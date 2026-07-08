-- Migration: Restrict Internal Function Execute
-- Description: Revoke direct execution privileges of trigger and helper functions from PUBLIC, but grant to authenticated users where required to avoid RLS/RPC failure.

-- Group A: Trigger functions (no direct EXECUTE needed)
REVOKE EXECUTE ON FUNCTION public.check_attendance_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_attendance_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_company_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_company_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_employee_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_task_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_user_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_user_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_task() FROM PUBLIC, anon, authenticated;

-- Group B: Helper functions used inside RLS policies (re-grant to authenticated role)
REVOKE EXECUTE ON FUNCTION public.get_my_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_company_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Group C: RPC function intended for client-side deletion (re-grant to authenticated role)
REVOKE EXECUTE ON FUNCTION public.delete_own_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_user() TO authenticated;
