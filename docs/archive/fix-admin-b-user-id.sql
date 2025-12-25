-- ============================================
-- Fix Admin B Activity Logging Issue
-- ============================================
-- This script fixes the user_id mismatch for Admin B
-- and ensures activities can be logged correctly
-- ============================================

-- STEP 1: First, let's verify the mismatch
-- Run this to see the current state
SELECT 
    'BEFORE FIX - Admin B user_id verification' as status,
    p.id as profile_id,
    p.user_id as profile_user_id,
    p.email,
    au.id as auth_user_id,
    CASE 
        WHEN p.user_id = au.id THEN 'MATCH ✓'
        ELSE 'MISMATCH ✗ - NEEDS FIX'
    END as diagnosis
FROM profiles p
JOIN auth.users au ON p.email = au.email
WHERE p.email = 'testadmin@saaskit.in';

-- STEP 2: Fix the user_id mismatch
-- This updates Admin B's user_id in profiles to match their auth.users.id
UPDATE profiles
SET user_id = (
    SELECT id 
    FROM auth.users 
    WHERE email = 'testadmin@saaskit.in'
    LIMIT 1
),
updated_at = NOW()
WHERE email = 'testadmin@saaskit.in'
AND user_id != (
    SELECT id 
    FROM auth.users 
    WHERE email = 'testadmin@saaskit.in'
    LIMIT 1
);

-- STEP 3: Verify the fix
SELECT 
    'AFTER FIX - Admin B user_id verification' as status,
    p.id as profile_id,
    p.user_id as profile_user_id,
    p.email,
    au.id as auth_user_id,
    CASE 
        WHEN p.user_id = au.id THEN 'MATCH ✓ - FIXED!'
        ELSE 'STILL MISMATCH ✗'
    END as diagnosis
FROM profiles p
JOIN auth.users au ON p.email = au.email
WHERE p.email = 'testadmin@saaskit.in';

-- STEP 4: Check if there are any other users with mismatched user_ids
SELECT 
    'Checking all users for user_id mismatches' as status,
    p.id as profile_id,
    p.email,
    p.user_id as profile_user_id,
    au.id as auth_user_id,
    CASE 
        WHEN p.user_id = au.id THEN 'OK ✓'
        ELSE 'MISMATCH ✗'
    END as status
FROM profiles p
JOIN auth.users au ON p.email = au.email
WHERE p.user_id != au.id;

-- ============================================
-- EXPLANATION
-- ============================================
-- The issue occurs when:
-- 1. Admin B logs in with email/password
-- 2. Supabase auth returns auth.uid() = their actual auth.users.id
-- 3. The login code tries to insert an activity with user_id = auth.uid()
-- 4. But the profiles table has a different user_id for Admin B
-- 5. This causes the activity insert to fail silently (foreign key constraint)
--    OR creates an orphaned activity that doesn't link to the profile
--
-- The fix:
-- - Update Admin B's user_id in profiles to match their auth.users.id
-- - This ensures activities are correctly linked to their profile
-- ============================================
