-- Migration: Refine User Status Schema and Implement Metadata Sync
-- Date: 2025-12-24

-- 1. Create a function to sync status to auth metadata
CREATE OR REPLACE FUNCTION public.sync_status_to_auth_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the raw_user_meta_data in auth.users
  -- We use jsonb_set to safely update the 'status' key without overwriting other metadata
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{status}',
    to_jsonb(NEW.status)
  )
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the trigger to the profiles table
DROP TRIGGER IF EXISTS tr_sync_status_to_auth ON public.profiles;
CREATE TRIGGER tr_sync_status_to_auth
AFTER INSERT OR UPDATE OF status ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_status_to_auth_metadata();

-- 3. Refine user_status_history to reference auth.users UID directly
-- First, add columns for Auth UID if they don't exist, or convert existing ones
ALTER TABLE public.user_status_history 
  ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS actor_user_id UUID REFERENCES auth.users(id);

-- Backfill from profiles if we have the link
-- Assuming profile_id currently points to profiles.id
UPDATE public.user_status_history h
SET target_user_id = p.user_id
FROM public.profiles p
WHERE h.profile_id = p.id;

UPDATE public.user_status_history h
SET actor_user_id = p.user_id
FROM public.profiles p
WHERE h.changed_by = p.id;

-- Make columns NOT NULL after backfill
ALTER TABLE public.user_status_history 
  ALTER COLUMN target_user_id SET NOT NULL;

-- Remove old columns and constraints
-- ALTER TABLE public.user_status_history DROP COLUMN profile_id;
-- ALTER TABLE public.user_status_history DROP COLUMN changed_by;
-- (Decided to keep them for now or rename them to be explicit)

-- 4. Fast-sync existing statuses to auth metadata
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT user_id, status FROM public.profiles WHERE user_id IS NOT NULL LOOP
        UPDATE auth.users
        SET raw_user_meta_data = jsonb_set(
            COALESCE(raw_user_meta_data, '{}'::jsonb),
            '{status}',
            to_jsonb(r.status)
        )
        WHERE id = r.user_id;
    END LOOP;
END;
$$;
