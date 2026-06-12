import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
    console.error('Missing DATABASE_URL')
    process.exit(1)
}

const sql = postgres(databaseUrl)

async function runMigration() {
    console.log('Running salary_payments migration...')

    try {
        // 1. Create salary_payments table
        await sql`
            CREATE TABLE IF NOT EXISTS salary_payments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                summary_id UUID NOT NULL REFERENCES monthly_attendance_summary(id) ON DELETE CASCADE,
                amount NUMERIC(12, 2) NOT NULL,
                paid_mode TEXT NOT NULL,
                pay_date DATE NOT NULL,
                pay_reference_no TEXT,
                payment_remarks TEXT,
                paid_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `
        console.log('Table "salary_payments" checked/created.')

        // 2. Add paid_amount column to monthly_attendance_summary
        await sql`
            ALTER TABLE monthly_attendance_summary 
            ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12, 2);
        `
        console.log('Column "paid_amount" check/added to "monthly_attendance_summary".')

        // 3. Migrate existing paid records to salary_payments
        const paidSummaries = await sql`
            SELECT id, take_home, paid_mode, pay_date, pay_reference_no, payment_remarks, paid_by, paid_at
            FROM monthly_attendance_summary
            WHERE paid_mode IS NOT NULL 
            AND id NOT IN (SELECT DISTINCT summary_id FROM salary_payments);
        `

        if (paidSummaries.length > 0) {
            console.log(`Migrating ${paidSummaries.length} existing paid summaries to salary_payments...`)
            for (const s of paidSummaries) {
                await sql`
                    INSERT INTO salary_payments (
                        summary_id, amount, paid_mode, pay_date, pay_reference_no, payment_remarks, paid_by, created_at, updated_at
                    ) VALUES (
                        ${s.id}, ${s.take_home}, ${s.paid_mode}, ${s.pay_date || new Date().toISOString().split('T')[0]}, ${s.pay_reference_no}, ${s.payment_remarks}, ${s.paid_by}, ${s.paid_at || new Date()}, ${s.paid_at || new Date()}
                    );
                `
                await sql`
                    UPDATE monthly_attendance_summary
                    SET paid_amount = ${s.take_home}
                    WHERE id = ${s.id};
                `
            }
            console.log('Migration of existing paid summaries complete.')
        }

        console.log('SUCCESS: Migration completed successfully.')
    } catch (error: any) {
        console.error('FAILED to run migration:', error.message)
    } finally {
        await sql.end()
    }
}

runMigration()
