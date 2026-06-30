-- Migration 009: Add profile fields to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS full_name    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS phone        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS avatar_url   TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender       VARCHAR(10) CHECK (gender IN ('male', 'female', 'other'));
