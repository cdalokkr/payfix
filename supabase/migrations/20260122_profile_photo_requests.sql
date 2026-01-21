-- Profile Photo Requests table for approval workflow
CREATE TABLE IF NOT EXISTS profile_photo_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    pending_photo_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookup of pending requests
CREATE INDEX IF NOT EXISTS idx_photo_requests_profile_status 
    ON profile_photo_requests(profile_id, status);

-- Index for admin dashboard
CREATE INDEX IF NOT EXISTS idx_photo_requests_status 
    ON profile_photo_requests(status) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE profile_photo_requests ENABLE ROW LEVEL SECURITY;

-- Employees can view their own photo requests
CREATE POLICY "Employees can view own photo requests" 
    ON profile_photo_requests
    FOR SELECT 
    USING (auth.uid() = profile_id);

-- Employees can insert their own photo requests
CREATE POLICY "Employees can create own photo requests" 
    ON profile_photo_requests
    FOR INSERT 
    WITH CHECK (auth.uid() = profile_id);

-- Admins and moderators can view all photo requests
CREATE POLICY "Admins can view all photo requests" 
    ON profile_photo_requests
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'moderator')
        )
    );

-- Admins and moderators can update photo requests (for approval/rejection)
CREATE POLICY "Admins can update photo requests" 
    ON profile_photo_requests
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'moderator')
        )
    );

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE profile_photo_requests;
