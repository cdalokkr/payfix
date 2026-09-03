#!/bin/bash
set -euo pipefail

# The repository's canonical dependency lockfile is pnpm-lock.yaml. Use a
# frozen, non-interactive install so task merges cannot silently drift the
# dependency graph or fail on npm-only lockfile validation.
# Dev dependencies are not needed to prepare the runnable app, and lifecycle
# scripts stay disabled for a safe, repeatable setup.
pnpm install --offline --frozen-lockfile --prod --ignore-scripts
