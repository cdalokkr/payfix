-- Migration: Add status to profiles and create user_status_history
-- Date: 2025-12-23

-- Add status column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deactive'));

-- Create user_status_history table
CREATE TABLE IF NOT EXISTS user_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    old_status TEXT CHECK (old_status IN ('active', 'deactive')),
    new_status TEXT NOT NULL CHECK (new_status IN ('active', 'deactive')),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    changed_by UUID REFERENCES profiles(id) -- Who made the change (Admin)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_status_history_profile_id ON user_status_history(profile_id);

-- Backfill existing users (if column was just added, they already have 'active' due to default)
-- But ensuring existing ones are indeed active
UPDATE profiles SET status = 'active' WHERE status IS NULL;
