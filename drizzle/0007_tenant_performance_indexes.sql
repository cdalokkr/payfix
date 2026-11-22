-- Performance Indexes for Tenant Schemas
CREATE INDEX IF NOT EXISTS "idx_profiles_tenant_role_created"
    ON "profiles" ("tenant_id", "role", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_profiles_status_role"
    ON "profiles" ("status", "role");

CREATE INDEX IF NOT EXISTS "idx_attendance_profile_date"
    ON "attendance" ("profile_id", "date" DESC);

CREATE INDEX IF NOT EXISTS "idx_activities_user_created"
    ON "activities" ("user_id", "created_at" DESC);
