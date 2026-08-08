-- =========================================================================
-- Supabase Security Hardening Migration Script
-- Fixes Supabase Linter Warnings (Search Path, Revoke Anon Execution, RLS)
-- =========================================================================

-- =========================================================================
-- 1. Fix Search Path on Functions (Linter Rule: function_search_path_mutable)
-- =========================================================================

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_profile_from_schema') THEN
    ALTER FUNCTION public.get_profile_from_schema(text, uuid) SET search_path = public;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'find_profile_across_schemas') THEN
    ALTER FUNCTION public.find_profile_across_schemas(uuid) SET search_path = public;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_auth_uid') THEN
    ALTER FUNCTION public.get_auth_uid() SET search_path = public;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin') THEN
    ALTER FUNCTION public.is_admin() SET search_path = public;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin_or_moderator') THEN
    ALTER FUNCTION public.is_admin_or_moderator() SET search_path = public;
  END IF;
END $$;

-- =========================================================================
-- 2. Revoke Anon / Public Execution on Security Definer RPC Functions
--    (Linter Rules: anon_security_definer_function_executable & 
--                   authenticated_security_definer_function_executable)
-- =========================================================================

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_auth_uid') THEN
    REVOKE EXECUTE ON FUNCTION public.get_auth_uid() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.get_auth_uid() TO authenticated, service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin') THEN
    REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'find_profile_across_schemas') THEN
    REVOKE EXECUTE ON FUNCTION public.find_profile_across_schemas(uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.find_profile_across_schemas(uuid) TO authenticated, service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_profile_from_schema') THEN
    REVOKE EXECUTE ON FUNCTION public.get_profile_from_schema(text, uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.get_profile_from_schema(text, uuid) TO authenticated, service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin_or_moderator') THEN
    REVOKE EXECUTE ON FUNCTION public.is_admin_or_moderator() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.is_admin_or_moderator() TO authenticated, service_role;
  END IF;
END $$;

-- =========================================================================
-- 3. Salary Payments RLS Policy (Linter Rule: rls_enabled_no_policy)
-- =========================================================================

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'salary_payments') THEN
    ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE salary_payments FORCE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Admins can view salary payments" ON salary_payments;
    CREATE POLICY "Admins can view salary payments" ON salary_payments FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END $$;
