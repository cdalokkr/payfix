-- ============================================
-- PROFILE TABLE UPDATE SCRIPTS
-- ============================================

-- SCRIPT 1: Add middle_name column and make sex column nullable
-- This script updates the profiles table to support the new fields

-- Add middle_name column (optional)
ALTER TABLE profiles 
ADD COLUMN middle_name TEXT;

-- Make sex column nullable (in case it's currently NOT NULL)
ALTER TABLE profiles 
ALTER COLUMN sex DROP NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN profiles.middle_name IS 'Optional middle name field';
COMMENT ON COLUMN profiles.sex IS 'Gender field (Male/Female) - nullable for existing records';

-- ============================================
-- SCRIPT 2: Update sex field for all existing records except admin
-- This script populates the sex field for existing records
-- Excludes the admin email specified by the user

UPDATE profiles 
SET sex = CASE 
    WHEN email = 'srpadmin@saaskit.in' THEN sex -- Keep existing value for admin
    ELSE 'Male' -- Default to Male for all other existing records
END
WHERE email != 'srpadmin@saaskit.in'
AND sex IS NULL; -- Only update records where sex is currently NULL

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check the table structure after updates
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check record count and sex distribution
SELECT 
    sex,
    COUNT(*) as record_count
FROM profiles 
GROUP BY sex;

-- Check specific admin record
SELECT 
    email, 
    sex, 
    middle_name,
    first_name,
    last_name
FROM profiles 
WHERE email = 'srpadmin@saaskit.in';

-- ============================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================

-- To rollback if needed:
-- ALTER TABLE profiles DROP COLUMN middle_name;
-- Note: Cannot rollback sex to NOT NULL if data exists