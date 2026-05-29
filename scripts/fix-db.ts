import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
    console.error('Missing DATABASE_URL')
    process.exit(1)
}

const sql = postgres(databaseUrl)

async function runFixes() {
    console.log('Attempting to apply database RLS recursion fixes...')

    try {
        // Add avatar_status column just in case
        await sql`
            ALTER TABLE profiles 
            ADD COLUMN IF NOT EXISTS avatar_status TEXT DEFAULT 'default';
        `
        console.log('Column "avatar_status" checked/added.')

        // Recreate is_admin function as SECURITY DEFINER to bypass RLS recursion
        await sql`
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
        `
        console.log('Function public.is_admin() updated to SECURITY DEFINER.')

        // Recreate is_admin_or_moderator function as SECURITY DEFINER to bypass RLS recursion
        await sql`
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
        `
        console.log('Function public.is_admin_or_moderator() updated to SECURITY DEFINER.')

        console.log('SUCCESS: All database fixes applied successfully.')
    } catch (error: any) {
        console.error('FAILED to apply fixes:', error.message)
    } finally {
        await sql.end()
    }
}

runFixes()
