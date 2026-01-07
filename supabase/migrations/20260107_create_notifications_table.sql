-- ============================================
-- Migration: Create Notifications Table
-- Creates the notifications table with indexes
-- for real-time bi-directional updates
-- ============================================

-- Drop table if exists (for clean re-run)
DROP TABLE IF EXISTS notifications CASCADE;

-- Create notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    type TEXT,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT
    USING (auth.uid() = user_id);

-- RLS Policy: Allow insert for authenticated users
CREATE POLICY "Authenticated users can create notifications" ON notifications
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policy: Users can update their own notifications
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Enable Realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Grant permissions
GRANT ALL ON notifications TO authenticated;
GRANT ALL ON notifications TO service_role;

COMMENT ON TABLE notifications IS 'Stores user notifications with real-time updates';
COMMENT ON COLUMN notifications.user_id IS 'UUID of the user who receives the notification';
COMMENT ON COLUMN notifications.type IS 'Notification type: attendance, activity, system, etc.';
COMMENT ON COLUMN notifications.link IS 'Optional link to related resource';
