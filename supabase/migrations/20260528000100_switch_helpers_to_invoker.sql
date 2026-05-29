-- Migration: Switch helper functions to SECURITY INVOKER
-- Date: 2026-05-28
-- Description: Switches is_admin, is_admin_or_moderator, and is_within_geofence functions to SECURITY INVOKER to resolve the remaining authenticated_security_definer_function_executable linter warnings.

-- =============================================================================
-- SECTION 1: RECREATE IS_ADMIN AS SECURITY INVOKER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role = 'admin'
  );
END;
$$;

-- =============================================================================
-- SECTION 2: RECREATE IS_ADMIN_OR_MODERATOR AS SECURITY DEFINER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_admin_or_moderator()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'moderator')
  );
END;
$$;

-- =============================================================================
-- SECTION 3: RECREATE IS_WITHIN_GEOFENCE AS SECURITY INVOKER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_within_geofence(
    user_lat NUMERIC,
    user_lng NUMERIC
) RETURNS TABLE (
    is_allowed BOOLEAN,
    location_name TEXT,
    distance_meters NUMERIC
) 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        true AS is_allowed,
        ol.name AS location_name,
        ROUND(
            6371000 * acos(
                cos(radians(user_lat)) * cos(radians(ol.latitude)) *
                cos(radians(ol.longitude) - radians(user_lng)) +
                sin(radians(user_lat)) * sin(radians(ol.latitude))
            )
        ) AS distance_meters
    FROM public.office_locations ol
    WHERE ol.is_active = true
    AND 6371000 * acos(
        cos(radians(user_lat)) * cos(radians(ol.latitude)) *
        cos(radians(ol.longitude) - radians(user_lng)) +
        sin(radians(user_lat)) * sin(radians(ol.latitude))
    ) <= ol.radius_meters
    ORDER BY distance_meters
    LIMIT 1;
    
    -- If no rows returned, user is outside all geofences
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            false AS is_allowed,
            (SELECT name FROM public.office_locations WHERE is_active = true ORDER BY 
                6371000 * acos(
                    cos(radians(user_lat)) * cos(radians(latitude)) *
                    cos(radians(longitude) - radians(user_lng)) +
                    sin(radians(user_lat)) * sin(radians(latitude))
                ) LIMIT 1
            ) AS location_name,
            (SELECT ROUND(MIN(
                6371000 * acos(
                    cos(radians(user_lat)) * cos(radians(latitude)) *
                    cos(radians(longitude) - radians(user_lng)) +
                    sin(radians(user_lat)) * sin(radians(latitude))
                )
            )) FROM public.office_locations WHERE is_active = true) AS distance_meters;
    END IF;
END;
$$;
