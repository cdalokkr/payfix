---
name: Database integration test lifecycle
description: Lifecycle constraints for standalone Node database tests that import application database modules.
---

Standalone `node:test` cases that import application database modules may leave the app's intentionally long-lived PostgreSQL singleton open after assertions complete. Use explicit test-runner exit handling or a supported connection teardown in the test harness.

**Why:** Application database clients are designed to stay alive for the server process, but that lifecycle can keep a one-shot integration command pending after its test body and cleanup have completed.

**How to apply:** When adding a standalone PostgreSQL integration test, verify the command itself exits promptly; do not weaken production pool settings solely to accommodate the test.