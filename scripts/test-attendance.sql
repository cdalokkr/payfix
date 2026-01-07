-- Test script for attendance verification
-- Profile ID: c4b9da11-f942-4c2b-b2ef-56dbde3125f8
-- Today's date: 2026-01-07 (IST)

-- First, check if there's any attendance for today
SELECT 
  id,
  profile_id,
  date,
  check_in,
  check_out,
  working_hours,
  status,
  is_extra_day,
  is_half_day,
  created_at
FROM attendance 
WHERE profile_id = 'c4b9da11-f942-4c2b-b2ef-56dbde3125f8'
  AND date >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY date DESC;

-- To INSERT a test record for today (UNCOMMENT to run):
-- INSERT INTO attendance (profile_id, date, check_in, status)
-- VALUES (
--   'c4b9da11-f942-4c2b-b2ef-56dbde3125f8',
--   '2026-01-07',
--   NOW(),
--   'pending'
-- );

-- To DELETE test record for today (UNCOMMENT to run):
-- DELETE FROM attendance 
-- WHERE profile_id = 'c4b9da11-f942-4c2b-b2ef-56dbde3125f8'
--   AND date = '2026-01-07';

-- Verify the fix works by checking what records exist
SELECT 
  date,
  date::text as date_as_text,
  check_in,
  check_out,
  CASE 
    WHEN check_in IS NOT NULL AND check_out IS NOT NULL THEN 'MARKED (both in/out)'
    WHEN check_in IS NOT NULL THEN 'CLOCKED_IN (waiting for out)'
    ELSE 'NOT_MARKED'
  END as button_state
FROM attendance 
WHERE profile_id = 'c4b9da11-f942-4c2b-b2ef-56dbde3125f8'
  AND date >= CURRENT_DATE - INTERVAL '2 days'
ORDER BY date DESC;
