import { createClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    }
})

export interface AuthenticatedContext {
    user: any
    profile: any
}

/**
 * Validates a JWT Bearer Token and returns the authenticated Supabase user and local database profile.
 * Throws an error if unauthorized.
 */
export async function validateBearerToken(authHeader: string | null): Promise<AuthenticatedContext> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Missing or invalid Authorization header. Expected Bearer <token>.')
    }

    const token = authHeader.split(' ')[1]
    if (!token) {
        throw new Error('Token payload is empty.')
    }

    const { data, error } = await supabase.auth.getUser(token)
    const user = data?.user || null

    if (error || !user) {
        throw new Error(error?.message || 'Invalid or expired authentication token.')
    }

    // Fetch DB Profile
    const profile = await db.query.profiles.findFirst({
        where: eq(profiles.id, user.id),
        with: { designation: true }
    })

    if (!profile) {
        throw new Error('Profile details for authenticated user not found.')
    }

    if (profile.status === 'deactive' || profile.status === 'deleted') {
        throw new Error('Your user account has been deactivated or deleted.')
    }

    return { user, profile }
}
