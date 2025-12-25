-- ============================================
-- Add RLS Policies for Dashboard Realtime
-- ============================================
-- This migration enables Row Level Security and adds policies
-- to allow admin users to receive realtime updates across all clients.
-- Without these policies, Supabase Realtime will not broadcast changes
-- to other connected clients.

-- ============================================
-- PROFILES TABLE
-- ============================================

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Admins can insert profiles
CREATE POLICY "Admins can insert profiles"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
ON profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Admins can delete profiles
CREATE POLICY "Admins can delete profiles"
ON profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
ON profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- ============================================
-- ACTIVITIES TABLE
-- ============================================

-- Enable RLS on activities table
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all activities
CREATE POLICY "Admins can view all activities"
ON activities
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Admins can insert activities
CREATE POLICY "Admins can insert activities"
ON activities
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Admins can update activities
CREATE POLICY "Admins can update activities"
ON activities
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Admins can delete activities
CREATE POLICY "Admins can delete activities"
ON activities
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Users can view their own activities
CREATE POLICY "Users can view own activities"
ON activities
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- ============================================
-- ANALYTICS_METRICS TABLE
-- ============================================

-- Enable RLS on analytics_metrics table
ALTER TABLE analytics_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all analytics
CREATE POLICY "Admins can view all analytics"
ON analytics_metrics
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Admins can insert analytics
CREATE POLICY "Admins can insert analytics"
ON analytics_metrics
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Admins can update analytics
CREATE POLICY "Admins can update analytics"
ON analytics_metrics
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Admins can delete analytics
CREATE POLICY "Admins can delete analytics"
ON analytics_metrics
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('profiles', 'activities', 'analytics_metrics');

-- Verify policies are created
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename IN ('profiles', 'activities', 'analytics_metrics');
