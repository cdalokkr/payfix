-- Migration: Add RLS for user_status_history
-- Date: 2025-12-23

-- Enable RLS
ALTER TABLE user_status_history ENABLE ROW LEVEL SECURITY;

-- Admins can view all status history
CREATE POLICY "user_status_history_admin_select"
ON user_status_history
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Admins can insert status history
CREATE POLICY "user_status_history_admin_insert"
ON user_status_history
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Users can view their own status history
CREATE POLICY "user_status_history_own_select"
ON user_status_history
FOR SELECT
TO authenticated
USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
));

-- No updates or deletes allowed for status history (audit trail should be immutable)
