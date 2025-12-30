-- Add user_id column to profiles table
ALTER TABLE profiles
ADD COLUMN user_id UUID REFERENCES auth.users(id);