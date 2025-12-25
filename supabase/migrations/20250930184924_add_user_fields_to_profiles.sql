-- Add user fields to profiles table
ALTER TABLE profiles
ADD COLUMN first_name VARCHAR(255),
ADD COLUMN last_name VARCHAR(255),
ADD COLUMN mobile_no VARCHAR(20),
ADD COLUMN date_of_birth DATE;