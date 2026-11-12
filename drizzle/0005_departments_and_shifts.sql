-- Migration 0005: Departments and Shifts Management
-- Creates departments, office_shifts, employee_shift_assignments, shift_roster
-- Updates designations, profiles, attendance, and attendance_sessions

CREATE TABLE IF NOT EXISTS "departments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" text NOT NULL,
    "code" varchar(20),
    "description" text,
    "manager_id" uuid,
    "location_id" uuid,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

-- Add department_id to designations
ALTER TABLE IF EXISTS "designations"
ADD COLUMN IF NOT EXISTS "department_id" uuid REFERENCES "departments"("id") ON DELETE SET NULL;

-- Update profiles table
ALTER TABLE IF EXISTS "profiles"
ADD COLUMN IF NOT EXISTS "department_id" uuid REFERENCES "departments"("id") ON DELETE SET NULL;

ALTER TABLE IF EXISTS "profiles"
ALTER COLUMN "email" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_profiles_mobile_no" ON "profiles" ("mobile_no");

-- Create office_shifts table
CREATE TABLE IF NOT EXISTS "office_shifts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "location_id" uuid NOT NULL REFERENCES "office_locations"("id") ON DELETE CASCADE,
    "department_id" uuid REFERENCES "departments"("id") ON DELETE SET NULL,
    "name" text NOT NULL,
    "code" varchar(20),
    "start_time" text NOT NULL,
    "end_time" text NOT NULL,
    "duration_hours" numeric(4, 2) NOT NULL,
    "is_overnight" boolean DEFAULT false,
    "buffer_minutes" integer NOT NULL DEFAULT 15,
    "color" text DEFAULT '#3b82f6',
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

-- Create employee_shift_assignments table
CREATE TABLE IF NOT EXISTS "employee_shift_assignments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "location_id" uuid NOT NULL REFERENCES "office_locations"("id") ON DELETE CASCADE,
    "duty_hours" numeric(4, 2) NOT NULL DEFAULT 8.00,
    "shift_mode" text NOT NULL DEFAULT 'default',
    "assigned_shift_ids" jsonb DEFAULT '[]'::jsonb,
    "rotation_type" text DEFAULT 'none',
    "rotation_shift_ids" jsonb DEFAULT '[]'::jsonb,
    "rotation_start_date" date,
    "effective_from" date DEFAULT CURRENT_DATE,
    "effective_to" date,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

-- Create shift_roster table
CREATE TABLE IF NOT EXISTS "shift_roster" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "department_id" uuid REFERENCES "departments"("id") ON DELETE CASCADE,
    "shift_id" uuid REFERENCES "office_shifts"("id") ON DELETE SET NULL,
    "date" date NOT NULL,
    "status" text NOT NULL DEFAULT 'scheduled',
    "is_extra_shift" boolean DEFAULT false,
    "notes" text,
    "allotted_by" uuid REFERENCES "profiles"("id") ON DELETE SET NULL,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

-- Update attendance table
ALTER TABLE IF EXISTS "attendance"
ADD COLUMN IF NOT EXISTS "shift_id" uuid REFERENCES "office_shifts"("id") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "shift_name" text,
ADD COLUMN IF NOT EXISTS "duty_hours" numeric,
ADD COLUMN IF NOT EXISTS "extra_hours" numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS "is_extra_shift" boolean DEFAULT false;

-- Update attendance_sessions table
ALTER TABLE IF EXISTS "attendance_sessions"
ADD COLUMN IF NOT EXISTS "shift_id" uuid REFERENCES "office_shifts"("id") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "is_extra_shift" boolean DEFAULT false;

-- Foreign key constraints for departments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'departments_manager_id_profiles_id_fk'
    ) THEN
        ALTER TABLE "departments"
        ADD CONSTRAINT "departments_manager_id_profiles_id_fk"
        FOREIGN KEY ("manager_id") REFERENCES "profiles"("id") ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'departments_location_id_office_locations_id_fk'
    ) THEN
        ALTER TABLE "departments"
        ADD CONSTRAINT "departments_location_id_office_locations_id_fk"
        FOREIGN KEY ("location_id") REFERENCES "office_locations"("id") ON DELETE CASCADE;
    END IF;
END $$;
