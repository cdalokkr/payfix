import { sql } from 'drizzle-orm';
import { centralDb } from '../lib/db';
import { inspectTenantSchemaContract } from '../lib/tenant/schema-contract';

async function main() {
    const schemas = await centralDb.execute(sql`
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name ~ '^tenant_[a-z0-9_]+$'
        ORDER BY schema_name
    `);

    if (schemas.length === 0) {
        console.log('No tenant schemas found.');
        process.exit(0);
    }

    let failed = false;
    for (const row of schemas) {
        const report = await inspectTenantSchemaContract(centralDb, row.schema_name);
        console.log(JSON.stringify(report, null, 2));
        failed ||= !report.ok;
    }

    if (failed) {
        process.exitCode = 1;
    } else {
        console.log(`Tenant schema contract passed for ${schemas.length} schema(s).`);
    }
    process.exit(process.exitCode ?? 0);
}

main().catch((error) => {
    console.error('Tenant schema contract audit failed:', error);
    process.exit(1);
});
