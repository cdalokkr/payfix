-- ============================================
-- Database Performance Optimization Migration
-- Adds critical indexes for better query performance
-- ============================================

-- Indexes for profiles table (most frequently queried)
-- Index on email for user lookups and admin user searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Index on role for filtering users by admin/user role
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Index on created_at for ordering and time-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);

-- Composite index for common admin user queries (search + role filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_email_role ON profiles(email, role);

-- Index on first_name and last_name for name-based searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_first_name ON profiles(first_name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_last_name ON profiles(last_name);

-- Indexes for activities table (frequently used for analytics and audit trails)
-- Index on user_id for user-specific activity queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_user_id ON activities(user_id);

-- Index on created_at for time-based activity queries and recent activities
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);

-- Composite index for user activity filtering (user_id + time range)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_user_created ON activities(user_id, created_at DESC);

-- Index on activity_type for filtering by activity type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_type ON activities(activity_type);

-- Index on created_at only for date range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_date_range ON activities(created_at);

-- Composite index for recent activities with user details (for admin dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_recent_admin ON activities(created_at DESC, user_id) 
WHERE user_id IS NOT NULL;

-- Indexes for analytics_metrics table (used for analytics dashboards)
-- Index on metric_date for time-based analytics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_metric_date ON analytics_metrics(metric_date);

-- Index on metric_type if exists (for filtering metrics by type)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_metric_type ON analytics_metrics(metric_type);

-- Composite index for analytics date range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_date_type ON analytics_metrics(metric_date, metric_type);

-- Indexes for auth.users table (for admin user management)
-- Index on email for auth user lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_users_email ON auth.users(email);

-- Index on created_at for user creation time queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_users_created_at ON auth.users(created_at);

-- Index on email confirmation status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_users_email_confirmed ON auth.users(email_confirmed_at);

-- Performance optimization: Analyze tables after creating indexes
ANALYZE profiles;
ANALYZE activities;
ANALYZE analytics_metrics;
ANALYZE auth.users;

-- Add helpful comments for documentation
COMMENT ON INDEX idx_profiles_email IS 'Optimizes user lookup by email in admin interface';
COMMENT ON INDEX idx_profiles_role IS 'Filters users by admin/user role efficiently';
COMMENT ON INDEX idx_activities_user_created IS 'Accelerates user activity time-range queries';
COMMENT ON INDEX idx_activities_recent_admin IS 'Optimizes admin dashboard recent activities display';
COMMENT ON INDEX idx_analytics_metric_date IS 'Speeds up analytics time-series data queries';