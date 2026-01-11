// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Create Supabase client for edge functions
 * Uses service role for admin operations
 */
export function createSupabaseClient() {
    return createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}

/**
 * Create Supabase client with user's JWT for RLS-aware queries
 */
export function createSupabaseClientWithAuth(authHeader: string) {
    const token = authHeader.replace('Bearer ', '')
    return createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
            global: {
                headers: { Authorization: `Bearer ${token}` },
            },
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}
