-- Migration: Setup Storage Buckets and Policies for Avatars, Company Logos, and Task Images

-- 1. Ensure storage buckets exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('task-images', 'task-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies to prevent duplicate definition conflicts
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Manager Insert Access" ON storage.objects;
DROP POLICY IF EXISTS "Manager Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Manager Delete Access" ON storage.objects;

DROP POLICY IF EXISTS "Avatars Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Avatars Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Avatars Update/Delete Access" ON storage.objects;

DROP POLICY IF EXISTS "Task Images Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Task Images Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Task Images Delete Access" ON storage.objects;

-- 3. 'avatars' Bucket Policies
-- A. Read Policy: Anyone can view avatars and company logos
CREATE POLICY "Avatars Public Read Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- B. Write Policies for 'company-logos' folder (Managers and Super Admins only)
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

-- C. Write Policies for 'avatars' folder (Any user can update/upload their own profile picture)
CREATE POLICY "Avatars Upload Access" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.filename(name)) LIKE (auth.uid()::text || '%')
  );

CREATE POLICY "Avatars Update/Delete Access" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.filename(name)) LIKE (auth.uid()::text || '%')
  );

-- 4. 'task-images' Bucket Policies
-- A. Read Policy: Anyone can view task completion proof images
CREATE POLICY "Task Images Public Read Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'task-images');

-- B. Upload Policy: Any authenticated user (employee/manager) can upload task images
CREATE POLICY "Task Images Upload Access" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-images'
  );

-- C. Delete Policy: Authenticated users can delete files in 'task-images' bucket
CREATE POLICY "Task Images Delete Access" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'task-images'
  );
