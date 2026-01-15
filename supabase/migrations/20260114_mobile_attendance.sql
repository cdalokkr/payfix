-- Mobile Attendance Feature Migration
-- Adds support for:
-- 1. Office locations with geofencing
-- 2. User MPIN (6-digit mobile PIN)
-- 3. Push subscriptions for notifications
-- 4. Mobile attendance fields

-- ============================================
-- OFFICE LOCATIONS TABLE (for geofencing)
-- ============================================
CREATE TABLE IF NOT EXISTS office_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 200,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active locations
CREATE INDEX IF NOT EXISTS idx_office_locations_active 
ON office_locations(is_active) WHERE is_active = true;

-- RLS for office_locations
ALTER TABLE office_locations ENABLE ROW LEVEL SECURITY;

-- Admins can manage all locations
CREATE POLICY "admin_manage_office_locations" ON office_locations
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- All authenticated users can view active locations
CREATE POLICY "all_view_active_locations" ON office_locations
    FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Enable realtime for office_locations
ALTER PUBLICATION supabase_realtime ADD TABLE office_locations;

-- ============================================
-- USER MPIN TABLE (6-digit mobile PIN)
-- ============================================
CREATE TABLE IF NOT EXISTS user_mpin (
    profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    mpin_hash TEXT NOT NULL,
    biometric_enabled BOOLEAN DEFAULT false,
    biometric_credential_id TEXT,
    failed_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for user_mpin
ALTER TABLE user_mpin ENABLE ROW LEVEL SECURITY;

-- Users can only access their own MPIN
CREATE POLICY "own_mpin_access" ON user_mpin
    FOR ALL
    TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

-- Admins can view MPIN status (not hash) for support
CREATE POLICY "admin_view_mpin_status" ON user_mpin
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- ============================================
-- PUSH SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding user's active subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_profile_active 
ON push_subscriptions(profile_id, is_active) WHERE is_active = true;

-- RLS for push_subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "own_push_subscription" ON push_subscriptions
    FOR ALL
    TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

-- Service role can access all for sending notifications
CREATE POLICY "service_access_subscriptions" ON push_subscriptions
    FOR SELECT
    TO service_role
    USING (true);

-- ============================================
-- ADD MOBILE FIELDS TO ATTENDANCE TABLE
-- ============================================
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS selfie_url TEXT,
ADD COLUMN IF NOT EXISTS checkin_latitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS checkin_longitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS checkin_location_name TEXT,
ADD COLUMN IF NOT EXISTS face_match_score NUMERIC(5, 4);

-- Index for attendance records with mobile data
CREATE INDEX IF NOT EXISTS idx_attendance_mobile 
ON attendance(profile_id, date) 
WHERE selfie_url IS NOT NULL;

-- ============================================
-- HELPER FUNCTION: Check if within geofence
-- ============================================
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- UPDATE TRIGGER FOR updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for new tables
DROP TRIGGER IF EXISTS update_office_locations_updated_at ON office_locations;
CREATE TRIGGER update_office_locations_updated_at
    BEFORE UPDATE ON office_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_mpin_updated_at ON user_mpin;
CREATE TRIGGER update_user_mpin_updated_at
    BEFORE UPDATE ON user_mpin
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT SELECT ON office_locations TO authenticated;
GRANT ALL ON office_locations TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON user_mpin TO authenticated;
GRANT ALL ON user_mpin TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO authenticated;
GRANT ALL ON push_subscriptions TO service_role;
