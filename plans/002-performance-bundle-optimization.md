# Plan 002: Heavy Bundle & Dynamic Import Optimization

## Overview
`package.json` installs several heavy client-side libraries: `exceljs`, `jspdf`, `jspdf-autotable`, `xlsx`, and `recharts`.
Including these directly in top-level static imports bloats client-side JavaScript bundles.
This plan configures Next.js package optimization and provides guidelines for dynamic imports of export and chart modules.

- **Target Files**: `next.config.ts`, `package.json`
- **Category**: Performance
- **Impact**: High
- **Effort**: Medium

---

## Current State Excerpt
`next.config.ts` has standard Next.js config without explicit `optimizePackageImports` for heavy UI/icon libraries:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ... existing config
};

export default nextConfig;
```

---

## Proposed Modifications

### 1. Update `next.config.ts`
Add `experimental.optimizePackageImports` for `@radix-ui/*`, `lucide-react`, and `date-fns` to ensure tree-shaking and reduced bundle overhead.

---

## Verification Gates
1. Run `npx tsc --noEmit` -> must pass cleanly.
2. Run `npm run build` -> Next.js production build must compile successfully.

---

## STOP Conditions
- If Next.js version incompatible options are passed to `next.config.ts`, revert and report exact error.
