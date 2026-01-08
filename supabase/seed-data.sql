-- ============================================
-- SEED DATA: Default Values for Fresh Database
-- ============================================
-- Run this AFTER setup-fresh-db.sql
-- Creates all default data needed for the application
-- ============================================

-- =============================================================================
-- 1. DEFAULT DESIGNATIONS
-- =============================================================================

INSERT INTO public.designations (id, name, description, role) VALUES
    ('d1234567-89ab-cdef-0123-456789abcdef', 'System Administrator', 'Master Administrator with full system access', 'admin')
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    role = EXCLUDED.role;

-- =============================================================================
-- 2. DEFAULT OFFICE SETTINGS
-- =============================================================================

-- Clear existing and insert fresh settings
DELETE FROM public.office_settings;
INSERT INTO public.office_settings (
    default_check_in, 
    default_check_out, 
    off_days,
    daily_working_hours
) VALUES (
    '10:00:00',           -- Default check-in time
    '19:00:00',           -- Default check-out time (9 hours including 1 hour break)
    ARRAY[0, 6],          -- Sunday (0) and Saturday (6) are off days
    '{
        "monday": 8,
        "tuesday": 8,
        "wednesday": 8,
        "thursday": 8,
        "friday": 8,
        "saturday": 0,
        "sunday": 0
    }'::jsonb
);

-- =============================================================================
-- 3. DEFAULT HOLIDAYS (2026 - India)
-- =============================================================================

INSERT INTO public.office_closures (date, reason, type) VALUES
    -- National Holidays
    ('2026-01-26', 'Republic Day', 'holiday'),
    ('2026-03-10', 'Holi', 'holiday'),
    ('2026-04-02', 'Ram Navami', 'holiday'),
    ('2026-04-03', 'Good Friday', 'holiday'),
    ('2026-04-14', 'Dr. Ambedkar Jayanti', 'holiday'),
    ('2026-05-01', 'May Day / Labour Day', 'holiday'),
    ('2026-05-23', 'Buddha Purnima', 'holiday'),
    ('2026-06-07', 'Eid ul-Fitr', 'holiday'),
    ('2026-07-18', 'Muharram', 'holiday'),
    ('2026-08-15', 'Independence Day', 'holiday'),
    ('2026-08-20', 'Janmashtami', 'holiday'),
    ('2026-10-02', 'Gandhi Jayanti', 'holiday'),
    ('2026-10-20', 'Dussehra', 'holiday'),
    ('2026-11-08', 'Diwali', 'holiday'),
    ('2026-11-09', 'Diwali (Day 2)', 'holiday'),
    ('2026-11-14', 'Guru Nanak Jayanti', 'holiday'),
    ('2026-12-25', 'Christmas', 'holiday')
ON CONFLICT (date) DO UPDATE SET
    reason = EXCLUDED.reason,
    type = EXCLUDED.type;

-- =============================================================================
-- 4. MASTER ADMIN ACCOUNT
-- =============================================================================
-- Note: The auth.users entry must be created first via Supabase Auth
-- Default Admin: srpadmin@saaskit.in / Srpadmin@7626$
-- Auth user ID: 0a4274fb-6fc9-482b-993e-f7c903ec0dd7

INSERT INTO public.profiles (
    id,
    user_id,
    email,
    full_name,
    avatar_url,
    role,
    designation_id,
    first_name,
    middle_name,
    last_name,
    mobile_no,
    date_of_birth,
    sex,
    status,
    created_at,
    updated_at
) VALUES (
    '0a4274fb-6fc9-482b-993e-f7c903ec0dd7',
    '0a4274fb-6fc9-482b-993e-f7c903ec0dd7',
    'srpadmin@saaskit.in',
    'SRP Admin',
    '/avatars/default-male.png',
    'admin',
    'd1234567-89ab-cdef-0123-456789abcdef',
    'SRP',
    '',
    'Admin',
    '8707064200',
    '1982-07-10',
    'male',
    'active',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    mobile_no = EXCLUDED.mobile_no,
    date_of_birth = EXCLUDED.date_of_birth,
    sex = EXCLUDED.sex,
    designation_id = EXCLUDED.designation_id,
    status = EXCLUDED.status,
    updated_at = NOW();

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- Run these to verify the seed data was created:
--
-- SELECT * FROM designations ORDER BY role, name;
-- SELECT * FROM office_settings;
-- SELECT * FROM office_closures ORDER BY date;
-- SELECT id, email, full_name, role, status FROM profiles;
-- =============================================================================
