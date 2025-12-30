-- ============================================
-- Designations Table Implementation
-- ============================================

-- 1. Create designations table
CREATE TABLE IF NOT EXISTS public.designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add designation_id to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS designation_id UUID REFERENCES public.designations(id) ON DELETE SET NULL;

-- 3. Enable RLS
ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Allow anyone to read designations (needed for user creation/editing)
CREATE POLICY "Allow authenticated users to read designations" 
ON public.designations FOR SELECT 
TO authenticated 
USING (true);

-- Only admins can manage (Insert/Update/Delete) designations
CREATE POLICY "Admins can manage designations" 
ON public.designations 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- 5. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_designations_updated_at
    BEFORE UPDATE ON public.designations
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
