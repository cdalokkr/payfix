import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const migrationDir = path.resolve(process.cwd(), 'supabase/migrations');
const reconciledVersions = [
  '20260828193102_add_biometric_pipeline_version_columns.sql',
  '20260828194544_add_biometric_pipeline_version_columns_to_tenants.sql',
  '20260828211149_add_tenant_biometric_verification_attempts.sql',
];
const obsoleteVersions = [
  '20260829000000_add_biometric_pipeline_versions.sql',
  '20260829010000_add_tenant_biometric_verification_attempts.sql',
];
const historicalPublicMigration =
  '20260828193102_add_biometric_pipeline_version_columns.sql';

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
  const withoutComments = sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '');

  const publicSchemaPatterns = [
    /\bpublic\s*\./i,
    /\b(?:alter|create|drop)\s+schema\s+(?:if\s+(?:not\s+)?exists\s+)?public\b/i,
    /\bset\s+search_path\s*=\s*public\b/i,
  ];

  if (publicSchemaPatterns.some((pattern) => pattern.test(withoutComments))) {
    failures.push(
      `${file} targets the public schema. SaaS migrations after ${historicalPublicMigration} must be tenant-only.`,
    );
  }
}

if (failures.length > 0) {
  console.error('SaaS migration validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Validated ${files.length} migrations: reconciled history is present and newer SaaS migrations do not target public.`,
);