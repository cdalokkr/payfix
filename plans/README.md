# Payfix Implementation & Architecture Plans (`plans/`)

Generated following the **`shadcn/improve`** advisor methodology for the **Payfix** codebase on **develop branch** against commit `e3e8858` (reviewed with Coarena AI `gemini-4-carbon` / `gemini-4-argon` architecture analysis).

---

## Execution Order & Status Index

| Plan | Title | Category | Priority | Effort | Depends on | Status |
|------|-------|----------|----------|--------|------------|--------|
| [001](./001-baseline-testing.md) | Baseline Testing & Type Safety Script | dx / testing | P1 | S | — | **DONE** |
| [002](./002-performance-bundle-optimization.md) | Heavy Bundle & Dynamic Import Optimization | perf | P1 | M | 001 | **DONE** |
| [003](./003-proxy-and-architecture-refactor.md) | Proxy Modularization & Security Architecture | tech-debt | P2 | M | — | **DONE** |
| [004](./004-fix-drizzle-trpc-types.md) | Resolve Drizzle ORM & tRPC Router Type Safety | tech-debt | P1 | M | 001 | **DONE** |
| [005](./005-security-and-auth-hardening.md) | Security & Credentials Hardening | security | P1 | S | — | **DONE** |
| [006](./006-feature-roadmap-payslip-exporter.md) | Feature Roadmap: Automated Payslip & Excel Exporter | direction | P2 | M | — | **DONE** |
| [007](./007-pwa-offline-geofence-cache.md) | Mobile Offline Geofence & Service Worker Caching | perf / dx | P3 | M | — | **DONE** |
| [008](./008-next16-3-error-boundaries-catch-error.md) | Next.js 16.3 Custom Error Boundaries with `catchError` & `retry()` | tech-debt / dx | P1 | S | — | **DONE** |
| [009](./009-react19-server-actions-transitions-optimistic-ui.md) | React 19 / Next 16.3 Server Action Transitions & Optimistic UI | perf / dx | P1 | M | — | **DONE** |
| [010](./010-next16-3-root-params-propagation.md) | Next.js 16.3 `next/root-params` Adoption in Server Components | tech-debt / dx | P2 | S | — | **DONE** |
| [011](./011-turbopack-glob-imports-and-hmr.md) | Next.js 16.3 Turbopack `import.meta.glob` API & HMR Integration | dx / perf | P2 | S | — | **DONE** |
| [012](./012-tenant-schema-contract-alignment.md) | Tenant Schema Contract Alignment for Departments & Shifts | correctness / multi-tenancy | P1 | S | — | **DONE** |
| [013](./013-jest-haste-and-worktree-isolation.md) | Jest Haste Module Collision & Worktree Isolation | testing / dx | P1 | S | — | **PLANNED** |
| [014](./014-zod-and-dependency-security-remediation.md) | Zod & Critical Dependency Security Vulnerability Remediation | security / dependencies | P2 | S | — | **PLANNED** |
| [015](./015-react19-render-purity-and-lint-remediation.md) | React 19 Render Purity & ESLint CI Gate Remediation | bug / dx / tech-debt | P1 | S | — | **DONE** |
| [016](./016-tenant-connection-pool-and-serverless-hygiene.md) | Tenant Connection Pool & Serverless Timer Hygiene | perf / security | P1 | S | — | **DONE** |
| [017](./017-kiosk-offline-contract-and-banner-alignment.md) | Kiosk Offline Contract & Banner Alignment | ux / correctness | P2 | S | — | **DONE** |
| [018](./018-cross-month-shift-and-overtime-attribution.md) | Cross-Month Shift Overtime Attribution & Payslip Audit Lock | correctness / payroll | P1 | M | — | **DONE** |
| [019](./019-coarena-ai-complaint-triage-and-payroll-insights.md) | Coarena AI Complaint Triage & Payroll Insights UI Integration | direction / ai | P2 | M | — | **DONE** |

---

## Dependency & Implementation Order

1. **Phase 1: CI & React 19 Render Purity (Plan 015)**:
   - Remediate `ShiftManagementHub.tsx` (`setState` in `useMemo`) to unblock `eslint --max-warnings=0` on CI.
2. **Phase 2: Serverless & Multi-Tenant Infrastructure (Plan 016)**:
   - Add `.unref()` to `lib/db/tenant-connection.ts` idle connection pruner and bound `resolverCache`.
3. **Phase 3: Payroll Integrity & Audit Lock (Plan 018)**:
   - Guard `payslip_generated` summaries from bulk recompile overwrites; test cross-month night shift attribution.
4. **Phase 4: Kiosk UX & Offline Contract Alignment (Plan 017)**:
   - Harmonize Kiosk offline banner with server-only 1:N verification contract.
5. **Phase 5: AI Feature Surface (Plan 019)**:
   - Hook up `trpc.ai` triage and rating UI into Admin Complaints and Attendance/Payroll screens.
