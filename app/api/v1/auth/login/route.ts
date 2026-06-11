import { NextRequest, NextResponse } from 'next/server'
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

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { email, password } = body

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required.' },
                { status: 400 }
            )
        }

        // Authenticate with Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })

        if (error || !data.user || !data.session) {
            return NextResponse.json(
                { error: error?.message || 'Invalid credentials.' },
                { status: 401 }
            )
        }

        // Fetch DB Profile
        const profile = await db.query.profiles.findFirst({
            where: eq(profiles.id, data.user.id),
            with: { designation: true }
        })

        if (!profile) {
            return NextResponse.json(
                { error: 'Profile details not found.' },
                { status: 404 }
            )
        }

        if (profile.status === 'deactive' || profile.status === 'deleted') {
            // Sign out session
            await supabase.auth.signOut()
            return NextResponse.json(
                { error: 'Account has been deactivated or deleted.' },
                { status: 403 }
            )
        }

        return NextResponse.json({
            success: true,
            session: {
                accessToken: data.session.access_token,
                expiresAt: data.session.expires_at,
                refreshToken: data.session.refresh_token
            },
            user: {
                id: data.user.id,
                email: data.user.email
            },
            profile
        })
    } catch (err: any) {
        console.error('[API-V1-LOGIN] error:', err)
        return NextResponse.json(
            { error: err.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}
