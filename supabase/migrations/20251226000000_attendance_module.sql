-- ============================================
-- ATTENDANCE MODULE SCHEMA
-- ============================================

-- 1. OFFICE SETTINGS & CLOSURES
CREATE TABLE IF NOT EXISTS public.office_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    default_check_in TIME NOT NULL DEFAULT '10:00:00',
    default_check_out TIME NOT NULL DEFAULT '19:00:00',
    off_days INTEGER[] DEFAULT array[0],
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initial default settings
INSERT INTO public.office_settings (default_check_in, default_check_out, off_days)
SELECT '10:00:00', '19:00:00', array[0]
WHERE NOT EXISTS (SELECT 1 FROM public.office_settings);

CREATE TABLE IF NOT EXISTS public.office_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('holiday', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. EMPLOYEE SPECIFIC SETTINGS
CREATE TABLE IF NOT EXISTS public.employee_settings (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    custom_check_in TIME,
    custom_check_out TIME,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in TIMESTAMP WITH TIME ZONE,
    check_out TIMESTAMP WITH TIME ZONE,
    working_hours NUMERIC, -- stored in hours
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    remarks TEXT,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_extra_day BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(profile_id, date)
);

-- 4. LEAVES TABLE
CREATE TABLE IF NOT EXISTS public.leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    leave_type TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    remarks TEXT,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (start_date <= end_date)
);

-- 5. TRIGGERS FOR UPDATED_AT
CREATE TRIGGER update_office_settings_updated_at
    BEFORE UPDATE ON public.office_settings
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_employee_settings_updated_at
    BEFORE UPDATE ON public.employee_settings
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at
    BEFORE UPDATE ON public.attendance
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 6. RLS POLICIES

-- Office Settings
ALTER TABLE office_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read office settings" ON office_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage office settings" ON office_settings FOR ALL TO authenticated USING (public.is_admin());

-- Office Closures
ALTER TABLE office_closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read office closures" ON office_closures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage office closures" ON office_closures FOR ALL TO authenticated USING (public.is_admin());

-- Employee Settings
ALTER TABLE employee_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own employee settings" ON employee_settings FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY "Admins can manage all employee settings" ON employee_settings FOR ALL TO authenticated USING (public.is_admin());

-- Attendance
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own attendance" ON attendance FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY "Users can insert their own attendance" ON attendance FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Users can update their own check_out" ON attendance FOR UPDATE TO authenticated USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Admins/Moderators can manage all attendance" ON attendance FOR SELECT TO authenticated USING (public.is_admin_or_moderator());
CREATE POLICY "Admins/Moderators can update all attendance" ON attendance FOR UPDATE TO authenticated USING (public.is_admin_or_moderator()) WITH CHECK (public.is_admin_or_moderator());
CREATE POLICY "Admins can delete attendance" ON attendance FOR DELETE TO authenticated USING (public.is_admin());

-- Leaves
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own leaves" ON leaves FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY "Users can apply for their own leaves" ON leaves FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Admins/Moderators can manage all leaves" ON leaves FOR SELECT TO authenticated USING (public.is_admin_or_moderator());
CREATE POLICY "Admins/Moderators can update all leaves" ON leaves FOR UPDATE TO authenticated USING (public.is_admin_or_moderator()) WITH CHECK (public.is_admin_or_moderator());
CREATE POLICY "Admins can delete leaves" ON leaves FOR DELETE TO authenticated USING (public.is_admin());

-- 7. FUNCTIONS

-- Function to calculate working hours
CREATE OR REPLACE FUNCTION calculate_working_hours()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.check_in IS NOT NULL AND NEW.check_out IS NOT NULL THEN
        NEW.working_hours = EXTRACT(EPOCH FROM (NEW.check_out - NEW.check_in)) / 3600;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_calculate_working_hours
    BEFORE INSERT OR UPDATE OF check_in, check_out ON public.attendance
    FOR EACH ROW
    EXECUTE FUNCTION calculate_working_hours();
