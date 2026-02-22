-- =============================================
-- Migration: Create Salary, Advances & Monthly Attendance Tables
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. Employee Salary Setup (versioned salary components)
CREATE TABLE IF NOT EXISTS employee_salary_setup (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    basic_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
    hra NUMERIC(12, 2) NOT NULL DEFAULT 0,
    da NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ta NUMERIC(12, 2) NOT NULL DEFAULT 0,
    special_allowance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    incentive NUMERIC(12, 2) NOT NULL DEFAULT 0,
    other_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
    effective_from_month INTEGER NOT NULL,
    effective_from_year INTEGER NOT NULL,
    effective_to_month INTEGER,
    effective_to_year INTEGER,
    change_reason TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Employee Advances / Loans (day-by-day tracking)
CREATE TABLE IF NOT EXISTS employee_advances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    particulars TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    adjusted_in_month INTEGER,
    adjusted_in_year INTEGER,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Monthly Attendance Summary (compiled attendance + payslip data)
CREATE TABLE IF NOT EXISTS monthly_attendance_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_working_days INTEGER NOT NULL DEFAULT 0,
    total_present_days INTEGER NOT NULL DEFAULT 0,
    total_absent_days INTEGER NOT NULL DEFAULT 0,
    total_half_days INTEGER NOT NULL DEFAULT 0,
    total_leaves INTEGER NOT NULL DEFAULT 0,
    total_working_hours NUMERIC(8, 2) DEFAULT 0,
    total_extra_hours NUMERIC(8, 2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    set_for_salary_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    set_for_salary_at TIMESTAMPTZ,
    gross_salary NUMERIC(12, 2),
    absence_deduction NUMERIC(12, 2),
    net_salary NUMERIC(12, 2),
    advance_recovery NUMERIC(12, 2),
    take_home NUMERIC(12, 2),
    salary_breakdown JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Indexes for performance
-- =============================================

-- Salary setup: find active salary for an employee
CREATE INDEX IF NOT EXISTS idx_salary_setup_profile_active
    ON employee_salary_setup(profile_id, is_active);

-- Advances: filter by employee + status
CREATE INDEX IF NOT EXISTS idx_advances_profile_status
    ON employee_advances(profile_id, status);

-- Advances: filter by date range
CREATE INDEX IF NOT EXISTS idx_advances_date
    ON employee_advances(date);

-- Monthly summary: find by month/year
CREATE INDEX IF NOT EXISTS idx_monthly_summary_period
    ON monthly_attendance_summary(month, year);

-- Monthly summary: find by employee + period
CREATE INDEX IF NOT EXISTS idx_monthly_summary_profile_period
    ON monthly_attendance_summary(profile_id, month, year);

-- =============================================
-- Enable RLS (Row Level Security) — required by Supabase
-- =============================================

ALTER TABLE employee_salary_setup ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_attendance_summary ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (your backend uses service_role key)
CREATE POLICY "Service role full access" ON employee_salary_setup
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON employee_advances
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON monthly_attendance_summary
    FOR ALL USING (true) WITH CHECK (true);
