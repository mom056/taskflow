-- ============================================================
-- Phase 2 Security Hardening Migration
-- Run this script in the Supabase SQL Editor to apply database fixes
-- ============================================================

-- 1. Ensure pg_net extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Re-create the notify_new_task trigger function to include X-Webhook-Secret
-- (Remember to replace 'YOUR_WEBHOOK_SECRET_KEY' with the same secret key you set in your Edge Function environment variables)
CREATE OR REPLACE FUNCTION public.notify_new_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  payload JSONB;
  edge_url CONSTANT TEXT := 'https://bzsmwmkgmropuadpkcku.supabase.co/functions/v1/send-push';
BEGIN
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', 'tasks',
    'schema', 'public',
    'record', jsonb_build_object(
      'id', NEW.id,
      'title', NEW.title,
      'description', NEW.description,
      'employee_id', NEW.employee_id,
      'status', NEW.status,
      'location', NEW.location,
      'created_by', NEW.created_by
    ),
    'old_record', CASE 
      WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
        'status', OLD.status
      )
      ELSE NULL
    END
  );

  PERFORM net.http_post(
    url := edge_url,
    body := payload,
    headers := '{"Content-Type": "application/json", "X-Webhook-Secret": "cf089e82-4f36-4d1a-82ee-062db28b936a"}'::jsonb
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[notify_new_task] Push notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- 3. Ensure trigger is attached
DROP TRIGGER IF EXISTS on_task_created_notify ON public.tasks;
CREATE TRIGGER on_task_created_notify
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_task();

-- 4. Storage Bucket setup for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Drop existing policies if any to avoid duplicates
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Manager Insert Access" ON storage.objects;
DROP POLICY IF EXISTS "Manager Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Manager Delete Access" ON storage.objects;

-- 6. Create read policy for avatars (public read)
CREATE POLICY "Public Read Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- 7. Create write policies for managers/super_admins for company-logos folder
CREATE POLICY "Manager Insert Access" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'company-logos'
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'super_admin')
  );

CREATE POLICY "Manager Update Access" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'company-logos'
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'super_admin')
  );

CREATE POLICY "Manager Delete Access" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'company-logos'
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('manager', 'super_admin')
  );
