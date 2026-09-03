---
name: Tenant schema safety
description: Rules for repairing legacy tenant profile ownership without weakening workspace isolation.
---

Tenant profile ownership repairs must be dry-run by default, assign only NULL tenant IDs from the control-plane registry, preserve and report conflicting non-NULL IDs, and verify every processed schema afterward. Public profiles are control-plane identities, never workspace backfill sources.

**Why:** Runtime tenant guards fail closed when ownership is missing or inconsistent; silently overwriting a non-NULL value could conceal cross-workspace data placement.

**How to apply:** Keep tenant registry resolution and tenant-schema writes separate from public/control-plane tables, and require an explicit apply step before any legacy repair.