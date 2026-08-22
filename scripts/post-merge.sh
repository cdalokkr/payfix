#!/bin/bash
set -e

# PayFix is a standalone Next.js application and its source of truth is
# package-lock.json. The surrounding workspace's pnpm lockfile belongs to the
# original generic artifacts and cannot install this app with frozen-lockfile.
#
# Post-merge setup prepares the runnable app, not its test toolchain. Jest's
# dev-only dependency graph currently includes a tarball unavailable through
# the package firewall, while the application runtime does not depend on it.
npm ci --omit=dev --ignore-scripts --no-audit --no-fund
