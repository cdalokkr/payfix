-- ============================================
-- COMPLETE RLS FIX FOR PROFILES, ACTIVITIES, AND ANALYTICS_METRICS
-- ============================================
-- This migration completely resets and fixes RLS policies to resolve
-- the "Profile not found" issue during login.
--
-- PROBLEM: The previous RLS policies had a circular dependency where
-- checking if a user is an admin required querying the profiles table,
-- but querying the profiles table required passing RLS checks first.
--
-- SOLUTION: Use a SECURITY DEFINER function to check admin status,
-- which bypasses RLS for the admin check only.
-- ============================================

-- ============================================
-- STEP 1: DROP ALL EXISTING POLICIES
-- ============================================

-- Drop all policies on profiles table
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Enable read access for users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON profiles;

-- Drop all policies on activities table
DROP POLICY IF EXISTS "Admins can view all activities" ON activities;
DROP POLICY IF EXISTS "Admins can insert activities" ON activities;
DROP POLICY IF EXISTS "Admins can update activities" ON activities;
DROP POLICY IF EXISTS "Admins can delete activities" ON activities;
DROP POLICY IF EXISTS "Users can view own activities" ON activities;
DROP POLICY IF EXISTS "Users can view their own activities" ON activities;
DROP POLICY IF EXISTS "Users can insert own activities" ON activities;
DROP POLICY IF EXISTS "activities_select_policy" ON activities;
DROP POLICY IF EXISTS "activities_insert_policy" ON activities;
DROP POLICY IF EXISTS "activities_update_policy" ON activities;
DROP POLICY IF EXISTS "activities_delete_policy" ON activities;

-- Drop all policies on analytics_metrics table
DROP POLICY IF EXISTS "Admins can view all analytics" ON analytics_metrics;
DROP POLICY IF EXISTS "Admins can insert analytics" ON analytics_metrics;
DROP POLICY IF EXISTS "Admins can update analytics" ON analytics_metrics;
DROP POLICY IF EXISTS "Admins can delete analytics" ON analytics_metrics;
DROP POLICY IF EXISTS "analytics_select_policy" ON analytics_metrics;
DROP POLICY IF EXISTS "analytics_insert_policy" ON analytics_metrics;
DROP POLICY IF EXISTS "analytics_update_policy" ON analytics_metrics;
DROP POLICY IF EXISTS "analytics_delete_policy" ON analytics_metrics;

-- ============================================
-- STEP 2: DISABLE AND RE-ENABLE RLS
-- ============================================

-- Temporarily disable RLS to ensure clean state
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_metrics DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: CREATE HELPER FUNCTION FOR ADMIN CHECK
-- ============================================
-- This function uses SECURITY DEFINER to bypass RLS when checking admin status
-- This prevents the circular dependency issue

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get the role directly without RLS interference
  SELECT role INTO user_role
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================
-- STEP 4: CREATE PROFILES TABLE POLICIES
-- ============================================

-- CRITICAL: Users can ALWAYS read their own profile
-- This is the most important policy for login to work
CREATE POLICY "profiles_own_select"
ON profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can update their own profile
CREATE POLICY "profiles_own_update"
ON profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admins can view ALL profiles (uses helper function to avoid circular dependency)
CREATE POLICY "profiles_admin_select"
ON profiles
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Admins can insert profiles
CREATE POLICY "profiles_admin_insert"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Admins can update ALL profiles
CREATE POLICY "profiles_admin_update"
ON profiles
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Admins can delete profiles
CREATE POLICY "profiles_admin_delete"
ON profiles
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================
-- STEP 5: CREATE ACTIVITIES TABLE POLICIES
-- ============================================

-- Users can view their own activities
CREATE POLICY "activities_own_select"
ON activities
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own activities (for logging login/logout)
CREATE POLICY "activities_own_insert"
ON activities
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Admins can view ALL activities
CREATE POLICY "activities_admin_select"
ON activities
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Admins can insert activities
CREATE POLICY "activities_admin_insert"
ON activities
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Admins can update activities
CREATE POLICY "activities_admin_update"
ON activities
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Admins can delete activities
CREATE POLICY "activities_admin_delete"
ON activities
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================
-- STEP 6: CREATE ANALYTICS_METRICS TABLE POLICIES
-- ============================================

-- Only admins can access analytics_metrics
CREATE POLICY "analytics_admin_select"
ON analytics_metrics
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "analytics_admin_insert"
ON analytics_metrics
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "analytics_admin_update"
ON analytics_metrics
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "analytics_admin_delete"
ON analytics_metrics
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================
-- STEP 7: ENABLE REALTIME FOR TABLES
-- ============================================

-- Enable realtime for profiles table
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- Enable realtime for activities table  
ALTER PUBLICATION supabase_realtime ADD TABLE activities;

-- Enable realtime for analytics_metrics table
ALTER PUBLICATION supabase_realtime ADD TABLE analytics_metrics;

-- ============================================
-- STEP 8: SET REPLICA IDENTITY FOR REALTIME
-- ============================================
-- REPLICA IDENTITY FULL is required for realtime to work properly
-- It ensures all column values are sent in change events

ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE activities REPLICA IDENTITY FULL;
ALTER TABLE analytics_metrics REPLICA IDENTITY FULL;

-- ============================================
-- VERIFICATION QUERIES (Run these manually to verify)
-- ============================================

-- Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename IN ('profiles', 'activities', 'analytics_metrics');

-- Check policies are created:
-- SELECT schemaname, tablename, policyname, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename IN ('profiles', 'activities', 'analytics_metrics')
-- ORDER BY tablename, policyname;

-- Check realtime is enabled:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Test the is_admin function (run as authenticated user):
-- SELECT public.is_admin();

-- ============================================
-- TROUBLESHOOTING
-- ============================================
-- If you still have issues after running this migration:
--
-- 1. Check if the user exists in profiles table:
--    SELECT * FROM profiles WHERE user_id = '<user-uuid>';
--
-- 2. Check if auth.uid() returns the correct value:
--    SELECT auth.uid();
--
-- 3. Verify the user_id column matches auth.users.id:
--    SELECT p.user_id, u.id as auth_id 
--    FROM profiles p 
--    JOIN auth.users u ON p.user_id = u.id;
--
-- 4. If realtime ADD TABLE fails (table already in publication):
--    This is safe to ignore - it means the table is already enabled for realtime