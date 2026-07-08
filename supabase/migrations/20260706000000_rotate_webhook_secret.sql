-- ============================================================
-- Migration: Rotate Webhook Secret & Enable Dynamic Vault Storage
-- ============================================================

-- 1. Notice manually seeded vault secret requirement
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'webhook_secret') THEN
    -- The actual secret value is seeded manually via CLI or SQL Editor to prevent leakage in git.
    RAISE NOTICE 'webhook_secret not found in vault. Please seed it manually.';
  END IF;
END
$$;

-- 2. Re-create the notify_new_task trigger function to pull the secret dynamically from Vault
CREATE OR REPLACE FUNCTION public.notify_new_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net, vault, pg_temp
AS $$
DECLARE
  payload JSONB;
  webhook_secret TEXT;
  edge_url CONSTANT TEXT := 'https://bzsmwmkgmropuadpkcku.supabase.co/functions/v1/send-push';
BEGIN
  -- Fetch the rotated secret dynamically from vault decrypted secrets
  SELECT decrypted_secret INTO webhook_secret
  FROM vault.decrypted_secrets
  WHERE name = 'webhook_secret'
  LIMIT 1;

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
  PERFORM net.http_post(
    url := edge_url,
    body := payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', COALESCE(webhook_secret, '')
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block task creation/update if notification fails
    RAISE WARNING '[notify_new_task] Push notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$;
