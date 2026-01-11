-- ============================================
-- SETUP FRESH DATABASE: FULL OPTIMIZED SCHEMA
-- ============================================
-- This script contains the complete schema needed for a fresh Supabase setup.
-- Includes: Enums, Tables, Indexes, Functions, Triggers, and Optimized RLS Policies.
--
-- OPTIMIZATIONS APPLIED:
-- 1. RLS policies use (SELECT auth.uid()) for single evaluation per query
-- 2. Consolidated policies to avoid multiple permissive policies per role/action
-- 3. Functions have SET search_path for security
-- 4. Only essential indexes included (removed unused ones)
--
-- INSTRUCTIONS:
-- 1. Open Supabase SQL Editor.
-- 2. Paste this entire script and run it.
-- 3. Then run seed-admin.sql for default data.
-- ============================================

-- =============================================================================
-- 1. SETUP EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 2. CREATE ENUMS
-- =============================================================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'moderator', 'employee');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE activity_type AS ENUM ('login', 'logout', 'profile_update', 'data_view', 'data_edit', 'data_delete', 'data_create');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- 3. CREATE TABLES
-- =============================================================================

-- DESIGNATIONS
CREATE TABLE IF NOT EXISTS public.designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'moderator', 'employee')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role user_role DEFAULT 'employee',
    designation_id UUID REFERENCES public.designations(id) ON DELETE SET NULL,
    first_name VARCHAR(255),
    middle_name TEXT,
    last_name VARCHAR(255),
    mobile_no VARCHAR(20),
    date_of_birth DATE,
    sex TEXT CHECK (sex IN ('male', 'female', 'other', 'prefer_not_to_say')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deactive', 'deleted')),
    allowed_modules TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ACTIVITIES
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    activity_type activity_type NOT NULL,
    module TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ANALYTICS_METRICS
CREATE TABLE IF NOT EXISTS public.analytics_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name TEXT NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_date DATE NOT NULL,
    metric_type TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- USER_STATUS_HISTORY
CREATE TABLE IF NOT EXISTS public.user_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES auth.users(id),
    actor_user_id UUID REFERENCES auth.users(id),
    old_status TEXT CHECK (old_status IN ('active', 'deactive', 'deleted')),
    new_status TEXT NOT NULL CHECK (new_status IN ('active', 'deactive', 'deleted')),
    reason TEXT,
    changed_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OFFICE SETTINGS
CREATE TABLE IF NOT EXISTS public.office_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    default_check_in TIME NOT NULL DEFAULT '10:00:00',
    default_check_out TIME NOT NULL DEFAULT '19:00:00',
    off_days INTEGER[] DEFAULT array[0],
    daily_working_hours JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OFFICE CLOSURES
CREATE TABLE IF NOT EXISTS public.office_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('holiday', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- EMPLOYEE SETTINGS
CREATE TABLE IF NOT EXISTS public.employee_settings (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    custom_check_in TIME,
    custom_check_out TIME,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ATTENDANCE
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in TIMESTAMP WITH TIME ZONE,
    check_out TIMESTAMP WITH TIME ZONE,
    working_hours NUMERIC,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    remarks TEXT,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_extra_day BOOLEAN DEFAULT false,
    is_half_day BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(profile_id, date)
);

-- LEAVES
CREATE TABLE IF NOT EXISTS public.leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    leave_type TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    remarks TEXT,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_half_day BOOLEAN DEFAULT false,
    half_day_period TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (start_date <= end_date)
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    type TEXT,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 4. CREATE INDEXES (Only essential ones)
-- =============================================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email_role ON profiles(email, role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status) WHERE status = 'active';

-- Activities indexes
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_user_created ON activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_metric_date ON analytics_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_analytics_date_type ON analytics_metrics(metric_date, metric_type);

-- Attendance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_profile_id ON attendance(profile_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_profile_date ON attendance(profile_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);

-- Leaves indexes
CREATE INDEX IF NOT EXISTS idx_leaves_profile_id ON leaves(profile_id);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON leaves(status);
CREATE INDEX IF NOT EXISTS idx_leaves_dates ON leaves(start_date, end_date);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- =============================================================================
-- 5. FUNCTIONS & TRIGGERS (With SET search_path for security)
-- =============================================================================

-- Updated At Trigger Function
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

-- Status Metadata Sync Function
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
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Admin Check Helper Function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
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

-- Admin & Moderator Check Helper Function
CREATE OR REPLACE FUNCTION public.is_admin_or_moderator()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
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

-- Calculate Working Hours Function
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_moderator() TO authenticated;

-- Create Triggers
DROP TRIGGER IF EXISTS update_designations_updated_at ON public.designations;
CREATE TRIGGER update_designations_updated_at
    BEFORE UPDATE ON public.designations
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS tr_sync_status_to_auth ON public.profiles;
CREATE TRIGGER tr_sync_status_to_auth
    AFTER INSERT OR UPDATE OF status ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.sync_status_to_auth_metadata();

DROP TRIGGER IF EXISTS update_office_settings_updated_at ON public.office_settings;
CREATE TRIGGER update_office_settings_updated_at
    BEFORE UPDATE ON public.office_settings
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_employee_settings_updated_at ON public.employee_settings;
CREATE TRIGGER update_employee_settings_updated_at
    BEFORE UPDATE ON public.employee_settings
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_attendance_updated_at ON public.attendance;
CREATE TRIGGER update_attendance_updated_at
    BEFORE UPDATE ON public.attendance
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_leaves_updated_at ON public.leaves;
CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS tr_calculate_working_hours ON public.attendance;
CREATE TRIGGER tr_calculate_working_hours
    BEFORE INSERT OR UPDATE OF check_in, check_out ON public.attendance
    FOR EACH ROW EXECUTE FUNCTION calculate_working_hours();

-- =============================================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 7. RLS POLICIES (Optimized - consolidated, using SELECT auth.uid())
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PROFILES (Consolidated: no multiple permissive SELECT/UPDATE)
-- -----------------------------------------------------------------------------
CREATE POLICY "profiles_select" ON profiles
    FOR SELECT TO authenticated
    USING (id = (SELECT auth.uid()) OR (SELECT is_admin_or_moderator()));

CREATE POLICY "profiles_update" ON profiles
    FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid()) OR (SELECT is_admin()))
    WITH CHECK (id = (SELECT auth.uid()) OR (SELECT is_admin()));

CREATE POLICY "profiles_admin_insert" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT is_admin()));

CREATE POLICY "profiles_admin_delete" ON profiles
    FOR DELETE TO authenticated
    USING ((SELECT is_admin()));

-- -----------------------------------------------------------------------------
-- ACTIVITIES (Consolidated)
-- -----------------------------------------------------------------------------
CREATE POLICY "activities_select" ON activities
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR (SELECT is_admin_or_moderator()));

CREATE POLICY "activities_insert" ON activities
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT is_admin()));

CREATE POLICY "activities_admin_update" ON activities
    FOR UPDATE TO authenticated
    USING ((SELECT is_admin()))
    WITH CHECK ((SELECT is_admin()));

CREATE POLICY "activities_admin_delete" ON activities
    FOR DELETE TO authenticated
    USING ((SELECT is_admin()));

-- -----------------------------------------------------------------------------
-- ANALYTICS
-- -----------------------------------------------------------------------------
CREATE POLICY "analytics_admin_select" ON analytics_metrics
    FOR SELECT TO authenticated
    USING ((SELECT is_admin()));

CREATE POLICY "analytics_admin_insert" ON analytics_metrics
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT is_admin()));

CREATE POLICY "analytics_admin_update" ON analytics_metrics
    FOR UPDATE TO authenticated
    USING ((SELECT is_admin()))
    WITH CHECK ((SELECT is_admin()));

CREATE POLICY "analytics_admin_delete" ON analytics_metrics
    FOR DELETE TO authenticated
    USING ((SELECT is_admin()));

-- -----------------------------------------------------------------------------
-- DESIGNATIONS (All authenticated can read, admins manage)
-- -----------------------------------------------------------------------------
CREATE POLICY "designations_read" ON designations
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "designations_admin_insert" ON designations
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT is_admin()));

CREATE POLICY "designations_admin_update" ON designations
    FOR UPDATE TO authenticated
    USING ((SELECT is_admin()));

CREATE POLICY "designations_admin_delete" ON designations
    FOR DELETE TO authenticated
    USING ((SELECT is_admin()));

-- -----------------------------------------------------------------------------
-- USER_STATUS_HISTORY (Consolidated)
-- -----------------------------------------------------------------------------
CREATE POLICY "user_status_history_select" ON user_status_history
    FOR SELECT TO authenticated
    USING (target_user_id = (SELECT auth.uid()) OR (SELECT is_admin()));

CREATE POLICY "user_status_history_admin_insert" ON user_status_history
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT is_admin()));

-- -----------------------------------------------------------------------------
-- OFFICE_SETTINGS (All authenticated can read, admins manage)
-- -----------------------------------------------------------------------------
CREATE POLICY "office_settings_read" ON office_settings
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "office_settings_admin_insert" ON office_settings
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT is_admin()));

CREATE POLICY "office_settings_admin_update" ON office_settings
    FOR UPDATE TO authenticated
    USING ((SELECT is_admin()));

CREATE POLICY "office_settings_admin_delete" ON office_settings
    FOR DELETE TO authenticated
    USING ((SELECT is_admin()));

-- -----------------------------------------------------------------------------
-- OFFICE_CLOSURES (All authenticated can read, admins manage)
-- -----------------------------------------------------------------------------
CREATE POLICY "office_closures_read" ON office_closures
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "office_closures_admin_insert" ON office_closures
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT is_admin()));

CREATE POLICY "office_closures_admin_update" ON office_closures
    FOR UPDATE TO authenticated
    USING ((SELECT is_admin()));

CREATE POLICY "office_closures_admin_delete" ON office_closures
    FOR DELETE TO authenticated
    USING ((SELECT is_admin()));

-- -----------------------------------------------------------------------------
-- EMPLOYEE_SETTINGS (Consolidated)
-- -----------------------------------------------------------------------------
CREATE POLICY "employee_settings_select" ON employee_settings
    FOR SELECT TO authenticated
    USING (profile_id = (SELECT auth.uid()) OR (SELECT is_admin()));

CREATE POLICY "employee_settings_admin_insert" ON employee_settings
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT is_admin()));

CREATE POLICY "employee_settings_admin_update" ON employee_settings
    FOR UPDATE TO authenticated
    USING ((SELECT is_admin()));

CREATE POLICY "employee_settings_admin_delete" ON employee_settings
    FOR DELETE TO authenticated
    USING ((SELECT is_admin()));

-- -----------------------------------------------------------------------------
-- ATTENDANCE (Consolidated)
-- -----------------------------------------------------------------------------
CREATE POLICY "attendance_select" ON attendance
    FOR SELECT TO authenticated
    USING (profile_id = (SELECT auth.uid()) OR (SELECT is_admin_or_moderator()));

CREATE POLICY "attendance_insert" ON attendance
    FOR INSERT TO authenticated
    WITH CHECK (profile_id = (SELECT auth.uid()));

CREATE POLICY "attendance_update" ON attendance
    FOR UPDATE TO authenticated
    USING (profile_id = (SELECT auth.uid()) OR (SELECT is_admin_or_moderator()))
    WITH CHECK (profile_id = (SELECT auth.uid()) OR (SELECT is_admin_or_moderator()));

CREATE POLICY "attendance_admin_delete" ON attendance
    FOR DELETE TO authenticated
    USING ((SELECT is_admin()));

-- -----------------------------------------------------------------------------
-- LEAVES (Consolidated)
-- -----------------------------------------------------------------------------
CREATE POLICY "leaves_select" ON leaves
    FOR SELECT TO authenticated
    USING (profile_id = (SELECT auth.uid()) OR (SELECT is_admin_or_moderator()));

CREATE POLICY "leaves_insert" ON leaves
    FOR INSERT TO authenticated
    WITH CHECK (profile_id = (SELECT auth.uid()));

CREATE POLICY "leaves_update" ON leaves
    FOR UPDATE TO authenticated
    USING ((SELECT is_admin_or_moderator()))
    WITH CHECK ((SELECT is_admin_or_moderator()));

CREATE POLICY "leaves_admin_delete" ON leaves
    FOR DELETE TO authenticated
    USING ((SELECT is_admin()));

-- -----------------------------------------------------------------------------
-- NOTIFICATIONS (Optimized)
-- -----------------------------------------------------------------------------
CREATE POLICY "notifications_select" ON notifications
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "notifications_insert" ON notifications
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "notifications_update" ON notifications
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- 8. GRANTS
-- =============================================================================
GRANT ALL ON notifications TO authenticated;
GRANT ALL ON notifications TO service_role;

-- =============================================================================
-- 9. REALTIME & REPLICA IDENTITY
-- =============================================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Add tables to realtime publication (ignore errors if already added)
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE activities;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE analytics_metrics;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE leaves;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Set replica identity for real-time updates
ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE activities REPLICA IDENTITY FULL;
ALTER TABLE analytics_metrics REPLICA IDENTITY FULL;
ALTER TABLE attendance REPLICA IDENTITY FULL;
ALTER TABLE leaves REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- =============================================================================
-- 10. DEFAULT DATA
-- =============================================================================

-- Insert default office settings
INSERT INTO public.office_settings (default_check_in, default_check_out, off_days)
SELECT '10:00:00', '19:00:00', array[0]
WHERE NOT EXISTS (SELECT 1 FROM public.office_settings);

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON SCHEMA public IS 'Optimized schema with consolidated RLS policies and secure functions - v2.0';
COMMENT ON TABLE notifications IS 'Stores user notifications with real-time updates';
COMMENT ON COLUMN notifications.type IS 'Notification type: attendance, activity, system, etc.';
