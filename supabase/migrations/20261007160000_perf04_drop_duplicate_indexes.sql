-- PERF-04: Drop verified duplicate indexes across all tenant schemas.
-- Retains the canonical contract-required indexes:
--   * profiles.profiles_face_embedding_hnsw_idx (and 512-d indexes)
--   * attendance_sessions.attendance_sessions_profile_date_checkin_idx
--   * attendance_sessions.attendance_sessions_one_active_per_profile_day
--   * profile_photo_requests.profile_photo_requests_profile_status_created_idx

DO $$
DECLARE
    tenant_schema record;
BEGIN
    FOR tenant_schema IN
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name ~ '^tenant_[a-z0-9_]+$'
    LOOP
        -- 1. profiles: drop legacy duplicate HNSW indexes on 128-d face_embedding
        EXECUTE format('DROP INDEX IF EXISTS %I.idx_tenant_primary_face_embedding_hnsw;', tenant_schema.schema_name);
        EXECUTE format('DROP INDEX IF EXISTS %I.profiles_face_embedding_idx;', tenant_schema.schema_name);
        EXECUTE format('DROP INDEX IF EXISTS %I.profiles_face_embedding_idx1;', tenant_schema.schema_name);

        -- 2. attendance_sessions: drop duplicate check-in sort index and duplicate active-session unique guard
        EXECUTE format('DROP INDEX IF EXISTS %I.attendance_sessions_profile_id_date_check_in_idx;', tenant_schema.schema_name);
        EXECUTE format('DROP INDEX IF EXISTS %I.attendance_sessions_profile_id_date_idx;', tenant_schema.schema_name);

        -- 3. profile_photo_requests: drop duplicate status/created_at index
        EXECUTE format('DROP INDEX IF EXISTS %I.profile_photo_requests_profile_id_status_created_at_idx;', tenant_schema.schema_name);
    END LOOP;
END $$;
