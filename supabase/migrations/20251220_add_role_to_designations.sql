-- Add role column to designations table
ALTER TABLE public.designations 
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'moderator', 'employee'));

-- Remove default after adding column to enforce it for future inserts
ALTER TABLE public.designations ALTER COLUMN role DROP DEFAULT;
