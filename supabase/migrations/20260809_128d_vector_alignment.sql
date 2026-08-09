-- =========================================================================
-- PayFix Multi-Tenant 128-d Vector Schema Migration & RPC Alignment
-- Run this in Supabase SQL Editor
-- =========================================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add tenant_id column to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN tenant_id uuid;
  END IF;
END $$;

-- 3. Convert face_embedding column in public.profiles to vector(128)
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.profiles 
      ALTER COLUMN face_embedding TYPE vector(128) 
      USING face_embedding::text::vector(128);
  EXCEPTION WHEN others THEN
    ALTER TABLE public.profiles DROP COLUMN IF EXISTS face_embedding;
    ALTER TABLE public.profiles ADD COLUMN face_embedding vector(128);
  END;
END $$;

-- 4. Create HNSW Cosine Similarity Index for sub-millisecond search (<1ms)
DROP INDEX IF EXISTS public.idx_profiles_face_embedding_hnsw;

CREATE INDEX idx_profiles_face_embedding_hnsw
ON public.profiles
USING hnsw (face_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 5. Create Multi-Tenant 128-d match_employee_face RPC Function
CREATE OR REPLACE FUNCTION public.match_employee_face(
  query_embedding vector(128),
  match_threshold float DEFAULT 0.42,
  match_count int DEFAULT 1,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS TABLE (
  employee_id uuid,
  full_name text,
  employee_code text,
  avatar_url text,
  similarity float,
  face_quality_score real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p.id AS employee_id,
    p.full_name,
    p.mobile_no AS employee_code,
    p.avatar_url,
    (1 - (p.face_embedding <=> query_embedding))::float AS similarity,
    1.0::real AS face_quality_score
  FROM public.profiles p
  WHERE
    p.face_embedding IS NOT NULL
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND (1 - (p.face_embedding <=> query_embedding)) >= match_threshold
  ORDER BY p.face_embedding <=> query_embedding ASC
  LIMIT match_count;
$$;

-- 6. Create Multi-Tenant verify_employee_face Helper Function
CREATE OR REPLACE FUNCTION public.verify_employee_face(
  query_embedding vector(128),
  p_tenant_id uuid DEFAULT NULL,
  match_threshold float DEFAULT 0.42
)
RETURNS TABLE (
  is_match boolean,
  employee_id uuid,
  full_name text,
  employee_code text,
  similarity float,
  message text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT *
  INTO r
  FROM public.match_employee_face(
    query_embedding,
    match_threshold,
    1,
    p_tenant_id
  );

  IF r.employee_id IS NOT NULL THEN
    RETURN QUERY SELECT
      true,
      r.employee_id,
      r.full_name,
      r.employee_code,
      r.similarity,
      'Face matched successfully'::text;
  ELSE
    RETURN QUERY SELECT
      false,
      NULL::uuid,
      NULL::text,
      NULL::text,
      0::float,
      'No matching employee found'::text;
  END IF;
END;
$$;
