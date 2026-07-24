import './env-config';
import { centralDb } from '../lib/db/index';
import { sql } from 'drizzle-orm';

async function run() {
  console.log('[Seed Free Plan] Checking tenant_plans table for Free Plan...');

  try {
    // 1. Check if Free Plan exists
    const checkRes: any = await centralDb.execute(sql`
      SELECT id FROM public.tenant_plans WHERE name = 'free' OR display_name = 'Free Plan' LIMIT 1;
    `);

    const rows = Array.isArray(checkRes) ? checkRes : (checkRes?.rows || []);
    let freePlanId: string;

    if (rows.length > 0) {
      freePlanId = rows[0].id;
      console.log(`[Seed Free Plan] Found existing Free Plan ID: ${freePlanId}`);
      
      // Update display_name if needed
      await centralDb.execute(sql`
        UPDATE public.tenant_plans 
        SET display_name = 'Free Plan', price_monthly = 0.00 
        WHERE id = ${freePlanId}::uuid;
      `);
    } else {
      console.log('[Seed Free Plan] Free Plan not found. Inserting Free Plan...');
      const insertRes: any = await centralDb.execute(sql`
        INSERT INTO public.tenant_plans (name, display_name, price_monthly, max_employees, max_moderators, features)
        VALUES ('free', 'Free Plan', 0.00, 10, 2, '{"biometric": false, "geofencing": true, "payroll": false}'::jsonb)
        RETURNING id;
      `);
      const insertRows = Array.isArray(insertRes) ? insertRes : (insertRes?.rows || []);
      freePlanId = insertRows[0]?.id;
      console.log(`[Seed Free Plan] Created Free Plan with ID: ${freePlanId}`);
    }

    if (freePlanId) {
      // 2. Assign Free Plan to all tenants with NULL plan_id
      const updateTenantsRes = await centralDb.execute(sql`
        UPDATE public.tenants 
        SET plan_id = ${freePlanId}::uuid, updated_at = NOW() 
        WHERE plan_id IS NULL;
      `);

      console.log(`[Seed Free Plan] Updated tenants with Free Plan. Result:`, updateTenantsRes);
      console.log('[Seed Free Plan] Successfully updated plan on database!');
    }
    process.exit(0);
  } catch (error) {
    console.error('[Seed Free Plan] Failed to update free plan on database:', error);
    process.exit(1);
  }
}

run();
