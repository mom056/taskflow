-- Migration: Drop Avatars Listing Policy & Re-align Notify Search Path
-- Description: Drop wide SELECT policy on storage.objects for avatars bucket (public access is preserved for direct URLs as the bucket is public). Also re-align notify_new_task search_path.

-- 1. Drop public directory listing policy for avatars
DROP POLICY IF EXISTS "Avatars Public Read Access" ON storage.objects;

-- 2. Correct search_path for task notification trigger
ALTER FUNCTION public.notify_new_task() SET search_path = public, extensions, net, vault, pg_temp;
