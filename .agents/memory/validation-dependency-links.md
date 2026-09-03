---
name: Validation dependency links
description: Non-obvious behavior when the workspace Node dependency install is only partially linked.
---

When validation tools are missing from `node_modules/.bin`, first check the pnpm package store for the declared versions before changing dependency manifests.

**Why:** The workspace can retain usable runtime package links while test-only packages and type definitions are present only under `.pnpm`; a package restore can also be blocked by an unrelated firewall fetch.

**How to apply:** Prefer existing store binaries for focused validation when possible, and report checks that could not run because root links are incomplete rather than changing application dependencies.