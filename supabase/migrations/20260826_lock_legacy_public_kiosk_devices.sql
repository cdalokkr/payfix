-- The legacy public kiosk table is not used by the current tenant-scoped
-- kiosk flow. Keep it available only to trusted backend service-role access.

ALTER TABLE public.kiosk_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_devices FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage legacy kiosk devices"
    ON public.kiosk_devices;

CREATE POLICY "Service role can manage legacy kiosk devices"
    ON public.kiosk_devices
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

REVOKE ALL ON TABLE public.kiosk_devices FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.kiosk_devices TO service_role;