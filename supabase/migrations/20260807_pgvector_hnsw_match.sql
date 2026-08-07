-- =========================================================================
-- Supabase Migration: pgvector HNSW Indexing & Face Matching RPC
-- PayFix Multi-Tenant Face Verification Architecture
-- =========================================================================

-- 1. Enable the pgvector extension in PostgreSQL
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add 128-dimensional vector column to profiles table if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'face_embedding_vector'
    ) THEN
        ALTER TABLE profiles ADD COLUMN face_embedding_vector vector(128);
    END IF;
END $$;

-- 3. Create HNSW Cosine Similarity Index for sub-millisecond vector search
CREATE INDEX IF NOT EXISTS idx_profiles_face_embedding_hnsw 
ON profiles 
USING hnsw (face_embedding_vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 4. High-Performance Multi-Tenant Face Matching RPC Function
CREATE OR REPLACE FUNCTION match_employee_face(
  query_embedding vector(128),
  match_threshold float DEFAULT 0.40,
  match_count int DEFAULT 1
)
RETURNS TABLE (
  employee_id uuid,
  full_name text,
  avatar_url text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT 
    id AS employee_id,
    full_name,
    avatar_url,
    (1 - (face_embedding_vector <=> query_embedding)) AS similarity
  FROM profiles
  WHERE face_embedding_vector IS NOT NULL
    AND (1 - (face_embedding_vector <=> query_embedding)) >= match_threshold
  ORDER BY face_embedding_vector <=> query_embedding ASC
  LIMIT match_count;
$$;
