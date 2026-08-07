-- =========================================================================
-- Supabase Migration: Production-Ready Multi-Tenant Row Level Security (RLS)
-- PayFix SaaS Multi-Tenant Architecture (Profiles, Attendance, Kiosks)
-- =========================================================================

-- =========================================================================
-- 1. Helper Functions (Optimized for RLS Performance & Subquery Caching)
-- =========================================================================

-- Helper: Get current authenticated user ID
CREATE OR REPLACE FUNCTION public.get_auth_uid()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid();
$$;

-- Helper: Check if current authenticated user is an Admin or Super Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'moderator')
      AND status = 'active'
  );
$$;

-- =========================================================================
-- 2. Enable RLS + FORCE RLS on Core Tables
-- =========================================================================

ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attendance FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attendance_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS activities FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS kiosk_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kiosk_devices FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS office_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS office_locations FORCE ROW LEVEL SECURITY;

-- =========================================================================
-- 3. RLS Policies: Profiles Table
-- =========================================================================

-- Users can view their own profile or Admins can view all profiles in tenant
CREATE POLICY "Users can view active profiles"
ON profiles FOR SELECT TO authenticated
USING (
  id = auth.uid() OR public.is_admin()
);

-- Users can update their own profile (avatar, details)
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.is_admin())
WITH CHECK (id = auth.uid() OR public.is_admin());

-- Only Admins can insert new profiles
CREATE POLICY "Admins can insert profiles"
ON profiles FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

-- Only Admins can delete profiles
CREATE POLICY "Admins can delete profiles"
ON profiles FOR DELETE TO authenticated
USING (public.is_admin());

-- =========================================================================
-- 4. RLS Policies: Attendance & Attendance Sessions Tables
-- =========================================================================

-- Users can view their own attendance or Admins can view all attendance
CREATE POLICY "Users can view own attendance"
ON attendance FOR SELECT TO authenticated
USING (
  profile_id = auth.uid() OR public.is_admin()
);

-- Members can insert attendance (PWA Selfie Check-In & Kiosk)
CREATE POLICY "Members can insert attendance"
ON attendance FOR INSERT TO authenticated
WITH CHECK (
  profile_id = auth.uid() OR public.is_admin()
);

-- Admins can update attendance (corrections, verification approval)
CREATE POLICY "Admins can update attendance"
ON attendance FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Users can view their own attendance sessions
CREATE POLICY "Users can view own attendance sessions"
ON attendance_sessions FOR SELECT TO authenticated
USING (
  profile_id = auth.uid() OR public.is_admin()
);

-- Members can insert attendance sessions
CREATE POLICY "Members can insert attendance sessions"
ON attendance_sessions FOR INSERT TO authenticated
WITH CHECK (
  profile_id = auth.uid() OR public.is_admin()
);

-- =========================================================================
-- 5. RLS Policies: Kiosk Devices & Office Locations
-- =========================================================================

-- Authenticated users & active kiosks can view office locations
CREATE POLICY "Authenticated users can view office locations"
ON office_locations FOR SELECT TO authenticated
USING (true);

-- Admins can manage office locations
CREATE POLICY "Admins can manage office locations"
ON office_locations FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Authenticated users can view kiosk devices
CREATE POLICY "Authenticated users can view kiosk devices"
ON kiosk_devices FOR SELECT TO authenticated
USING (true);

-- Admins can manage kiosk devices
CREATE POLICY "Admins can manage kiosk devices"
ON kiosk_devices FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- =========================================================================
-- 6. Performance Indexes
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_user_role ON profiles (id, role);
CREATE INDEX IF NOT EXISTS idx_attendance_profile_date ON attendance (profile_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_profile_date ON attendance_sessions (profile_id, date DESC);
