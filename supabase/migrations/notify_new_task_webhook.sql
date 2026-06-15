-- ============================================================
-- Database Webhook: Notify user when task is created or updated
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
  -- The Supabase project URL is public (same as VITE_SUPABASE_URL in .env).
  -- The Edge Function is deployed with --no-verify-jwt, so no auth header is needed.
  edge_url CONSTANT TEXT := 'https://bzsmwmkgmropuadpkcku.supabase.co/functions/v1/send-push';
BEGIN
  -- Build the webhook payload matching our Edge Function's expected format
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

  -- Send async HTTP POST to the Edge Function via pg_net
  -- No Authorization header needed (function deployed with --no-verify-jwt)
  PERFORM net.http_post(
    url := edge_url,
    body := payload,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block task creation/update if notification fails
    RAISE WARNING '[notify_new_task] Push notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- 3. Create the trigger on the tasks table
DROP TRIGGER IF EXISTS on_task_created_notify ON public.tasks;
CREATE TRIGGER on_task_created_notify
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_task();

