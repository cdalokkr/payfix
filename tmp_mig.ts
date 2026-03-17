import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL must be defined");
    }
    const sql = postgres(connectionString, { max: 1 });

    try {
        await sql`ALTER TABLE "employee_salary_setup" ADD COLUMN "deduction_remark" text;`;
        console.log("Migration executed successfully");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await sql.end();
    }
}

main();
