-- ============================================
-- MIGRATION: Fix employee_settings policy overlap
-- Date: 2026-01-09
-- Fixes: Multiple permissive policies warning
-- ============================================

-- Remove the ALL policy that overlaps with SELECT
DROP POLICY IF EXISTS "employee_settings_admin_all" ON employee_settings;

-- Create specific policies for non-SELECT actions
CREATE POLICY "employee_settings_admin_insert" ON employee_settings
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT is_admin()));

CREATE POLICY "employee_settings_admin_update" ON employee_settings
    FOR UPDATE TO authenticated
    USING ((SELECT is_admin()));

CREATE POLICY "employee_settings_admin_delete" ON employee_settings
    FOR DELETE TO authenticated
    USING ((SELECT is_admin()));
