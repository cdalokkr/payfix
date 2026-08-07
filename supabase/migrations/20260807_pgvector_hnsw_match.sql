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

-- 4. Main Face Matching RPC Function (Minimum 60%+ similarity score required)
CREATE OR REPLACE FUNCTION public.match_employee_face(
  query_embedding vector(128),
  match_threshold float DEFAULT 0.60,   -- Cosine similarity score threshold (0.60 = 60% match)
  match_count int DEFAULT 1
)
RETURNS TABLE (
  employee_id uuid,
  full_name text,
  avatar_url text,
  similarity float
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT 
    id AS employee_id,
    full_name,
    avatar_url,
    (1 - (face_embedding_vector <=> query_embedding))::float AS similarity
  FROM profiles
  WHERE status = 'active'
    AND face_embedding_vector IS NOT NULL
    AND (1 - (face_embedding_vector <=> query_embedding)) >= match_threshold
  ORDER BY face_embedding_vector <=> query_embedding ASC
  LIMIT match_count;
$$;

-- 5. Supporting Verification Helper Function (Returns boolean is_match & message)
CREATE OR REPLACE FUNCTION public.verify_employee_face(
  query_embedding vector(128),
  match_threshold float DEFAULT 0.60
)
RETURNS TABLE (
  is_match boolean,
  employee_id uuid,
  full_name text,
  avatar_url text,
  similarity float,
  message text
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result RECORD;
BEGIN
  SELECT *
  INTO result
  FROM public.match_employee_face(
    query_embedding,
    match_threshold,
    1
  );

  IF result.employee_id IS NOT NULL THEN
    RETURN QUERY SELECT
      true,
      result.employee_id,
      result.full_name,
      result.avatar_url,
      result.similarity,
      'Face matched successfully'::text;
  ELSE
    RETURN QUERY SELECT
      false,
      NULL::uuid,
      NULL::text,
      NULL::text,
      0::float,
      'No matching employee found (Minimum 60% score required)'::text;
  END IF;
END;
$$;
