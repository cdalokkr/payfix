-- ============================================
-- Master Admin Seed Data
-- ============================================
-- This script creates a default master admin account
-- Run this AFTER creating the auth user in Supabase
-- ============================================

-- Default Admin: srpadmin@saaskit.in / Srpadmin@7626$
-- Note: The auth.users entry must be created first via Supabase Auth
-- This script only creates the profile entry

-- ============================================
-- STEP 1: Ensure Designations exist
-- ============================================

INSERT INTO public.designations (id, name, description, role)
VALUES (
    'd1234567-89ab-cdef-0123-456789abcdef',
    'Srp Admin',
    'Master Administrator with full system access',
    'admin'
)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    role = EXCLUDED.role;

-- ============================================
-- STEP 1.5: Ensure Office Settings exist
-- ============================================

INSERT INTO public.office_settings (default_check_in, default_check_out, off_days)
SELECT '10:00:00', '19:00:00', array[0]
WHERE NOT EXISTS (SELECT 1 FROM public.office_settings);

-- ============================================
-- STEP 2: Insert into profiles table
-- ============================================

INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    role,
    created_at,
    updated_at,
    first_name,
    last_name,
    mobile_no,
    date_of_birth,
    user_id,
    middle_name,
    sex,
    designation_id,
    status
)
VALUES (
    '0a4274fb-6fc9-482b-993e-f7c903ec0dd7',
    'srpadmin@saaskit.in',
    'srp admin',
    '/avatars/default-male.png',
    'admin',
    NOW(),
    NOW(),
    'srp',
    'admin',
    '8707064200',
    '1982-07-10',
    '0a4274fb-6fc9-482b-993e-f7c903ec0dd7',  -- This should match the auth.users id
    '',
    'male',
    'd1234567-89ab-cdef-0123-456789abcdef',
    'active'
)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    mobile_no = EXCLUDED.mobile_no,
    date_of_birth = EXCLUDED.date_of_birth,
    middle_name = EXCLUDED.middle_name,
    sex = EXCLUDED.sex,
    designation_id = EXCLUDED.designation_id,
    status = EXCLUDED.status,
    updated_at = NOW();

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this to verify the admin was created:
-- SELECT id, email, full_name, role, first_name, last_name, mobile_no, date_of_birth, sex 
-- FROM profiles WHERE email = 'srpadmin@saaskit.in';
