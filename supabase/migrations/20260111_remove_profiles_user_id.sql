-- ============================================
-- MIGRATION: Remove Redundant user_id Column from Profiles
-- Date: 2026-01-11
-- Purpose: Remove redundant user_id column since profiles.id already references auth.users.id
-- ============================================

-- =============================================================================
-- SECTION 1: FIX sync_status_to_auth_metadata FUNCTION 
-- Change from using NEW.user_id (which can be NULL) to NEW.id
-- =============================================================================

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
  WHERE id = NEW.id;  -- Changed from NEW.user_id to NEW.id
  RETURN NEW;
END;
$$;

-- =============================================================================
-- SECTION 2: DROP user_id COLUMN AND ITS CONSTRAINTS
-- =============================================================================

-- Drop the unique constraint on user_id
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;

-- Drop the foreign key constraint on user_id
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- Drop the user_id column
ALTER TABLE profiles DROP COLUMN IF EXISTS user_id;

-- =============================================================================
-- SECTION 3: UPDATE RLS POLICIES (if any reference profiles.user_id)
-- Note: Most policies already use profiles.id since the migration 20260108
-- =============================================================================

-- Drop and recreate any policies that might reference user_id
-- (These should already be correct from previous migrations, but run to be safe)

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
    FOR SELECT TO authenticated
    USING (id = (SELECT auth.uid()) OR (SELECT is_admin_or_moderator()));

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles
    FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid()) OR (SELECT is_admin()))
    WITH CHECK (id = (SELECT auth.uid()) OR (SELECT is_admin()));

-- =============================================================================
-- SECTION 4: VERIFICATION COMMENT
-- =============================================================================

COMMENT ON TABLE profiles IS 'User profiles table - user_id column removed as redundant (id already references auth.users.id) - 2026-01-11';
