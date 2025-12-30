-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, user_id, role, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    NEW.email,
    NEW.id,
    'user',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update existing profiles to link them with auth.users via user_id
-- This handles profiles that were created before the user_id column existed
UPDATE public.profiles p
SET user_id = au.id
FROM auth.users au
WHERE p.email = au.email 
  AND p.user_id IS NULL;

-- Backfill profiles for auth users who don't have any profile at all
INSERT INTO public.profiles (id, email, user_id, role, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  au.email,
  au.id,
  'user',
  NOW(),
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.email = au.email
);