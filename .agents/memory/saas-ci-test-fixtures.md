---
name: SaaS CI test fixtures
description: Non-production environment values required by the full application test suite in GitHub Actions.
---

The full test suite needs a non-production `SESSION_SECRET` in CI. Some biometric proof cases are constructed while the Jest module is being evaluated, before per-test setup hooks can assign the variable.

**Why:** A workflow that only supplies the Supabase test fixtures can pass the preflight checks but still fail during biometric test collection with a missing-session-secret error.

**How to apply:** Keep the CI-only signing fixture scoped to the application test step. Never reuse it for deployments or production validation, and continue keeping production credentials out of GitHub workflow files.