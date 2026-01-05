-- ============================================
-- SETUP FRESH DATABASE: FULL SCHEMA
-- ============================================
-- This script contains the complete schema needed for a fresh Supabase setup.
-- Includes: Enums, Tables, Indexes, Functions, Triggers, and RLS Policies.
--
-- INSTRUCTIONS:
-- 1. Open Supabase SQL Editor.
-- 2. Paste this entire script and run it.
-- ============================================

-- 1. SETUP EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CREATE ENUMS
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

-- 3. CREATE TABLES

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
    user_id UUID REFERENCES auth.users(id) UNIQUE, -- Kept for backward compatibility if needed in legacy queries
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
    metric_type TEXT, -- (From migration 20251030160000)
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
    changed_by UUID CONSTRAINT user_status_history_changed_by_fkey REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_email_role ON profiles(email, role);
CREATE INDEX IF NOT EXISTS idx_profiles_first_name ON profiles(first_name);
CREATE INDEX IF NOT EXISTS idx_profiles_last_name ON profiles(last_name);

CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_user_created ON activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_date_range ON activities(created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_metric_date ON analytics_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_analytics_metric_type ON analytics_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_analytics_date_type ON analytics_metrics(metric_date, metric_type);

CREATE INDEX IF NOT EXISTS idx_user_status_history_target_user ON user_status_history(target_user_id);

-- 5. FUNCTIONS & TRIGGERS

-- Updated At Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_designations_updated_at ON public.designations;
CREATE TRIGGER update_designations_updated_at
    BEFORE UPDATE ON public.designations
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Status Metadata Sync
CREATE OR REPLACE FUNCTION public.sync_status_to_auth_metadata()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_status_to_auth ON public.profiles;
CREATE TRIGGER tr_sync_status_to_auth
    AFTER INSERT OR UPDATE OF status ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_status_to_auth_metadata();

-- Admin Check Helper
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role::TEXT INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Admin & Moderator Check Helper
CREATE OR REPLACE FUNCTION public.is_admin_or_moderator()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role::TEXT INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();
  RETURN user_role IN ('admin', 'moderator');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_admin_or_moderator() TO authenticated;

-- 6. RLS POLICIES

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_status_history ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_own_select" ON profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_own_update" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_select" ON profiles FOR SELECT TO authenticated USING (public.is_admin_or_moderator());
CREATE POLICY "profiles_admin_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "profiles_admin_update" ON profiles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "profiles_admin_delete" ON profiles FOR DELETE TO authenticated USING (public.is_admin());

-- Activities
CREATE POLICY "activities_own_select" ON activities FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "activities_own_insert" ON activities FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "activities_admin_select" ON activities FOR SELECT TO authenticated USING (public.is_admin_or_moderator());
CREATE POLICY "activities_admin_insert" ON activities FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "activities_admin_update" ON activities FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "activities_admin_delete" ON activities FOR DELETE TO authenticated USING (public.is_admin());

-- Analytics
CREATE POLICY "analytics_admin_select" ON analytics_metrics FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "analytics_admin_insert" ON analytics_metrics FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "analytics_admin_update" ON analytics_metrics FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "analytics_admin_delete" ON analytics_metrics FOR DELETE TO authenticated USING (public.is_admin());

-- Designations
CREATE POLICY "Allow authenticated users to read designations" ON designations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage designations" ON designations FOR ALL TO authenticated USING (public.is_admin());

-- Status History
CREATE POLICY "user_status_history_admin_select" ON user_status_history FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "user_status_history_admin_insert" ON user_status_history FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "user_status_history_own_select" ON user_status_history FOR SELECT TO authenticated USING (target_user_id = auth.uid());

-- 7. REALTIME & REPLICA
-- Note: PUBLICATIONS might fail if they already exist, but ADD TABLE is safe.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE profiles, activities, analytics_metrics, attendance, leaves;

ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE activities REPLICA IDENTITY FULL;
ALTER TABLE analytics_metrics REPLICA IDENTITY FULL;
ALTER TABLE attendance REPLICA IDENTITY FULL;
ALTER TABLE leaves REPLICA IDENTITY FULL;
