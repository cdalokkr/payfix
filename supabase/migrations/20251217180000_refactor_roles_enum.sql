-- ============================================
-- REFACTOR ROLES: Admin, Moderator, Employee
-- ============================================

-- 1. Update the user_role enum
-- We add 'moderator' and ensure 'employee' exists.
-- 'admin' and 'user' likely exist. We will keep 'user' for now to avoid breaking existing data immediately,
-- but logic will migrate 'user' -> 'moderator'.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'moderator';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'employee';

-- 2. Migrate existing 'user' roles to 'moderator'
-- This assumes all current standard users should become Moderators (Backoffice access)
UPDATE profiles 
SET role = 'moderator' 
WHERE role = 'user';

-- 3. Verify allowed_modules column exists (should be there from previous step, but safe to check)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allowed_modules text[];

-- 4. Cleanup/Verify Constraints
-- Drop legacy check constraints if any, let the ENUM handle it.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
