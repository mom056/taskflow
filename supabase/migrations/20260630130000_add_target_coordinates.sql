-- ============================================================
-- SQL Migration: 20260630130000_add_target_coordinates.sql
-- Goal: Enable proactive geofencing by storing target coordinates
-- ============================================================

-- Add target location coordinates to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS target_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS target_longitude DECIMAL(11, 8);

-- Add comments for documentation
COMMENT ON COLUMN public.tasks.target_latitude IS 'Target location GPS latitude set by the manager';
COMMENT ON COLUMN public.tasks.target_longitude IS 'Target location GPS longitude set by the manager';
