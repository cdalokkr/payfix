-- Migration: Fix RLS Performance and Security Issues
-- Addresses Supabase Performance Advisor warnings:
-- 1. Auth RLS InitPlan - wrap auth.uid() in (SELECT ...) for single evaluation
-- 2. Multiple Permissive Policies - consolidate overlapping policies
-- 3. Unindexed Foreign Keys - add missing indexes
-- 4. Function Search Path - add SET search_path for security

-- ============================================
-- 1. FIX OFFICE_LOCATIONS RLS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "admin_manage_office_locations" ON office_locations;
DROP POLICY IF EXISTS "all_view_active_locations" ON office_locations;

-- Create consolidated SELECT policy (fixes multiple permissive policies issue)
CREATE POLICY "office_locations_select" ON office_locations
    FOR SELECT
    TO authenticated
    USING (
        is_active = true 
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = (SELECT auth.uid()) 
            AND profiles.role = 'admin'
        )
    );

-- Create admin-only policy for INSERT/UPDATE/DELETE
CREATE POLICY "office_locations_admin_modify" ON office_locations
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = (SELECT auth.uid()) 
            AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = (SELECT auth.uid()) 
            AND profiles.role = 'admin'
        )
    );

-- ============================================
-- 2. FIX USER_MPIN RLS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "own_mpin_access" ON user_mpin;
DROP POLICY IF EXISTS "admin_view_mpin_status" ON user_mpin;

-- Create consolidated SELECT policy (fixes multiple permissive policies issue)
CREATE POLICY "user_mpin_select" ON user_mpin
    FOR SELECT
    TO authenticated
    USING (
        profile_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = (SELECT auth.uid()) 
            AND profiles.role = 'admin'
        )
    );

-- Users can only modify their own MPIN (INSERT/UPDATE/DELETE)
CREATE POLICY "user_mpin_own_modify" ON user_mpin
    FOR ALL
    TO authenticated
    USING (profile_id = (SELECT auth.uid()))
    WITH CHECK (profile_id = (SELECT auth.uid()));

-- ============================================
-- 3. FIX PUSH_SUBSCRIPTIONS RLS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "own_push_subscription" ON push_subscriptions;
DROP POLICY IF EXISTS "service_access_subscriptions" ON push_subscriptions;

-- Users can manage their own subscriptions (with optimized auth.uid())
CREATE POLICY "push_subscriptions_own" ON push_subscriptions
    FOR ALL
    TO authenticated
    USING (profile_id = (SELECT auth.uid()))
    WITH CHECK (profile_id = (SELECT auth.uid()));

-- Service role can access all for sending notifications
CREATE POLICY "push_subscriptions_service" ON push_subscriptions
    FOR SELECT
    TO service_role
    USING (true);

-- ============================================
-- 4. FIX PROFILE_PHOTO_REQUESTS RLS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Employees can view own photo requests" ON profile_photo_requests;
DROP POLICY IF EXISTS "Employees can create own photo requests" ON profile_photo_requests;
DROP POLICY IF EXISTS "Admins can view all photo requests" ON profile_photo_requests;
DROP POLICY IF EXISTS "Admins can update photo requests" ON profile_photo_requests;

-- Consolidated SELECT policy (fixes multiple permissive policies issue)
CREATE POLICY "photo_requests_select" ON profile_photo_requests
    FOR SELECT
    TO authenticated
    USING (
        profile_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = (SELECT auth.uid()) 
            AND profiles.role IN ('admin', 'moderator')
        )
    );

-- Employees can insert their own requests
CREATE POLICY "photo_requests_insert" ON profile_photo_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (profile_id = (SELECT auth.uid()));

-- Admins and moderators can update (approve/reject)
CREATE POLICY "photo_requests_update" ON profile_photo_requests
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = (SELECT auth.uid()) 
            AND profiles.role IN ('admin', 'moderator')
        )
    );

-- ============================================
-- 5. ADD MISSING FOREIGN KEY INDEXES
-- ============================================

-- attendance.verified_by
CREATE INDEX IF NOT EXISTS idx_attendance_verified_by 
ON attendance(verified_by);

-- leaves.approved_by
CREATE INDEX IF NOT EXISTS idx_leaves_approved_by 
ON leaves(approved_by);

-- office_locations.created_by
CREATE INDEX IF NOT EXISTS idx_office_locations_created_by 
ON office_locations(created_by);

-- profile_photo_requests.reviewed_by
CREATE INDEX IF NOT EXISTS idx_photo_requests_reviewed_by 
ON profile_photo_requests(reviewed_by);

-- profiles.designation_id
CREATE INDEX IF NOT EXISTS idx_profiles_designation_id 
ON profiles(designation_id);

-- user_status_history indexes
CREATE INDEX IF NOT EXISTS idx_user_status_history_actor 
ON user_status_history(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_user_status_history_changed_by 
ON user_status_history(changed_by);

CREATE INDEX IF NOT EXISTS idx_user_status_history_profile 
ON user_status_history(profile_id);

CREATE INDEX IF NOT EXISTS idx_user_status_history_target 
ON user_status_history(target_user_id);

-- ============================================
-- 6. FIX FUNCTION SEARCH PATH (SECURITY)
-- ============================================

-- Recreate is_within_geofence with fixed search_path
CREATE OR REPLACE FUNCTION is_within_geofence(
    user_lat NUMERIC,
    user_lng NUMERIC
) RETURNS TABLE (
    is_allowed BOOLEAN,
    location_name TEXT,
    distance_meters NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        true AS is_allowed,
        ol.name AS location_name,
        ROUND(
            6371000 * acos(
                cos(radians(user_lat)) * cos(radians(ol.latitude)) *
                cos(radians(ol.longitude) - radians(user_lng)) +
                sin(radians(user_lat)) * sin(radians(ol.latitude))
            )
        ) AS distance_meters
    FROM office_locations ol
    WHERE ol.is_active = true
    AND 6371000 * acos(
        cos(radians(user_lat)) * cos(radians(ol.latitude)) *
        cos(radians(ol.longitude) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(ol.latitude))
    ) <= ol.radius_meters
    ORDER BY distance_meters
    LIMIT 1;
    
    -- If no rows returned, user is outside all geofences
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            false AS is_allowed,
            (SELECT name FROM office_locations WHERE is_active = true ORDER BY 
                6371000 * acos(
                    cos(radians(user_lat)) * cos(radians(latitude)) *
                    cos(radians(longitude) - radians(user_lng)) +
                    sin(radians(user_lat)) * sin(radians(latitude))
                ) LIMIT 1
            ) AS location_name,
            (SELECT ROUND(MIN(
                6371000 * acos(
                    cos(radians(user_lat)) * cos(radians(latitude)) *
                    cos(radians(longitude) - radians(user_lng)) +
                    sin(radians(user_lat)) * sin(radians(latitude))
                )
            )) FROM office_locations WHERE is_active = true) AS distance_meters;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate update_updated_at_column with fixed search_path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================
-- UNUSED INDEXES (KEPT - NO CHANGES)
-- ============================================
-- The following indexes are reported as unused but are kept:
-- - idx_profiles_email
-- - idx_profiles_status
-- - idx_analytics_metric_date
-- - idx_attendance_profile_id
-- - idx_leaves_dates
-- - idx_office_locations_active
-- - idx_attendance_mobile
-- - idx_push_subscriptions_profile_active
