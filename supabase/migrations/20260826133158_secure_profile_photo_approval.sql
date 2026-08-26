-- Keep profile-photo candidates separate from the live biometric template.
ALTER TABLE public.profile_photo_requests
    ADD COLUMN IF NOT EXISTS pending_face_embedding vector(128);

-- A profile can have one reviewable candidate at a time. This is enforced in
-- the database as well as in the application so concurrent uploads cannot
-- create multiple active requests.
CREATE UNIQUE INDEX IF NOT EXISTS profile_photo_requests_one_pending_per_profile
    ON public.profile_photo_requests (profile_id)
    WHERE status = 'pending';

-- A face-match result is a short-lived, single-use capability for exactly one
-- attendance action. Store only its hash, never the browser token itself.
CREATE TABLE IF NOT EXISTS public.biometric_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('clock_in', 'clock_out')),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS biometric_verification_tokens_lookup
    ON public.biometric_verification_tokens (profile_id, action, expires_at)
    WHERE used_at IS NULL;

ALTER TABLE public.biometric_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Only trusted server code using the service database connection handles
-- these records. Browsers must never read or write verification capabilities.
REVOKE ALL ON TABLE public.biometric_verification_tokens FROM anon, authenticated;