-- =============================================================================
-- PERFORMANCE FIX: RLS Policy Optimization
-- Fixes auth.uid() being re-evaluated for each row by wrapping in SELECT
-- =============================================================================

-- =============================================================================
-- 1. FIX: profiles table RLS policies
-- =============================================================================

-- Drop and recreate profiles_own_select with optimized auth.uid()
DROP POLICY IF EXISTS "profiles_own_select" ON profiles;
CREATE POLICY "profiles_own_select" ON profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

-- Drop and recreate profiles_own_update with optimized auth.uid()
DROP POLICY IF EXISTS "profiles_own_update" ON profiles;
CREATE POLICY "profiles_own_update" ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()));

-- =============================================================================
-- 2. FIX: activities table RLS policies
-- =============================================================================

-- Drop and recreate activities_own_select with optimized auth.uid()
DROP POLICY IF EXISTS "activities_own_select" ON activities;
CREATE POLICY "activities_own_select" ON activities
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Drop and recreate activities_own_insert with optimized auth.uid()
DROP POLICY IF EXISTS "activities_own_insert" ON activities;
CREATE POLICY "activities_own_insert" ON activities
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- =============================================================================
-- 3. FIX: attendance table RLS policies
-- =============================================================================

-- Drop and recreate attendance policies with optimized auth.uid()
DROP POLICY IF EXISTS "Users can read their own attendance" ON attendance;
CREATE POLICY "Users can read their own attendance" ON attendance
  FOR SELECT
  TO authenticated
  USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own attendance" ON attendance;
CREATE POLICY "Users can insert their own attendance" ON attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own check_out" ON attendance;
CREATE POLICY "Users can update their own check_out" ON attendance
  FOR UPDATE
  TO authenticated
  USING (profile_id = (SELECT auth.uid()));

-- =============================================================================
-- 4. FIX: leaves table RLS policies
-- =============================================================================

DROP POLICY IF EXISTS "Users can read their own leaves" ON leaves;
CREATE POLICY "Users can read their own leaves" ON leaves
  FOR SELECT
  TO authenticated
  USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can apply for their own leaves" ON leaves;
CREATE POLICY "Users can apply for their own leaves" ON leaves
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = (SELECT auth.uid()));

-- =============================================================================
-- 5. FIX: employee_settings table RLS policies
-- =============================================================================

DROP POLICY IF EXISTS "Users can read their own employee settings" ON employee_settings;
CREATE POLICY "Users can read their own employee settings" ON employee_settings
  FOR SELECT
  TO authenticated
  USING (profile_id = (SELECT auth.uid()));

-- =============================================================================
-- 6. FIX: user_status_history table RLS policies
-- =============================================================================

DROP POLICY IF EXISTS "user_status_history_own_select" ON user_status_history;
CREATE POLICY "user_status_history_own_select" ON user_status_history
  FOR SELECT
  TO authenticated
  USING (profile_id = (SELECT auth.uid()));

-- =============================================================================
-- 7. ADD MISSING INDEXES for foreign keys
-- =============================================================================

-- Index for attendance.verified_by foreign key
CREATE INDEX IF NOT EXISTS idx_attendance_verified_by ON attendance(verified_by);

-- Index for leaves.approved_by foreign key
CREATE INDEX IF NOT EXISTS idx_leaves_approved_by ON leaves(approved_by);

-- Index for leaves.profile_id foreign key
CREATE INDEX IF NOT EXISTS idx_leaves_profile_id ON leaves(profile_id);

-- Index for profiles.designation_id foreign key
CREATE INDEX IF NOT EXISTS idx_profiles_designation_id ON profiles(designation_id);

-- Index for user_status_history foreign keys
CREATE INDEX IF NOT EXISTS idx_user_status_history_actor_user_id ON user_status_history(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_user_status_history_changed_by ON user_status_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_user_status_history_profile_id ON user_status_history(profile_id);

-- =============================================================================
-- 8. FIX: Function search_path security
-- =============================================================================

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix is_admin_or_moderator function
CREATE OR REPLACE FUNCTION is_admin_or_moderator()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'moderator')
  );
END;
$$;

-- Fix is_admin function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid())
    AND role = 'admin'
  );
END;
$$;

COMMENT ON SCHEMA public IS 'RLS policies optimized for performance - auth.uid() wrapped in SELECT for single evaluation';
