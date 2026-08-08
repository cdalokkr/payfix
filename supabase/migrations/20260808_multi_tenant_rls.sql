-- =========================================================================
-- Supabase Migration: Resilient Multi-Tenant Row Level Security (RLS)
-- PayFix SaaS Multi-Tenant Architecture (Safe for Missing / Dynamic Tables)
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
-- 2. Profiles Table RLS Policies
-- =========================================================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can view active profiles" ON profiles;
    CREATE POLICY "Users can view active profiles" ON profiles FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.is_admin());

    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated
    USING (id = auth.uid() OR public.is_admin())
    WITH CHECK (id = auth.uid() OR public.is_admin());

    DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
    CREATE POLICY "Admins can insert profiles" ON profiles FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

    DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
    CREATE POLICY "Admins can delete profiles" ON profiles FOR DELETE TO authenticated
    USING (public.is_admin());

    CREATE INDEX IF NOT EXISTS idx_profiles_user_role ON profiles (id, role);
  END IF;
END $$;

-- =========================================================================
-- 3. Attendance Table RLS Policies
-- =========================================================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance') THEN
    ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
    ALTER TABLE attendance FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can view own attendance" ON attendance;
    CREATE POLICY "Users can view own attendance" ON attendance FOR SELECT TO authenticated
    USING (profile_id = auth.uid() OR public.is_admin());

    DROP POLICY IF EXISTS "Members can insert attendance" ON attendance;
    CREATE POLICY "Members can insert attendance" ON attendance FOR INSERT TO authenticated
    WITH CHECK (profile_id = auth.uid() OR public.is_admin());

    DROP POLICY IF EXISTS "Admins can update attendance" ON attendance;
    CREATE POLICY "Admins can update attendance" ON attendance FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

    CREATE INDEX IF NOT EXISTS idx_attendance_profile_date ON attendance (profile_id, date DESC);
  END IF;
END $$;

-- =========================================================================
-- 4. Attendance Sessions Table RLS Policies
-- =========================================================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_sessions') THEN
    ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE attendance_sessions FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can view own attendance sessions" ON attendance_sessions;
    CREATE POLICY "Users can view own attendance sessions" ON attendance_sessions FOR SELECT TO authenticated
    USING (profile_id = auth.uid() OR public.is_admin());

    DROP POLICY IF EXISTS "Members can insert attendance sessions" ON attendance_sessions;
    CREATE POLICY "Members can insert attendance sessions" ON attendance_sessions FOR INSERT TO authenticated
    WITH CHECK (profile_id = auth.uid() OR public.is_admin());

    CREATE INDEX IF NOT EXISTS idx_attendance_sessions_profile_date ON attendance_sessions (profile_id, date DESC);
  END IF;
END $$;

-- =========================================================================
-- 5. Kiosk Devices Table RLS Policies (Safe Block)
-- =========================================================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kiosk_devices') THEN
    ALTER TABLE kiosk_devices ENABLE ROW LEVEL SECURITY;
    ALTER TABLE kiosk_devices FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Authenticated users can view kiosk devices" ON kiosk_devices;
    CREATE POLICY "Authenticated users can view kiosk devices" ON kiosk_devices FOR SELECT TO authenticated
    USING (true);

    DROP POLICY IF EXISTS "Admins can manage kiosk devices" ON kiosk_devices;
    CREATE POLICY "Admins can manage kiosk devices" ON kiosk_devices FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
  END IF;
END $$;

-- =========================================================================
-- 6. Office Locations Table RLS Policies (Safe Block)
-- =========================================================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'office_locations') THEN
    ALTER TABLE office_locations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE office_locations FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Authenticated users can view office locations" ON office_locations;
    CREATE POLICY "Authenticated users can view office locations" ON office_locations FOR SELECT TO authenticated
    USING (true);

    DROP POLICY IF EXISTS "Admins can manage office locations" ON office_locations;
    CREATE POLICY "Admins can manage office locations" ON office_locations FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
  END IF;
END $$;
