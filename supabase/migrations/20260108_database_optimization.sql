-- ============================================
-- MIGRATION: Database Optimization
-- Date: 2026-01-08
-- Fixes: Security warnings, RLS performance, unused indexes
-- ============================================

-- =============================================================================
-- SECTION 1: FIX FUNCTION SEARCH_PATH SECURITY (2 functions)
-- =============================================================================

-- Fix sync_status_to_auth_metadata function
CREATE OR REPLACE FUNCTION public.sync_status_to_auth_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{status}',
    to_jsonb(NEW.status)
  )
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

-- Fix calculate_working_hours function
CREATE OR REPLACE FUNCTION calculate_working_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
        NEW.working_hours = EXTRACT(EPOCH FROM (NEW.check_out - NEW.check_in)) / 3600;
    END IF;
    RETURN NEW;
END;
$$;

-- =============================================================================
-- SECTION 2: FIX NOTIFICATIONS RLS POLICIES (auth.uid() per-row re-evaluation)
-- =============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

-- Recreate with optimized (SELECT auth.uid()) pattern
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Authenticated users can create notifications" ON notifications
    FOR INSERT
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE
    USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- SECTION 3: CONSOLIDATE MULTIPLE PERMISSIVE POLICIES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3.1 PROFILES TABLE: Consolidate SELECT and UPDATE policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_own_select" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
    FOR SELECT TO authenticated
    USING (id = (SELECT auth.uid()) OR (SELECT is_admin_or_moderator()));

DROP POLICY IF EXISTS "profiles_own_update" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles
    FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid()) OR (SELECT is_admin()))
    WITH CHECK (id = (SELECT auth.uid()) OR (SELECT is_admin()));

-- -----------------------------------------------------------------------------
-- 3.2 ACTIVITIES TABLE: Consolidate SELECT and INSERT policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "activities_own_select" ON activities;
DROP POLICY IF EXISTS "activities_admin_select" ON activities;
CREATE POLICY "activities_select" ON activities
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR (SELECT is_admin_or_moderator()));

DROP POLICY IF EXISTS "activities_own_insert" ON activities;
DROP POLICY IF EXISTS "activities_admin_insert" ON activities;
CREATE POLICY "activities_insert" ON activities
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT is_admin()));

-- -----------------------------------------------------------------------------
-- 3.3 ATTENDANCE TABLE: Consolidate SELECT and UPDATE policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read their own attendance" ON attendance;
DROP POLICY IF EXISTS "Admins/Moderators can manage all attendance" ON attendance;
CREATE POLICY "attendance_select" ON attendance
    FOR SELECT TO authenticated
    USING (profile_id = (SELECT auth.uid()) OR (SELECT is_admin_or_moderator()));

DROP POLICY IF EXISTS "Users can update their own check_out" ON attendance;
DROP POLICY IF EXISTS "Admins/Moderators can update all attendance" ON attendance;
CREATE POLICY "attendance_update" ON attendance
    FOR UPDATE TO authenticated
    USING (profile_id = (SELECT auth.uid()) OR (SELECT is_admin_or_moderator()))
    WITH CHECK (profile_id = (SELECT auth.uid()) OR (SELECT is_admin_or_moderator()));

-- -----------------------------------------------------------------------------
-- 3.4 LEAVES TABLE: Consolidate SELECT policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read their own leaves" ON leaves;
DROP POLICY IF EXISTS "Admins/Moderators can manage all leaves" ON leaves;
CREATE POLICY "leaves_select" ON leaves
    FOR SELECT TO authenticated
    USING (profile_id = (SELECT auth.uid()) OR (SELECT is_admin_or_moderator()));

-- -----------------------------------------------------------------------------
-- 3.5 EMPLOYEE_SETTINGS TABLE: Consolidate SELECT policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read their own employee settings" ON employee_settings;
DROP POLICY IF EXISTS "Admins can manage all employee settings" ON employee_settings;
CREATE POLICY "employee_settings_select" ON employee_settings
    FOR SELECT TO authenticated
    USING (profile_id = (SELECT auth.uid()) OR (SELECT is_admin()));

-- Keep the ALL policy for admin management
CREATE POLICY "employee_settings_admin_all" ON employee_settings
    FOR ALL TO authenticated
    USING ((SELECT is_admin()));

-- -----------------------------------------------------------------------------
-- 3.6 DESIGNATIONS TABLE: Remove redundant policy
-- The "FOR ALL" policy already covers SELECT for admins
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage designations" ON designations;
-- Keep only the read policy for all authenticated users
-- "Allow authenticated users to read designations" stays as-is

-- Recreate admin management policy without SELECT overlap
CREATE POLICY "Admins can insert designations" ON designations
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT is_admin()));

CREATE POLICY "Admins can update designations" ON designations
    FOR UPDATE TO authenticated
    USING ((SELECT is_admin()));

CREATE POLICY "Admins can delete designations" ON designations
    FOR DELETE TO authenticated
    USING ((SELECT is_admin()));

-- -----------------------------------------------------------------------------
-- 3.7 OFFICE_SETTINGS TABLE: Remove redundant policy
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage office settings" ON office_settings;
-- Keep "Allow authenticated users to read office settings" for reads

CREATE POLICY "Admins can insert office settings" ON office_settings
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT is_admin()));

CREATE POLICY "Admins can update office settings" ON office_settings
    FOR UPDATE TO authenticated
    USING ((SELECT is_admin()));

CREATE POLICY "Admins can delete office settings" ON office_settings
    FOR DELETE TO authenticated
    USING ((SELECT is_admin()));

-- -----------------------------------------------------------------------------
-- 3.8 OFFICE_CLOSURES TABLE: Remove redundant policy
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage office closures" ON office_closures;
-- Keep "Allow authenticated users to read office closures" for reads

CREATE POLICY "Admins can insert office closures" ON office_closures
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT is_admin()));

CREATE POLICY "Admins can update office closures" ON office_closures
    FOR UPDATE TO authenticated
    USING ((SELECT is_admin()));

CREATE POLICY "Admins can delete office closures" ON office_closures
    FOR DELETE TO authenticated
    USING ((SELECT is_admin()));

-- -----------------------------------------------------------------------------
-- 3.9 USER_STATUS_HISTORY TABLE: Consolidate SELECT policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_status_history_own_select" ON user_status_history;
DROP POLICY IF EXISTS "user_status_history_admin_select" ON user_status_history;
CREATE POLICY "user_status_history_select" ON user_status_history
    FOR SELECT TO authenticated
    USING (target_user_id = (SELECT auth.uid()) OR (SELECT is_admin()));

-- =============================================================================
-- SECTION 4: REMOVE UNUSED INDEXES
-- Indexes confirmed not used by any application queries
-- =============================================================================

-- profiles table: Remove unused indexes
DROP INDEX IF EXISTS idx_profiles_created_at;
DROP INDEX IF EXISTS idx_profiles_first_name;
DROP INDEX IF EXISTS idx_profiles_last_name;

-- analytics_metrics table: Remove redundant single-column index
-- (composite index idx_analytics_date_type covers this)
DROP INDEX IF EXISTS idx_analytics_metric_type;

-- user_status_history table: Remove all unused FK indexes
-- These tables have very low query volume, no performance benefit
DROP INDEX IF EXISTS idx_user_status_history_target_user;
DROP INDEX IF EXISTS idx_user_status_history_actor_user_id;
DROP INDEX IF EXISTS idx_user_status_history_changed_by;
DROP INDEX IF EXISTS idx_user_status_history_profile_id;

-- =============================================================================
-- SECTION 5: VERIFICATION COMMENT
-- =============================================================================
COMMENT ON SCHEMA public IS 'Optimized: search_path fixed, RLS uses (SELECT auth.uid()), policies consolidated, unused indexes removed - 2026-01-08';
