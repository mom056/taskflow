-- Migration: Create Notifications Table and Policies
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN DEFAULT false,
  link TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Select policy: users can only view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Update policy: users can mark their own notifications as read
CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Insert policy: authenticated users can insert notifications (to support client-triggered notices)
CREATE POLICY "Users can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Ensure user belongs to the same company
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.company_id = notifications.company_id
    )
  );

-- Delete policy: users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
