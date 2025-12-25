-- ============================================
-- CORRECT FIX: Activities Foreign Key Issue
-- ============================================
-- The real problem: activities.user_id references profiles.id, not profiles.user_id
-- When users log in, the code inserts auth.uid() into activities.user_id
-- But the foreign key expects profiles.id
-- 
-- Solution: Change the foreign key to reference profiles.user_id instead
-- ============================================

-- STEP 1: Verify the current foreign key constraint
SELECT 
    '=== CURRENT FOREIGN KEY CONSTRAINT ===' as info,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'activities'::regclass
AND conname = 'activities_user_id_fkey';

-- STEP 2: Drop the existing foreign key constraint
ALTER TABLE activities 
DROP CONSTRAINT IF EXISTS activities_user_id_fkey;

-- STEP 3: Create the correct foreign key constraint
-- This references profiles.user_id instead of profiles.id
ALTER TABLE activities
ADD CONSTRAINT activities_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES profiles(user_id) 
ON DELETE CASCADE;

-- STEP 4: Verify the new constraint
SELECT 
    '=== NEW FOREIGN KEY CONSTRAINT ===' as info,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'activities'::regclass
AND conname = 'activities_user_id_fkey';

-- STEP 5: Test by inserting a test activity for Admin B
-- This should now work!
INSERT INTO activities (user_id, activity_type, description)
VALUES (
    (SELECT user_id FROM profiles WHERE email = 'testadmin@saaskit.in'),
    'login',
    'Test activity after foreign key fix'
);

-- STEP 6: Verify the test activity was created
SELECT 
    '=== TEST ACTIVITY CREATED ===' as info,
    a.id,
    a.user_id,
    p.email,
    a.activity_type,
    a.description,
    a.created_at
FROM activities a
JOIN profiles p ON a.user_id = p.user_id
WHERE p.email = 'testadmin@saaskit.in'
ORDER BY a.created_at DESC
LIMIT 1;

-- ============================================
-- EXPLANATION
-- ============================================
-- The original foreign key was:
--   activities.user_id -> profiles.id
--
-- But the application code does:
--   INSERT INTO activities (user_id, ...) VALUES (auth.uid(), ...)
--
-- Where auth.uid() returns the user's auth.users.id, which is stored in profiles.user_id
--
-- So the foreign key should be:
--   activities.user_id -> profiles.user_id
--
-- This ensures that when the app inserts auth.uid() into activities.user_id,
-- it correctly references the user's profile via profiles.user_id
-- ============================================
