-- ============================================
-- ADD data_delete TO activity_type ENUM
-- ============================================
-- This migration adds the 'data_delete' value to the activity_type enum
-- to allow logging user deletion activities.
--
-- The activity_type column in the activities table uses an enum type
-- and 'data_delete' was not previously defined as a valid value.
-- ============================================

-- Add 'data_delete' to the activity_type enum
-- Note: PostgreSQL requires ALTER TYPE to add new enum values
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'data_delete';

-- ============================================
-- VERIFICATION QUERY
-- Run this after migration to verify the enum value was added:
-- SELECT enum_range(NULL::activity_type);
-- ============================================
