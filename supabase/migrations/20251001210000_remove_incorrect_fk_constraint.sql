-- Remove incorrect foreign key constraint on profiles.id
-- The profiles.id should be a simple UUID primary key, not a foreign key

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;