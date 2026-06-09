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
SET search_path = public, extensions
AS $$
DECLARE
  payload JSONB;
  edge_url TEXT := 'https://bzsmwmkgmropuadpkcku.supabase.co/functions/v1/send-push';
  anon_key TEXT := 'sb_publishable_VLdhRDLScUw840uLwBNI1w_LVrWuDfU';
BEGIN
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
      'Authorization', 'Bearer ' || anon_key
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
