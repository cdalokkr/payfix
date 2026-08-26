-- Public production hardening. Browser RPC callers retain profile resolution
-- for themselves only; trusted server-side SQL calls retain their existing path.

DROP POLICY IF EXISTS "Enable read access for authenticated users on attendance_sessions"
    ON public.attendance_sessions;

CREATE OR REPLACE FUNCTION public.is_admin_or_moderator()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('admin', 'moderator')
          AND status = 'active'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.find_profile_across_schemas(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    tenant_rec record;
    result jsonb;
BEGIN
    IF auth.role() = 'authenticated' AND auth.uid() IS DISTINCT FROM target_user_id THEN
        RAISE EXCEPTION 'A user may only resolve their own profile'
            USING ERRCODE = '42501';
    END IF;

    FOR tenant_rec IN
        SELECT tenant_schema, slug
        FROM public.tenants
        WHERE tenant_schema IS NOT NULL
          AND status IN ('active', 'trial')
    LOOP
        BEGIN
            EXECUTE format(
                'SELECT jsonb_build_object(
                    ''id'', p.id,
                    ''email'', p.email,
                    ''full_name'', p.full_name,
                    ''role'', p.role,
                    ''status'', p.status,
                    ''designation_id'', p.designation_id,
                    ''avatar_url'', p.avatar_url,
                    ''first_name'', p.first_name,
                    ''last_name'', p.last_name,
                    ''mobile_no'', p.mobile_no,
                    ''allowed_modules'', p.allowed_modules,
                    ''tenant_schema'', %L,
                    ''tenant_slug'', %L,
                    ''designation'', (
                        SELECT jsonb_build_object(
                            ''id'', d.id,
                            ''name'', d.name,
                            ''description'', d.description,
                            ''role'', d.role
                        )
                        FROM %I.designations d
                        WHERE d.id = p.designation_id
                        LIMIT 1
                    )
                )
                FROM %I.profiles p
                WHERE p.id = $1
                LIMIT 1',
                tenant_rec.tenant_schema,
                tenant_rec.slug,
                tenant_rec.tenant_schema,
                tenant_rec.tenant_schema
            ) USING target_user_id INTO result;

            IF result IS NOT NULL THEN
                RETURN result;
            END IF;
        EXCEPTION WHEN undefined_table THEN
            CONTINUE;
        END;
    END LOOP;

    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_from_schema(schema_name text, user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    result jsonb;
BEGIN
    IF auth.role() = 'authenticated' AND auth.uid() IS DISTINCT FROM user_id THEN
        RAISE EXCEPTION 'A user may only resolve their own profile'
            USING ERRCODE = '42501';
    END IF;

    IF schema_name <> 'public'
       AND NOT EXISTS (
           SELECT 1
           FROM public.tenants
           WHERE tenant_schema = schema_name
             AND status IN ('active', 'trial')
       ) THEN
        RAISE EXCEPTION 'Unknown or inactive tenant schema'
            USING ERRCODE = '22023';
    END IF;

    EXECUTE format(
        'SELECT jsonb_build_object(
            ''id'', p.id,
            ''email'', p.email,
            ''full_name'', p.full_name,
            ''role'', p.role,
            ''status'', p.status,
            ''designation_id'', p.designation_id,
            ''designation'', (
                SELECT jsonb_build_object(
                    ''id'', d.id,
                    ''name'', d.name,
                    ''description'', d.description,
                    ''role'', d.role
                )
                FROM %I.designations d
                WHERE d.id = p.designation_id
                LIMIT 1
            )
        )
        FROM %I.profiles p
        WHERE p.id = $1
        LIMIT 1',
        schema_name,
        schema_name
    ) USING user_id INTO result;

    RETURN result;
EXCEPTION
    WHEN undefined_table THEN
        RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.find_profile_across_schemas(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_profile_from_schema(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_moderator() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.find_profile_across_schemas(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_profile_from_schema(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_moderator() TO authenticated, service_role;