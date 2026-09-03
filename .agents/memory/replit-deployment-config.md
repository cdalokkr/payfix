---
name: Replit deployment config
description: Workspace-specific constraint for safely changing the protected .replit deployment configuration.
---

The protected `.replit` file must be replaced through the workspace's schema-validation flow after writing a complete candidate configuration to a temporary workspace file.

**Why:** Direct edits to `.replit` are rejected, and bypassing validation can leave deployment settings unapplied or invalid.

**How to apply:** When changing deployment settings, preserve unrelated TOML and use the configuration validator/replacement flow before verifying the resulting file.