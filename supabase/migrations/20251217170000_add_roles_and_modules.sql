-- Add new values to the user_role enum
-- This fixes the "invalid input value for enum user_role" error
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'employee';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'backoffice';

-- Add the allowed_modules column if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allowed_modules text[];

-- Drop the old constraint if it exists (it might be redundant if using ENUMs)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Optional: If you strictly want to enforce the values via constraint as well (usually not needed for ENUMs)
-- ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
--   CHECK (role IN ('admin', 'user', 'employee', 'backoffice'));
