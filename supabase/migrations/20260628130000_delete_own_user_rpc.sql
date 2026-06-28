-- PostgreSQL function to allow a user to delete their own account securely
-- Runs with SECURITY DEFINER privileges to bypass public.users/auth.users RLS constraints,
-- restricted to only deleting the active caller's auth.users ID.

CREATE OR REPLACE FUNCTION public.delete_own_user()
RETURNS VOID AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
