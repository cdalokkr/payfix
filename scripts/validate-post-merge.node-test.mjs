import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validatePostMergeSetup } from './validate-post-merge.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const validLockfile = `lockfileVersion: '9.0'

importers:

  .:
    dependencies: {}
`;
const validConfig = `[postMerge]
path = "scripts/post-merge.sh"
`;
const validDeploymentConfig = `[deployment]
build = ["pnpm", "run", "build"]
run = ["pnpm", "run", "start"]
`;
const validCiWorkflow = `name: SaaS CI

jobs:
  validate:
    steps:
      - name: Set up pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.26.1
`;
const validReleaseWorkflow = `name: Release

jobs:
  release:
    steps:
      - name: Install pnpm for release
        uses: pnpm/action-setup@v4
        with:
          version: 10.26.1
`;
const validPackageJson = JSON.stringify({ packageManager: 'pnpm@10.26.1' });
const validScript = `#!/bin/bash
set -euo pipefail
pnpm install --offline --frozen-lockfile --prod --ignore-scripts
`;

test('accepts the pnpm post-merge setup wired in .replit', async () => {
  const [postMergeScript, pnpmLockfile, replitConfig, packageJson, ciWorkflow] = await Promise.all([
    readFile(join(projectRoot, 'scripts/post-merge.sh'), 'utf8'),
    readFile(join(projectRoot, 'pnpm-lock.yaml'), 'utf8'),
    readFile(join(projectRoot, '.replit'), 'utf8'),
    readFile(join(projectRoot, 'package.json'), 'utf8'),
    readFile(join(projectRoot, '.github/workflows/saas-ci.yml'), 'utf8'),
  ]);

  assert.deepEqual(
    validatePostMergeSetup({
      postMergeScript,
      pnpmLockfile,
      replitConfig,
      packageJson,
      ciWorkflow,
    }),
    [],
  );
});

test('runs SaaS CI for every branch push, pull request, and manual dispatch', async () => {
  const ciWorkflow = await readFile(join(projectRoot, '.github/workflows/saas-ci.yml'), 'utf8');

  assert.match(
    ciWorkflow,
    /^on:\n  push:\n  pull_request:\n  workflow_dispatch:\n/m,
  );
  assert.doesNotMatch(ciWorkflow, /^\s+branches:/m);

  const testStep = ciWorkflow.match(
    /^\s+- name: Test\n([\s\S]*?)(?=^\s+- name:|\s*$)/m,
  )?.[1];
  assert.ok(testStep, 'SaaS CI must define a Test step');
  assert.match(testStep, /^\s+env:\n/m);
  assert.match(testStep, /^\s+SESSION_SECRET:\s+\S+/m);
});

test('accepts pnpm deployment build and run commands', () => {
  assert.deepEqual(
    validatePostMergeSetup({
      postMergeScript: validScript,
      pnpmLockfile: validLockfile,
      replitConfig: `${validConfig}\n${validDeploymentConfig}`,
      packageJson: validPackageJson,
    }),
    [],
  );
});

test('accepts a CI pnpm version that matches package.json', () => {
  assert.deepEqual(
    validatePostMergeSetup({
      postMergeScript: validScript,
      pnpmLockfile: validLockfile,
      replitConfig: validConfig,
      packageJson: validPackageJson,
      ciWorkflow: validCiWorkflow,
    }),
    [],
  );
});

test('checks pnpm versions in every workflow that configures pnpm/action-setup', () => {
  assert.deepEqual(
    validatePostMergeSetup({
      postMergeScript: validScript,
      pnpmLockfile: validLockfile,
      replitConfig: validConfig,
      packageJson: validPackageJson,
      ciWorkflows: [
        { path: '.github/workflows/saas-ci.yml', content: validCiWorkflow },
        { path: '.github/workflows/release.yml', content: validReleaseWorkflow },
      ],
    }),
    [],
  );
});

test('reports the workflow and configured version for a version mismatch', () => {
  const failures = validatePostMergeSetup({
    postMergeScript: validScript,
    pnpmLockfile: validLockfile,
    replitConfig: validConfig,
    packageJson: validPackageJson,
    ciWorkflows: [
      { path: '.github/workflows/saas-ci.yml', content: validCiWorkflow },
      {
        path: '.github/workflows/release.yml',
        content: validReleaseWorkflow.replace('version: 10.26.1', 'version: 10.25.0'),
      },
    ],
  });

  assert.deepEqual(failures, [
    'pnpm version mismatch: package.json declares pnpm@10.26.1, but .github/workflows/release.yml configures pnpm/action-setup with version 10.25.0.',
  ]);
});

test('ignores workflows that do not configure pnpm/action-setup', () => {
  assert.deepEqual(
    validatePostMergeSetup({
      postMergeScript: validScript,
      pnpmLockfile: validLockfile,
      replitConfig: validConfig,
      packageJson: validPackageJson,
      ciWorkflows: [
        { path: '.github/workflows/docs.yml', content: 'name: Docs\njobs: {}\n' },
      ],
    }),
    [],
  );
});

test('accepts a hash-suffixed package-manager declaration and quoted CI version', () => {
  assert.deepEqual(
    validatePostMergeSetup({
      postMergeScript: validScript,
      pnpmLockfile: validLockfile,
      replitConfig: validConfig,
      packageJson: JSON.stringify({ packageManager: 'pnpm@10.26.1+sha512.example' }),
      ciWorkflow: validCiWorkflow.replace('version: 10.26.1', 'version: "10.26.1" # keep aligned'),
    }),
    [],
  );
});

test('reports which pnpm configuration is out of sync', () => {
  const failures = validatePostMergeSetup({
    postMergeScript: validScript,
    pnpmLockfile: validLockfile,
    replitConfig: validConfig,
    packageJson: validPackageJson,
    ciWorkflow: validCiWorkflow.replace('version: 10.26.1', 'version: 10.25.0'),
  });

  assert.deepEqual(failures, [
    'pnpm version mismatch: package.json declares pnpm@10.26.1, but .github/workflows/saas-ci.yml configures pnpm/action-setup with version 10.25.0.',
  ]);
});

test('reports deployment commands that switch away from pnpm', () => {
  const failures = validatePostMergeSetup({
    postMergeScript: validScript,
    pnpmLockfile: validLockfile,
    replitConfig: `${validConfig}\n${validDeploymentConfig
      .replace('["pnpm", "run", "build"]', '["npm", "run", "build"]')
      .replace('["pnpm", "run", "start"]', '["yarn", "run", "start"]')}`,
    packageJson: validPackageJson,
  });

  assert.deepEqual(failures, [
    '[deployment].build must invoke pnpm, the repository\'s canonical package manager; found npm.',
    '[deployment].run must invoke pnpm, the repository\'s canonical package manager; found yarn.',
  ]);
});

test('reports a package.json package-manager policy that is not pnpm', () => {
  const failures = validatePostMergeSetup({
    postMergeScript: validScript,
    pnpmLockfile: validLockfile,
    replitConfig: validConfig,
    packageJson: JSON.stringify({ packageManager: 'npm@11.0.0' }),
  });

  assert.deepEqual(failures, [
    'package.json must declare a pnpm packageManager because pnpm-lock.yaml is the canonical dependency graph.',
  ]);
});

test('reports when a post-merge script switches away from pnpm', () => {
  const failures = validatePostMergeSetup({
    postMergeScript: validScript.replace('pnpm install', 'npm ci'),
    pnpmLockfile: validLockfile,
    replitConfig: validConfig,
  });

  assert.ok(failures.some((failure) => failure.includes('must run `pnpm install`')));
  assert.ok(failures.some((failure) => failure.includes('must not run npm')));
});

test('reports when frozen lockfile enforcement is removed', () => {
  const failures = validatePostMergeSetup({
    postMergeScript: validScript.replace(' --frozen-lockfile', ''),
    pnpmLockfile: validLockfile,
    replitConfig: validConfig,
  });

  assert.deepEqual(failures, [
    'The post-merge pnpm install must include --frozen-lockfile so dependency resolution cannot drift.',
  ]);
});

test('reports when the install explicitly selects package-lock.json', () => {
  const failures = validatePostMergeSetup({
    postMergeScript: validScript.replace(
      '--frozen-lockfile',
      '--frozen-lockfile --lockfile=package-lock.json',
    ),
    pnpmLockfile: validLockfile,
    replitConfig: validConfig,
  });

  assert.deepEqual(failures, [
    'The post-merge pnpm install must resolve against pnpm-lock.yaml, not package-lock.json.',
  ]);
});

test('reports when the install explicitly selects another lockfile', () => {
  const failures = validatePostMergeSetup({
    postMergeScript: validScript.replace(
      '--frozen-lockfile',
      '--frozen-lockfile --lockfile=other-lock.yaml',
    ),
    pnpmLockfile: validLockfile,
    replitConfig: validConfig,
  });

  assert.deepEqual(failures, [
    'The post-merge pnpm install must resolve against pnpm-lock.yaml when an explicit lockfile is provided.',
  ]);
});

test('reports missing or non-pnpm lockfile content', () => {
  const failures = validatePostMergeSetup({
    postMergeScript: validScript,
    pnpmLockfile: '{"lockfileVersion":3}\n',
    replitConfig: validConfig,
  });

  assert.deepEqual(failures, [
    'pnpm-lock.yaml does not look like a pnpm lockfile (missing lockfileVersion).',
    'pnpm-lock.yaml does not contain pnpm importer metadata.',
  ]);
});

test('reports a missing pnpm lockfile and hook wiring', () => {
  const failures = validatePostMergeSetup({
    postMergeScript: validScript,
    pnpmLockfile: '',
    replitConfig: '[postMerge]\npath = "scripts/other-setup.sh"\n',
  });

  assert.deepEqual(failures, [
    'pnpm-lock.yaml is missing or empty; post-merge setup cannot verify the dependency graph.',
    '.replit must wire the [postMerge] hook to scripts/post-merge.sh.',
  ]);
});

test('reports missing .replit hook configuration', () => {
  const failures = validatePostMergeSetup({
    postMergeScript: validScript,
    pnpmLockfile: validLockfile,
  });

  assert.deepEqual(failures, [
    '.replit must wire the [postMerge] hook to scripts/post-merge.sh.',
  ]);
});