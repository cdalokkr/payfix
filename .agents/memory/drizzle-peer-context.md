---
name: Drizzle type resolution
description: Why this repository needs one compiler-visible Drizzle dependency context
---

TypeScript must resolve all Drizzle imports through the root application dependency context. Nested workspace-library node_modules links can resolve a second peer-instantiated copy, and Drizzle's private type members then make otherwise identical columns incompatible.

**Why:** The compiler reports misleading hundreds of query-builder errors when `drizzle-orm` is loaded through both `postgres` and `@types/pg` peer contexts.

**How to apply:** Preserve the root `drizzle-orm` path mapping in `tsconfig.json` when adding workspace libraries or reinstalling dependencies; do not weaken type checking to hide these errors.