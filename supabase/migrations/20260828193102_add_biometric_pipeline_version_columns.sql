-- Historical migration reconciled with the version already applied in Supabase.
-- Do not edit or re-run this migration against production.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS face_embedding_pipeline_version text;

ALTER TABLE public.profile_photo_requests
    ADD COLUMN IF NOT EXISTS pending_face_embedding_pipeline_version text;