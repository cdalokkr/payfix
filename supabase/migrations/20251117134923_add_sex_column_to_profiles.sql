-- Add sex column to profiles table
ALTER TABLE profiles
ADD COLUMN sex TEXT CHECK (sex IN ('male', 'female', 'other', 'prefer_not_to_say'));