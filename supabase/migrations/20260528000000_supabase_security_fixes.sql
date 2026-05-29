-- Migration: Supabase Security Linter Remediation
-- Date: 2026-05-28
-- Description: Resolves vulnerabilities flagged by the Supabase Security Linter including disabling public list access for buckets, enabling RLS, tightening permissive policies, and revoking public execution on SECURITY DEFINER functions.

-- =============================================================================
-- SECTION 1: ENABLE RLS & POLICIES FOR BIOMETRIC_DEVICES
-- =============================================================================

ALTER TABLE public.biometric_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read biometric_devices" ON public.biometric_devices;
CREATE POLICY "Allow authenticated users to read biometric_devices" 
ON public.biometric_devices 
FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Admins can manage biometric_devices" ON public.biometric_devices;
CREATE POLICY "Admins can manage biometric_devices" 
ON public.biometric_devices 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role = 'admin'
    )
) 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role = 'admin'
    )
);

-- =============================================================================
-- SECTION 2: TIGHTEN PERMISSIVE RLS POLICIES ON CRM & TICKET TABLES
-- =============================================================================

-- Drop old permissive policies that bypass database RLS checks for authenticated users
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.clients;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.clients;

DROP POLICY IF EXISTS "Allow authenticated insert" ON public.complaints;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.complaints;

DROP POLICY IF EXISTS "Allow authenticated insert" ON public.tickets;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.tickets;

DROP POLICY IF EXISTS "Allow authenticated insert" ON public.ticket_assignments;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.ticket_assignments;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.ticket_assignments;

DROP POLICY IF EXISTS "Allow authenticated insert" ON public.ticket_resolutions;

DROP POLICY IF EXISTS "Allow authenticated insert" ON public.call_logs;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.call_logs;

-- Recreate secure, role-based database policies that mirror application permissions

-- Clients: Only admins and moderators can modify
CREATE POLICY "Allow admin and moderator to insert clients" 
ON public.clients 
FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'moderator')
    )
);

CREATE POLICY "Allow admin and moderator to update clients" 
ON public.clients 
FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'moderator')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'moderator')
    )
);

-- Complaints: Only admins and moderators can modify
CREATE POLICY "Allow admin and moderator to insert complaints" 
ON public.complaints 
FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'moderator')
    )
);

CREATE POLICY "Allow admin and moderator to update complaints" 
ON public.complaints 
FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'moderator')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'moderator')
    )
);

-- Tickets: Only admins and moderators can insert
CREATE POLICY "Allow admin and moderator to insert tickets" 
ON public.tickets 
FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'moderator')
    )
);

-- Tickets: Admins, moderators, or assigned employees can update ticket status
CREATE POLICY "Allow admin, moderator, or assigned user to update tickets" 
ON public.tickets 
FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'moderator')
    ) 
    OR EXISTS (
        SELECT 1 FROM public.ticket_assignments 
        WHERE ticket_assignments.ticket_id = tickets.id 
        AND ticket_assignments.assigned_to = (SELECT auth.uid())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'moderator')
    ) 
    OR EXISTS (
        SELECT 1 FROM public.ticket_assignments 
        WHERE ticket_assignments.ticket_id = tickets.id 
        AND ticket_assignments.assigned_to = (SELECT auth.uid())
    )
);

-- Ticket Assignments: Only admins and moderators can modify assignments
CREATE POLICY "Allow admin and moderator to insert ticket_assignments" 
ON public.ticket_assignments 
FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'moderator')
    )
);

CREATE POLICY "Allow admin and moderator to update ticket_assignments" 
ON public.ticket_assignments 
FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'moderator')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'moderator')
    )
);

CREATE POLICY "Allow admin and moderator to delete ticket_assignments" 
ON public.ticket_assignments 
FOR DELETE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'moderator')
    )
);

-- Ticket Resolutions: Admins, moderators, or assigned employees can add resolutions
CREATE POLICY "Allow admin, moderator, or assigned user to insert resolutions" 
ON public.ticket_resolutions 
FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = (SELECT auth.uid()) 
        AND profiles.role IN ('admin', 'moderator')
    ) 
    OR EXISTS (
        SELECT 1 FROM public.ticket_assignments 
        WHERE ticket_assignments.ticket_id = ticket_resolutions.ticket_id 
        AND ticket_assignments.assigned_to = (SELECT auth.uid())
    )
);

-- Call Logs: Logged-in users can only insert or update call logs they themselves made
CREATE POLICY "Allow users to insert own call_logs" 
ON public.call_logs 
FOR INSERT 
TO authenticated 
WITH CHECK (called_by = (SELECT auth.uid()));

CREATE POLICY "Allow users to update own call_logs" 
ON public.call_logs 
FOR UPDATE 
TO authenticated 
USING (called_by = (SELECT auth.uid()))
WITH CHECK (called_by = (SELECT auth.uid()));

-- =============================================================================
-- SECTION 3: RESTRUCTURE SALARY & ADVANCE POLICIES TO EXPLICITLY USE ROLES
-- =============================================================================

-- Drop old service role policies which omitted TO role, defaulting to PUBLIC (which allowed RLS bypass)
DROP POLICY IF EXISTS "Service role full access" ON public.employee_salary_setup;
DROP POLICY IF EXISTS "Service role full access" ON public.employee_advances;
DROP POLICY IF EXISTS "Service role full access" ON public.monthly_attendance_summary;

-- Recreate service role full access policies explicitly TO service_role
CREATE POLICY "Service role full access" ON public.employee_salary_setup
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.employee_advances
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.monthly_attendance_summary
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add safe policies for authenticated users
-- employee_salary_setup: users can read own salary setups, admins/moderators can view all
CREATE POLICY "Allow users to read own salary_setup" ON public.employee_salary_setup
    FOR SELECT TO authenticated 
    USING (
        profile_id = (SELECT auth.uid()) 
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = (SELECT auth.uid()) 
            AND profiles.role IN ('admin', 'moderator')
        )
    );

-- employee_salary_setup: only admins can manage setups
CREATE POLICY "Admins can manage salary_setup" ON public.employee_salary_setup
    FOR ALL TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = (SELECT auth.uid()) 
            AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = (SELECT auth.uid()) 
            AND profiles.role = 'admin'
        )
    );

-- employee_advances: users can read own advances, admins/moderators can view all
CREATE POLICY "Allow users to read own advances" ON public.employee_advances
    FOR SELECT TO authenticated 
    USING (
        profile_id = (SELECT auth.uid()) 
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = (SELECT auth.uid()) 
            AND profiles.role IN ('admin', 'moderator')
        )
    );

-- employee_advances: only admins/moderators can modify advances
CREATE POLICY "Admins and moderators can manage advances" ON public.employee_advances
    FOR ALL TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = (SELECT auth.uid()) 
            AND profiles.role IN ('admin', 'moderator')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = (SELECT auth.uid()) 
            AND profiles.role IN ('admin', 'moderator')
        )
    );

-- monthly_attendance_summary: users can read own summaries, admins/moderators can view all
CREATE POLICY "Allow users to read own monthly_attendance_summary" ON public.monthly_attendance_summary
    FOR SELECT TO authenticated 
    USING (
        profile_id = (SELECT auth.uid()) 
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = (SELECT auth.uid()) 
            AND profiles.role IN ('admin', 'moderator')
        )
    );

-- monthly_attendance_summary: only admins/moderators can manage summaries
CREATE POLICY "Admins and moderators can manage monthly_attendance_summary" ON public.monthly_attendance_summary
    FOR ALL TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = (SELECT auth.uid()) 
            AND profiles.role IN ('admin', 'moderator')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = (SELECT auth.uid()) 
            AND profiles.role IN ('admin', 'moderator')
        )
    );

-- =============================================================================
-- SECTION 4: SECURE SECURITY DEFINER FUNCTIONS FROM PUBLIC EXECUTION
-- =============================================================================

-- Revoke execute privileges from PUBLIC and anonymous users on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.sync_status_to_auth_metadata() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_status_to_auth_metadata() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_status_to_auth_metadata() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_admin_or_moderator() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_moderator() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_moderator() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_within_geofence(numeric, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_within_geofence(numeric, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_within_geofence(numeric, numeric) TO authenticated, service_role;

-- =============================================================================
-- SECTION 5: DISABLE STORAGE PUBLIC BUCKET LISTING
-- =============================================================================

-- Drop the broad SELECT policy on storage.objects for the public avatars bucket to prevent list leakage
DROP POLICY IF EXISTS "avatars_ 1oj01fe_0" ON storage.objects;
