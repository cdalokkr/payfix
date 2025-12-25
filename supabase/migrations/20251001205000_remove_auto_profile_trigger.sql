-- Remove the automatic profile creation trigger to handle it manually in application code
-- This gives us more control and better error handling

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();