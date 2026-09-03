import { eq } from 'drizzle-orm';
import { createSupabaseAdminClient, ensureSuperAdminAuthUser, findAuthUserByEmail } from '../lib/auth/supabase-admin';
import { masterDb } from '../lib/db/master-connection';
import { tenants } from '../lib/db/master-schema';
import { centralDb } from '../lib/db';
import { ensureCanonicalTenantSchema } from '../lib/tenant/provisioning';
import { tenantSchemaNameFromSlug } from '../lib/tenant/schema-contract';
import { sql } from 'drizzle-orm';

const DEFAULT_REPAIR_SLUGS = ['qaalpha', 'qabeta', 'mybetatest'];

function splitName(name: string): { fullName: string; firstName: string; lastName: string } {
  const fullName = name.trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    fullName,
    firstName: parts[0] || 'Administrator',
    lastName: parts.slice(1).join(' '),
  };
}

async function repairTenantAdmin(slug: string) {
  const tenant = await masterDb.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
  });
  if (!tenant) {
    console.warn(`[repair-tenant-admins] Skipping ${slug}: tenant not found`);
    return;
  }

  const schemaName = tenant.tenant_schema || tenantSchemaNameFromSlug(tenant.slug);
  await ensureCanonicalTenantSchema(schemaName);

  const supabaseAdmin = createSupabaseAdminClient();
  const profileRows = await centralDb.execute(sql`
    SELECT full_name, first_name, last_name, mobile_no
    FROM ${sql.raw(schemaName)}.profiles
    WHERE LOWER(email) = LOWER(${tenant.admin_email}) OR role = 'admin'
    ORDER BY CASE WHEN LOWER(email) = LOWER(${tenant.admin_email}) THEN 0 ELSE 1 END, created_at ASC
    LIMIT 1
  `);
  const existingProfile = profileRows[0] as {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    mobile_no?: string;
  } | undefined;
  const existingAuthUser = await findAuthUserByEmail(supabaseAdmin, tenant.admin_email);
  const existingAuthName = existingAuthUser?.user_metadata?.full_name;
  const name = splitName(
    existingProfile?.full_name
      || existingAuthName
      || `${tenant.company_name} Admin`,
  );
  const { user: authUser } = await ensureSuperAdminAuthUser(supabaseAdmin, {
    email: tenant.admin_email,
    fullName: name.fullName,
    phone: existingProfile?.mobile_no || existingAuthUser?.user_metadata?.phone,
  });

  const designation = await centralDb.execute(sql`
    SELECT id FROM ${sql.raw(schemaName)}.designations WHERE role = 'admin' LIMIT 1
  `);
  const designationId = designation[0]?.id as string | undefined;
  if (!designationId) throw new Error(`Admin designation missing for ${slug}`);

  // Only repair identity/contact columns. Biometric and business columns are
  // deliberately absent from this upsert.
  await centralDb.execute(sql`
    INSERT INTO ${sql.raw(schemaName)}.profiles
      (id, email, full_name, role, status, designation_id, first_name, last_name, mobile_no, created_at, updated_at)
    VALUES
      (${authUser.id}, ${tenant.admin_email}, ${name.fullName}, 'admin', 'active',
       ${designationId}, ${name.firstName}, ${name.lastName || null},
       ${existingProfile?.mobile_no || existingAuthUser?.user_metadata?.phone || null}, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = 'admin',
      status = 'active',
      designation_id = EXCLUDED.designation_id,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      updated_at = NOW()
  `);

  console.log(`[repair-tenant-admins] Repaired ${slug} (${tenant.admin_email})`);
}

async function main() {
  const requestedSlugs = process.argv.slice(2).filter(Boolean);
  const slugs = requestedSlugs.length ? requestedSlugs : DEFAULT_REPAIR_SLUGS;
  for (const slug of slugs) await repairTenantAdmin(slug.toLowerCase());
}

main().catch((error) => {
  console.error('[repair-tenant-admins] Failed:', error);
  process.exitCode = 1;
});