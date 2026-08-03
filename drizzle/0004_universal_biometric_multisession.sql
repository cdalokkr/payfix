-- Migration script for Universal eSSL Biometric & Multi-Session Attendance System

-- 1. Create attendance_sessions table
CREATE TABLE IF NOT EXISTS "public"."attendance_sessions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "attendance_id" uuid REFERENCES "public"."attendance"("id") ON DELETE CASCADE,
    "profile_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "date" date NOT NULL,
    "session_number" integer NOT NULL DEFAULT 1,
    "check_in" timestamp with time zone NOT NULL,
    "check_out" timestamp with time zone,
    "working_hours" numeric,
    "source" text DEFAULT 'mobile',
    "device_id" text,
    "location_id" uuid REFERENCES "public"."office_locations"("id") ON DELETE SET NULL,
    "selfie_url" text,
    "checkin_latitude" numeric(10, 7),
    "checkin_longitude" numeric(10, 7),
    "checkin_location_name" text,
    "checkout_latitude" numeric(10, 7),
    "checkout_longitude" numeric(10, 7),
    "checkout_location_name" text,
    "status" text NOT NULL DEFAULT 'active',
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

-- 2. Create biometric_raw_logs table for audit tracing
CREATE TABLE IF NOT EXISTS "public"."biometric_raw_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "profile_id" uuid REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
    "biometric_user_id" text NOT NULL,
    "device_id" text,
    "location_id" uuid REFERENCES "public"."office_locations"("id") ON DELETE SET NULL,
    "punch_time" timestamp with time zone NOT NULL,
    "punch_type" integer,
    "raw_payload" jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

-- 3. Add columns to attendance table
ALTER TABLE "public"."attendance" 
ADD COLUMN IF NOT EXISTS "first_check_in" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "last_check_out" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "total_sessions" integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS "current_session_status" text DEFAULT 'checked_out',
ADD COLUMN IF NOT EXISTS "location_id" uuid REFERENCES "public"."office_locations"("id") ON DELETE SET NULL;

-- 4. Add face_vector column to employee_settings table
ALTER TABLE "public"."employee_settings" 
ADD COLUMN IF NOT EXISTS "face_vector" jsonb;

-- 5. Add location_id, device_type, and api_key to biometric_devices table
ALTER TABLE "public"."biometric_devices" 
ADD COLUMN IF NOT EXISTS "location_id" uuid REFERENCES "public"."office_locations"("id") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "device_type" text DEFAULT 'adms',
ADD COLUMN IF NOT EXISTS "api_key" text;

-- 6. Enable Row Level Security (RLS) on new tables
ALTER TABLE "public"."attendance_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."biometric_raw_logs" ENABLE ROW LEVEL SECURITY;

-- 7. Add RLS Policies
DROP POLICY IF EXISTS "Enable read access for authenticated users on attendance_sessions" ON "public"."attendance_sessions";
CREATE POLICY "Enable read access for authenticated users on attendance_sessions" 
ON "public"."attendance_sessions" FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable all access for service role on attendance_sessions" ON "public"."attendance_sessions";
CREATE POLICY "Enable all access for service role on attendance_sessions" 
ON "public"."attendance_sessions" FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Enable read access for authenticated users on biometric_raw_logs" ON "public"."biometric_raw_logs";
CREATE POLICY "Enable read access for authenticated users on biometric_raw_logs" 
ON "public"."biometric_raw_logs" FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable all access for service role on biometric_raw_logs" ON "public"."biometric_raw_logs";
CREATE POLICY "Enable all access for service role on biometric_raw_logs" 
ON "public"."biometric_raw_logs" FOR ALL TO service_role USING (true);
