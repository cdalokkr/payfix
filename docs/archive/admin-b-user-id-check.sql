-- ============================================
-- Admin B Activity Logging Investigation
-- ============================================
-- This script investigates why Admin B's activities are not being created
-- ============================================

-- Check if Admin B's user_id in profiles matches their auth.users.id
SELECT 
    '=== ADMIN B USER_ID VERIFICATION ===' as section,
    p.id as profile_id,
    p.user_id as profile_user_id,
    p.email,
    p.role,
    au.id as auth_user_id,
    au.email as auth_email,
    CASE 
        WHEN p.user_id = au.id THEN 'MATCH ✓'
        ELSE 'MISMATCH ✗'
    END as user_id_status
FROM profiles p
LEFT JOIN auth.users au ON p.email = au.email
WHERE p.email = 'testadmin@saaskit.in';

-- Check if there's a user_id mismatch
SELECT 
    '=== CHECKING FOR USER_ID MISMATCH ===' as section,
    p.id as profile_id,
    p.user_id as profile_user_id,
    au.id as auth_user_id,
    p.email,
    CASE 
        WHEN p.user_id != au.id THEN 'MISMATCH - THIS IS THE PROBLEM!'
        ELSE 'OK'
    END as diagnosis
FROM profiles p
JOIN auth.users au ON p.email = au.email
WHERE p.email = 'testadmin@saaskit.in';

-- Check all auth.users entries for testadmin
SELECT 
    '=== AUTH.USERS FOR TESTADMIN ===' as section,
    id as auth_user_id,
    email,
    created_at,
    last_sign_in_at,
    email_confirmed_at
FROM auth.users
WHERE email = 'testadmin@saaskit.in';
