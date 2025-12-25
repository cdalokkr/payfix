-- ============================================
-- Activity Logging Diagnostic Script
-- ============================================
-- This script helps diagnose why Admin B's activities
-- are not showing in the recent activity logs
-- ============================================

-- ============================================
-- 1. CHECK ADMIN PROFILES
-- ============================================
SELECT 
    '=== ADMIN PROFILES ===' as section,
    id,
    user_id,
    email,
    role,
    created_at,
    updated_at
FROM profiles 
WHERE email IN ('srpadmin@saaskit.in', 'testadmin@saaskit.in')
ORDER BY email;

-- ============================================
-- 2. CHECK ALL ACTIVITIES FOR BOTH ADMINS
-- ============================================
SELECT 
    '=== ACTIVITIES FOR BOTH ADMINS ===' as section,
    a.id,
    a.user_id,
    p.email as admin_email,
    p.role as admin_role,
    a.activity_type,
    a.description,
    a.created_at
FROM activities a
JOIN profiles p ON a.user_id = p.user_id
WHERE p.email IN ('srpadmin@saaskit.in', 'testadmin@saaskit.in')
ORDER BY a.created_at DESC
LIMIT 50;

-- ============================================
-- 3. COUNT ACTIVITIES PER ADMIN
-- ============================================
SELECT 
    '=== ACTIVITY COUNT PER ADMIN ===' as section,
    p.email,
    p.role,
    COUNT(a.id) as activity_count
FROM profiles p
LEFT JOIN activities a ON p.user_id = a.user_id
WHERE p.email IN ('srpadmin@saaskit.in', 'testadmin@saaskit.in')
GROUP BY p.email, p.role
ORDER BY p.email;

-- ============================================
-- 4. CHECK RECENT ACTIVITIES (LAST 20)
-- ============================================
SELECT 
    '=== RECENT ACTIVITIES (ALL USERS) ===' as section,
    a.id,
    a.user_id,
    p.email,
    p.role,
    a.activity_type,
    a.description,
    a.created_at
FROM activities a
LEFT JOIN profiles p ON a.user_id = p.user_id
ORDER BY a.created_at DESC
LIMIT 20;

-- ============================================
-- 5. CHECK RLS POLICIES ON ACTIVITIES TABLE
-- ============================================
SELECT 
    '=== RLS POLICIES ON ACTIVITIES TABLE ===' as section,
    schemaname,
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'activities'
ORDER BY policyname;

-- ============================================
-- 6. VERIFY is_admin() FUNCTION
-- ============================================
-- Note: This will only work when run as an authenticated user
-- SELECT 
--     '=== ADMIN CHECK FUNCTION ===' as section,
--     public.is_admin() as is_current_user_admin;

-- ============================================
-- 7. CHECK FOR ORPHANED ACTIVITIES
-- ============================================
SELECT 
    '=== ORPHANED ACTIVITIES (NO MATCHING PROFILE) ===' as section,
    a.id,
    a.user_id,
    a.activity_type,
    a.description,
    a.created_at
FROM activities a
LEFT JOIN profiles p ON a.user_id = p.user_id
WHERE p.id IS NULL
ORDER BY a.created_at DESC
LIMIT 10;

-- ============================================
-- 8. CHECK ACTIVITY TYPES FOR BOTH ADMINS
-- ============================================
SELECT 
    '=== ACTIVITY TYPES BY ADMIN ===' as section,
    p.email,
    a.activity_type,
    COUNT(*) as count
FROM activities a
JOIN profiles p ON a.user_id = p.user_id
WHERE p.email IN ('srpadmin@saaskit.in', 'testadmin@saaskit.in')
GROUP BY p.email, a.activity_type
ORDER BY p.email, count DESC;

-- ============================================
-- EXPECTED RESULTS
-- ============================================
-- If the system is working correctly:
-- 1. Both admin profiles should exist with role = 'admin'
-- 2. Both admins should have activities (login, logout, etc.)
-- 3. Activity counts should be > 0 for both admins
-- 4. Recent activities should include both admins
-- 5. RLS policies should allow admins to view all activities
-- 6. No orphaned activities should exist
--
-- If Admin B has 0 activities:
-- - The issue is that activities are not being created for Admin B
-- - Check the auth router login/logout procedures
-- - Check if there are any errors during activity creation
--
-- If Admin B has activities but they're not showing in the UI:
-- - The issue is in the frontend query or filtering
-- - Check the tRPC query in admin-dashboard-optimized.ts
-- - Check the UI filtering in admin-overview.tsx
