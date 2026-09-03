const REQUIRED_TEST_ENVIRONMENT = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

export function missingTestEnvironment(environment = process.env) {
  return REQUIRED_TEST_ENVIRONMENT.filter((name) => !environment[name]?.trim());
}

export function validateTestEnvironment(environment = process.env) {
  const missing = missingTestEnvironment(environment);
  if (missing.length > 0) {
    throw new Error(
      `SaaS CI test preflight failed: missing ${missing.join(', ')}. ` +
      'Provide non-secret test fixtures; deployment credentials are not required.',
    );
  }

  return true;
}

if (process.argv[1]?.endsWith('/validate-test-environment.mjs')) {
  validateTestEnvironment();
  console.log('SaaS CI test environment preflight passed: non-secret test fixtures are configured.');
}