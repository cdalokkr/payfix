import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releaseScript = join(projectRoot, 'scripts', 'deploy-production.sh');
const validReplitConfig = `[deployment]
deploymentTarget = "autoscale"
build = ["npm", "run", "build"]
run = ["npm", "run", "start"]
localPort = 8080

[deployment.env]
NODE_ENV = "production"
`;

const baseEnvironment = {
  ...process.env,
  DEPLOY_ENV: 'production',
  NODE_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: 'https://unit-test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'unit-test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'unit-test-service-role-key',
  NEXT_PUBLIC_APP_URL: 'https://payfix.example.com',
  PRODUCTION_URL: 'https://payfix.example.com',
  HEALTH_TIMEOUT_SECONDS: '0',
  HEALTH_RETRY_INTERVAL_SECONDS: '1',
};

async function createFixture({ withConfig = true } = {}) {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'payfix-deploy-gate-'));
  const scriptsDirectory = join(fixtureRoot, 'scripts');
  await mkdir(scriptsDirectory, { recursive: true });

  await writeFile(join(fixtureRoot, 'package.json'), JSON.stringify({
    dependencies: { next: '16.3.3' },
  }));
  await writeFile(join(fixtureRoot, 'package-lock.json'), '{}\n');
  await writeFile(join(fixtureRoot, 'next.config.ts'), 'export default {};\n');
  await writeFile(join(scriptsDirectory, 'deploy-production.sh'), await readFile(releaseScript));
  await chmod(join(scriptsDirectory, 'deploy-production.sh'), 0o755);

  if (withConfig) {
    await writeFile(join(fixtureRoot, '.replit'), validReplitConfig);
  }

  return fixtureRoot;
}

function runRelease(fixtureRoot, action, overrides = {}) {
  const environment = { ...baseEnvironment, ...overrides };

  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete environment[name];
    }
  }

  return spawnSync(
    'bash',
    [join(fixtureRoot, 'scripts', 'deploy-production.sh'), action],
    {
      cwd: fixtureRoot,
      env: environment,
      encoding: 'utf8',
      timeout: 30_000,
    },
  );
}

function outputOf(result) {
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

async function withFixture(options, callback) {
  const fixtureRoot = await createFixture(options);
  try {
    return await callback(fixtureRoot);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

async function installHealthMock(fixtureRoot, response) {
  const binDirectory = join(fixtureRoot, 'mock-bin');
  const responseFile = join(fixtureRoot, 'health-response.json');
  await mkdir(binDirectory, { recursive: true });
  await writeFile(responseFile, response);
  await writeFile(
    join(binDirectory, 'curl'),
    `#!/usr/bin/env bash
set -euo pipefail
output_file=""
previous=""
for argument in "$@"; do
  if [[ "$previous" == "--output" ]]; then
    output_file="$argument"
  fi
  previous="$argument"
done
cat "$HEALTH_RESPONSE_FILE" > "$output_file"
printf '200'
`,
  );
  await chmod(join(binDirectory, 'curl'), 0o755);

  return {
    PATH: `${binDirectory}:${process.env.PATH}`,
    HEALTH_RESPONSE_FILE: responseFile,
  };
}

test('rejects a release when the production configuration is missing', async () => {
  await withFixture({ withConfig: false }, (fixtureRoot) => {
    const result = runRelease(fixtureRoot, 'preflight');

    assert.notEqual(result.status, 0);
    assert.match(outputOf(result), /Missing .*\.replit; refusing to deploy/);
  });
});

test('rejects local and development production URLs before making a request', async (t) => {
  const rejectedUrls = [
    ['a local URL', 'http://localhost:3000'],
    ['a Replit development URL', 'https://preview.payfix.replit.dev'],
  ];

  for (const [description, url] of rejectedUrls) {
    await t.test(description, async () => {
      await withFixture({}, (fixtureRoot) => {
        const result = runRelease(fixtureRoot, 'verify', {
          PRODUCTION_URL: url,
          NEXT_PUBLIC_APP_URL: url,
        });

        assert.notEqual(result.status, 0);
        assert.match(
          outputOf(result),
          /Production target must be a reachable HTTPS URL, not a local or development host/,
        );
      });
    });
  }
});

test('reports every missing production environment variable during preflight', async () => {
  await withFixture({}, (fixtureRoot) => {
    const result = runRelease(fixtureRoot, 'preflight', {
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      NEXT_PUBLIC_APP_URL: undefined,
      PRODUCTION_URL: undefined,
    });
    const output = outputOf(result);

    assert.notEqual(result.status, 0);
    assert.match(output, /Missing required production environment variable: NEXT_PUBLIC_SUPABASE_URL/);
    assert.match(output, /Missing required production environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    assert.match(output, /Missing required production environment variable: SUPABASE_SERVICE_ROLE_KEY/);
    assert.match(output, /Missing required production environment variable: NEXT_PUBLIC_APP_URL/);
  });
});

test('rejects malformed health JSON', async () => {
  await withFixture({}, async (fixtureRoot) => {
    const healthMockEnvironment = await installHealthMock(fixtureRoot, 'not-json\n');
    const result = runRelease(fixtureRoot, 'verify', healthMockEnvironment);

    assert.notEqual(result.status, 0);
    assert.match(
      outputOf(result),
      /Published revision did not satisfy the production health contract/,
    );
  });
});

test('rejects a degraded health status', async () => {
  await withFixture({}, async (fixtureRoot) => {
    const healthMockEnvironment = await installHealthMock(
      fixtureRoot,
      JSON.stringify({
        status: 'degraded',
        environment: 'production',
        version: 'test-version',
        checks: { database: { status: 'healthy' } },
      }),
    );
    const result = runRelease(fixtureRoot, 'verify', healthMockEnvironment);

    assert.notEqual(result.status, 0);
    assert.match(
      outputOf(result),
      /Published revision did not satisfy the production health contract/,
    );
  });
});

test('rejects a health response from a non-production environment', async () => {
  await withFixture({}, async (fixtureRoot) => {
    const healthMockEnvironment = await installHealthMock(
      fixtureRoot,
      JSON.stringify({
        status: 'healthy',
        environment: 'development',
        version: 'test-version',
        checks: { database: { status: 'healthy' } },
      }),
    );
    const result = runRelease(fixtureRoot, 'verify', healthMockEnvironment);

    assert.notEqual(result.status, 0);
    assert.match(
      outputOf(result),
      /Published revision did not satisfy the production health contract/,
    );
  });
});

test('rejects health responses with an unhealthy component check', async () => {
  await withFixture({}, async (fixtureRoot) => {
    const healthMockEnvironment = await installHealthMock(
      fixtureRoot,
      JSON.stringify({
        status: 'healthy',
        environment: 'production',
        version: 'test-version',
        checks: { database: { status: 'unhealthy' } },
      }),
    );
    const result = runRelease(fixtureRoot, 'verify', healthMockEnvironment);

    assert.notEqual(result.status, 0);
    assert.match(
      outputOf(result),
      /Published revision did not satisfy the production health contract/,
    );
  });
});

test('runs preflight, deploy, and post-deploy stages without starting a local server', async () => {
  await withFixture({}, async (fixtureRoot) => {
    const releaseLog = join(fixtureRoot, 'release.log');
    const healthMockEnvironment = await installHealthMock(
      fixtureRoot,
      JSON.stringify({
        status: 'healthy',
        environment: 'production',
        version: 'test-version',
        checks: {
          database: { status: 'healthy' },
          storage: { status: 'healthy' },
        },
      }),
    );
    const mockBinDirectory = join(fixtureRoot, 'mock-bin');
    await writeFile(
      join(mockBinDirectory, 'npm'),
      `#!/usr/bin/env bash
set -euo pipefail
printf 'npm %s\\n' "$*" >> "$RELEASE_LOG"
if [[ "$1" == "--version" ]]; then
  printf '10.0.0'
elif [[ "$1" == "ci" ]]; then
  :
elif [[ "$1" == "run" && "$2" == "build" ]]; then
  mkdir -p .next
elif [[ "$1" == "run" && "$2" == "start" ]]; then
  printf 'local server start was attempted\\n' >> "$RELEASE_LOG"
  exit 1
else
  exit 1
fi
`,
    );
    await chmod(join(mockBinDirectory, 'npm'), 0o755);

    const result = runRelease(fixtureRoot, 'release', {
      ...healthMockEnvironment,
      PATH: `${mockBinDirectory}:${process.env.PATH}`,
      RELEASE_LOG: releaseLog,
      DEPLOY_COMMAND: `printf 'deploy\\n' >> '${releaseLog}'`,
    });
    const output = outputOf(result);

    assert.equal(result.status, 0, output);
    const log = await readFile(releaseLog, 'utf8');
    assert.ok(output.indexOf('========== PREFLIGHT ==========') < output.indexOf('========== DEPLOY =========='));
    assert.ok(
      output.indexOf('========== DEPLOY ==========') <
        output.indexOf('========== POST-DEPLOY VERIFICATION =========='),
    );
    assert.match(log, /npm --version/);
    assert.match(log, /npm ci --production=false/);
    assert.match(log, /npm run build/);
    assert.match(log, /deploy/);
    assert.doesNotMatch(log, /npm run start|local server start was attempted/);
  });
});