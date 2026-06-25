-- Migration: Add Super Admin role, Plan limits, and License Expiry Tracking
-- Target: public schema

-- 1. Update user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. Update tenant_plans table
ALTER TABLE public.tenant_plans ADD COLUMN IF NOT EXISTS max_moderators integer DEFAULT 2 NOT NULL;

-- 3. Update tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS max_employees_override integer;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS max_moderators_override integer;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS license_expires_at timestamp with time zone;

-- 4. Seed default values for existing tenants
-- For active tenants, default license_expires_at to trial_end (or trial_start + trial_duration_days)
UPDATE public.tenants 
SET license_expires_at = trial_end 
WHERE license_expires_at IS NULL;

-- Set a fallback if trial_end is somehow null
UPDATE public.tenants 
SET license_expires_at = NOW() + INTERVAL '30 days' 
WHERE license_expires_at IS NULL;

-- Make license_expires_at not null
ALTER TABLE public.tenants ALTER COLUMN license_expires_at SET NOT NULL;
