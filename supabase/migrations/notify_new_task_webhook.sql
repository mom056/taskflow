-- ============================================================
-- Database Webhook: Notify employee when a new task is created
-- This trigger calls the send-push Edge Function via pg_net
-- ============================================================

-- 1. Ensure pg_net extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Create the trigger function
CREATE OR REPLACE FUNCTION public.notify_new_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  payload JSONB;
  edge_url TEXT;
  svc_key TEXT;
BEGIN
  -- Build URL from Supabase project URL (auto-set by Supabase in all projects)
  edge_url := rtrim(current_setting('app.settings.supabase_url', true), '/') || '/functions/v1/send-push';

  -- Retrieve the service_role_key from Supabase Vault (secure, never hardcoded)
  SELECT decrypted_secret INTO svc_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;

  -- Fallback: if vault is not set up, try app.settings
  IF svc_key IS NULL OR svc_key = '' THEN
    svc_key := current_setting('app.settings.service_role_key', true);
  END IF;

  -- If we still don't have a key, use the function without auth
  -- (works because send-push is deployed with --no-verify-jwt)
  IF svc_key IS NULL THEN
    svc_key := '';
  END IF;

  -- Build the webhook payload matching our Edge Function's expected format
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'tasks',
    'schema', 'public',
    'record', jsonb_build_object(
      'id', NEW.id,
      'title', NEW.title,
      'description', NEW.description,
      'employee_id', NEW.employee_id,
      'status', NEW.status,
      'location', NEW.location
    )
  );

  -- Send async HTTP POST to the Edge Function via pg_net
  PERFORM net.http_post(
    url := edge_url,
    body := payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block task creation if notification fails
    RAISE WARNING '[notify_new_task] Push notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- 3. Create the trigger on the tasks table
DROP TRIGGER IF EXISTS on_task_created_notify ON public.tasks;
CREATE TRIGGER on_task_created_notify
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_task();
