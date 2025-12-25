-- ============================================
-- Deep Dive: Admin B Activity Logging Investigation
-- ============================================
-- Run this after the fix to see what's happening
-- ============================================

-- 1. Verify the fix was applied
SELECT 
    '=== STEP 1: Verify user_id fix was applied ===' as step,
    p.id as profile_id,
    p.user_id as profile_user_id,
    p.email,
    au.id as auth_user_id,
    CASE 
        WHEN p.user_id = au.id THEN 'MATCH ✓'
        ELSE 'MISMATCH ✗ - FIX NOT APPLIED'
    END as status
FROM profiles p
JOIN auth.users au ON p.email = au.email
WHERE p.email = 'testadmin@saaskit.in';

-- 2. Check if Admin B has logged in recently (check auth.users last_sign_in_at)
SELECT 
    '=== STEP 2: Check Admin B last login time ===' as step,
    id as auth_user_id,
    email,
    last_sign_in_at,
    CASE 
        WHEN last_sign_in_at IS NULL THEN 'NEVER LOGGED IN'
        WHEN last_sign_in_at > NOW() - INTERVAL '10 minutes' THEN 'LOGGED IN RECENTLY ✓'
        ELSE 'LAST LOGIN: ' || last_sign_in_at::text
    END as login_status
FROM auth.users
WHERE email = 'testadmin@saaskit.in';

-- 3. Check activities table for Admin B (using auth.users.id)
SELECT 
    '=== STEP 3: Check activities using auth.users.id ===' as step,
    a.id,
    a.user_id,
    a.activity_type,
    a.description,
    a.created_at
FROM activities a
WHERE a.user_id = (
    SELECT id FROM auth.users WHERE email = 'testadmin@saaskit.in'
)
ORDER BY a.created_at DESC
LIMIT 10;

-- 4. Check if there are any activities with Admin B's OLD user_id
SELECT 
    '=== STEP 4: Check for activities with old user_id ===' as step,
    a.id,
    a.user_id,
    a.activity_type,
    a.description,
    a.created_at
FROM activities a
WHERE a.user_id = 'bf59c2e1-4dc4-4fba-850e-4c642ed817f1'
ORDER BY a.created_at DESC
LIMIT 10;

-- 5. Try to manually insert an activity for Admin B to test permissions
-- This will help us see if there's an RLS or permission issue
DO $$
DECLARE
    admin_b_user_id uuid;
    insert_result text;
BEGIN
    -- Get Admin B's current user_id
    SELECT id INTO admin_b_user_id 
    FROM auth.users 
    WHERE email = 'testadmin@saaskit.in';
    
    -- Try to insert a test activity
    BEGIN
        INSERT INTO activities (user_id, activity_type, description)
        VALUES (admin_b_user_id, 'test', 'Manual test activity');
        
        insert_result := 'SUCCESS ✓ - Activity inserted';
    EXCEPTION WHEN OTHERS THEN
        insert_result := 'FAILED ✗ - Error: ' || SQLERRM;
    END;
    
    RAISE NOTICE '=== STEP 5: Manual insert test === %', insert_result;
END $$;

-- 6. Verify the test activity was created
SELECT 
    '=== STEP 6: Verify test activity ===' as step,
    a.id,
    a.user_id,
    a.activity_type,
    a.description,
    a.created_at
FROM activities a
WHERE a.user_id = (SELECT id FROM auth.users WHERE email = 'testadmin@saaskit.in')
AND a.activity_type = 'test'
ORDER BY a.created_at DESC
LIMIT 1;

-- 7. Check RLS policies that might be blocking inserts
SELECT 
    '=== STEP 7: Check RLS INSERT policies ===' as step,
    schemaname,
    tablename,
    policyname,
    cmd,
    with_check
FROM pg_policies 
WHERE tablename = 'activities'
AND cmd = 'INSERT'
ORDER BY policyname;

-- 8. Check if there's a foreign key constraint issue
SELECT 
    '=== STEP 8: Check foreign key constraints ===' as step,
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'activities'::regclass
AND contype = 'f';
