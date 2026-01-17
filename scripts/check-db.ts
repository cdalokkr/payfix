
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkSchema() {
    console.log('Checking profiles table structure...')

    // Try to select the new column
    const { data, error } = await supabase
        .from('profiles')
        .select('id, avatar_status')
        .limit(1)

    if (error) {
        console.log('Error selecting avatar_status:', error.message)
        if (error.message.includes('column "avatar_status" does not exist')) {
            console.log('CONFIRMED: Column "avatar_status" is missing in the database.')

            console.log('Attempting to add column via raw SQL (if possible)...')
            // Supabase JS client doesn't support raw SQL easily unless we have an edge function or use a specific RPC
            // However, we can try to use Drizzle if we had a script for it.
        }
    } else {
        console.log('Success! column exists.')
    }
}

checkSchema()
