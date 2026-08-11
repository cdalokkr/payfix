# Plan 011: Next.js 16.3 Turbopack `import.meta.glob` API & HMR Integration

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6831b50..HEAD -- lib/`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx / perf
- **Planned at**: commit `6831b50`, 2026-08-11

## Why this matters

Next.js 16.3 Turbopack now supports the Vite-compatible `import.meta.glob` API for importing multiple files/modules dynamically from the file system. For static assets, documentation files, or dynamic report templates, `import.meta.glob` provides tree-shakeable dynamic imports with instant Hot Module Reloading (HMR) support during development.

## Current state

- Static asset or icon configuration maps are manually listed in object maps across `lib/` files.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npm run typecheck`| exit 0, 0 errors    |
| Build     | `npm run build`    | exit 0, compiled successfully |

## Scope

**In scope**:
- `lib/docs/loader.ts` (create/update)

**Out of scope**:
- `next.config.ts` turbopack configuration

## Steps

### Step 1: Implement Dynamic Module Loading via `import.meta.glob`
Create or update `lib/docs/loader.ts` to load documentation or dynamic markdown files using Turbopack's `import.meta.glob`:

```ts
export function loadDocModules() {
  // Turbopack Vite-compatible glob import API (Next.js 16.3)
  const modules = import.meta.glob('./**/*.md', { eager: true });
  return modules;
}
```

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Build & Validate
Run `npm run build` to verify Turbopack compiles `import.meta.glob` modules without bundler errors.

**Verify**: `npm run build` → exit 0.

## Test plan

- Verify `import.meta.glob` imports compile cleanly in Turbopack build mode.
- Run `npm run typecheck` → 0 errors.

## Done criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] `plans/README.md` status updated
