-- Fix the handle_new_user trigger to handle conflicts gracefully
-- and support additional user fields

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create an improved function that handles conflicts gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile with ON CONFLICT DO NOTHING to handle duplicates gracefully
  INSERT INTO public.profiles (id, email, user_id, role, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    NEW.email,
    NEW.id,
    'user',
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();