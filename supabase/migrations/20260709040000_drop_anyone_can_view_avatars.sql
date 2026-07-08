-- Migration: Drop 'Anyone can view avatars' Policy
-- Description: Drop the remote legacy SELECT policy named 'Anyone can view avatars' on storage.objects to resolve directory listing security vulnerability.

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
