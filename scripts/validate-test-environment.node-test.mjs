import assert from 'node:assert/strict';
import test from 'node:test';
import {
  missingTestEnvironment,
  validateTestEnvironment,
} from './validate-test-environment.mjs';

test('accepts the non-secret Supabase test fixtures', () => {
  assert.deepEqual(
    missingTestEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: 'https://unit-test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'unit-test-anon-key',
    }),
    [],
  );
  assert.equal(
    validateTestEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: 'https://unit-test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'unit-test-anon-key',
    }),
    true,
  );
});

test('reports missing configuration without requiring or exposing credentials', () => {
  assert.deepEqual(
    missingTestEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: 'https://unit-test.supabase.co',
    }),
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  );

  assert.throws(
    () => validateTestEnvironment({}),
    /missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY/,
  );
});