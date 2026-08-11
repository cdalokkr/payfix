# Payfix Implementation & Architecture Plans (`plans/`)

Generated following the **`shadcn/improve`** advisor methodology for the **Payfix** codebase on **2026-08-11** against commit `6831b50`.

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

---

## Dependency Notes

- **Plan 008** (`catchError` Error Boundaries) can be executed independently.
- **Plan 009** (React 19 `useTransition` + `useOptimistic`) enhances client action responsiveness.
- **Plan 010** (`next/root-params`) cleans up server component layout props.
- **Plan 011** (`import.meta.glob`) optimizes Turbopack dynamic file loading.
