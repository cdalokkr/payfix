import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const historicalPublicMigration =
  '20260828193102_add_biometric_pipeline_version_columns.sql';

export const reconciledVersions = [
  '20260828193102_add_biometric_pipeline_version_columns.sql',
  '20260828194544_add_biometric_pipeline_version_columns_to_tenants.sql',
  '20260828211149_add_tenant_biometric_verification_attempts.sql',
];

export const obsoleteVersions = [
  '20260829000000_add_biometric_pipeline_versions.sql',
  '20260829010000_add_tenant_biometric_verification_attempts.sql',
];

const approvedTenantRegistryReference =
  /\b(?:from|join)\s+public\s*\.\s*tenants\b/gi;
const tenantRegistryReference = /\btenant_registry\b/i;
const publicMutationPatterns = [
  /\b(?:insert\s+into|update|delete\s+from|truncate(?:\s+table)?|alter\s+table|create\s+(?:table|index|view|materialized\s+view|function|trigger|type|sequence)|drop\s+(?:table|index|view|materialized\s+view|function|trigger|type|sequence))\s+(?:if\s+(?:not\s+)?exists\s+)?public\s*\./i,
];
const publicSchemaPatterns = [
  /\bpublic\s*\./i,
  /\b(?:alter|create|drop)\s+schema\s+(?:if\s+(?:not\s+)?exists\s+)?public\b/i,
  /\bset\s+search_path\s*=\s*public\b/i,
];
const writePatterns = [
  /\binsert\s+into\s+(?:"[^"]+"|[a-z_][a-z0-9_$]*)(?:\s*\.\s*(?:"[^"]+"|[a-z_][a-z0-9_$]*))?/i,
  /\bupdate\s+(?:only\s+)?(?:"[^"]+"|[a-z_][a-z0-9_$]*)(?:\s*\.\s*(?:"[^"]+"|[a-z_][a-z0-9_$]*))?\s+set\b/i,
  /\bdelete\s+(?:from|using)\s+(?:"[^"]+"|[a-z_][a-z0-9_$]*)(?:\s*\.\s*(?:"[^"]+"|[a-z_][a-z0-9_$]*))?/i,
  /\bmerge\s+into\s+(?:"[^"]+"|[a-z_][a-z0-9_$]*)(?:\s*\.\s*(?:"[^"]+"|[a-z_][a-z0-9_$]*))?/i,
  /\btruncate(?:\s+table)?\s+(?:"[^"]+"|[a-z_][a-z0-9_$]*)(?:\s*\.\s*(?:"[^"]+"|[a-z_][a-z0-9_$]*))?/i,
];

export function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
}

/**
 * Validate one post-history migration against the tenant-only policy.
 *
 * `FROM/JOIN public.tenants` is the sole public-schema exception. It is
 * replaced before the broad public-reference check, then rejected if it shares
 * a statement with any write operation. This prevents a write from using the
 * approved read-only registry reference as a loophole.
 */
export function validateMigrationSql(sql, file) {
  const withoutComments = stripSqlComments(sql);
  const withoutApprovedReadOnlyFallback = withoutComments.replace(
    approvedTenantRegistryReference,
    'tenant_registry',
  );
  const failures = [];

  if (
    publicMutationPatterns.some((pattern) => pattern.test(withoutComments)) ||
    publicSchemaPatterns.some((pattern) =>
      pattern.test(withoutApprovedReadOnlyFallback),
    )
  ) {
    failures.push(
      `${file} targets the public schema outside the approved read-only tenant registry fallback. SaaS migrations after ${historicalPublicMigration} must be tenant-only.`,
    );
  }

  if (
    writePatterns.some((pattern) => pattern.test(withoutApprovedReadOnlyFallback)) &&
    tenantRegistryReference.test(withoutApprovedReadOnlyFallback)
  ) {
    failures.push(
      `${file} combines the approved public.tenants read with a write operation. The tenant registry fallback must be read-only.`,
    );
  }

  return failures;
}

export async function validateMigrationFiles(migrationDir) {
  const files = (await readdir(migrationDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  const failures = [];

  for (const file of reconciledVersions) {
    if (!files.includes(file)) {
      failures.push(`Missing reconciled migration: ${file}`);
    }
  }

  for (const file of obsoleteVersions) {
    if (files.includes(file)) {
      failures.push(`Obsolete duplicate migration still exists: ${file}`);
    }
  }

  for (const file of files) {
    if (file <= historicalPublicMigration || file === historicalPublicMigration) {
      continue;
    }

    const sql = await readFile(path.join(migrationDir, file), 'utf8');
    failures.push(...validateMigrationSql(sql, file));
  }

  return { files, failures };
}

export async function main() {
  const migrationDir = path.resolve(process.cwd(), 'supabase/migrations');
  const { files, failures } = await validateMigrationFiles(migrationDir);

  if (failures.length > 0) {
    console.error('SaaS migration validation failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Validated ${files.length} migrations: reconciled history is present and newer SaaS migrations do not target public.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await main();
}