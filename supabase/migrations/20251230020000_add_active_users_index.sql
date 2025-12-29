-- ============================================
-- Add Composite Index for Active Users Query
-- Optimizes count(distinct user_id) filter (where created_at >= X)
-- ============================================

-- Composite index for active user counting (covers the distinct user_id filter pattern)
-- Note: Using non-concurrent index creation for compatibility with transaction blocks
CREATE INDEX IF NOT EXISTS idx_activities_active_users 
ON activities(created_at, user_id);

-- Analyze to update planner statistics
ANALYZE activities;
