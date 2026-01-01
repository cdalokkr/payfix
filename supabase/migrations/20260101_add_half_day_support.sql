-- Add half-day support to attendance and leaves tables

-- Update attendance table
ALTER TABLE public.attendance ADD COLUMN is_half_day BOOLEAN DEFAULT false;

-- Update leaves table
ALTER TABLE public.leaves ADD COLUMN is_half_day BOOLEAN DEFAULT false;
ALTER TABLE public.leaves ADD COLUMN half_day_period TEXT;

-- Update RLS policies if necessary (usually not needed for column additions unless policies are very specific)
