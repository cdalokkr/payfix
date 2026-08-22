-- Only one open attendance session may exist for a profile on a local date.
-- This is intentionally a partial index so completed sessions remain
-- available for the multiple-session-per-day attendance model.
CREATE UNIQUE INDEX IF NOT EXISTS attendance_sessions_one_active_per_profile_day
    ON attendance_sessions (profile_id, date)
    WHERE status = 'active';