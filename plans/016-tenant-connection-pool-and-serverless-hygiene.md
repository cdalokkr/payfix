# Plan 016: Tenant Connection Pool & Serverless Timer Hygiene

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e3e8858..HEAD -- lib/db/tenant-connection.ts lib/tenant/resolver.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf / security / tech-debt
- **Planned at**: commit `e3e8858`, 2026-11-11
- **Status**: **DONE** (Executed via Coarena `gemini-4-carbon`, request `req_OJSvF58YD9qkwqEeatQTTfNe`, tests: 4/4 pass, typecheck: 0 errors)

## Why this matters

In `lib/db/tenant-connection.ts`, a module-level `setInterval` runs every 5 minutes to prune idle postgres client pools. In serverless and containerized edge environments (Vercel Lambdas, Google Cloud Run), active timers without `.unref()` prevent the Node.js event loop from draining naturally during freeze cycles, causing warning logs, CPU spin, and potential memory leaks across hot re-invocations. Furthermore, in-memory caches like `resolverCache` in `lib/tenant/resolver.ts` have no max-size bound.

## Current state

- `lib/db/tenant-connection.ts:24-36`:
  ```ts
  if (process.env.NODE_ENV !== 'test') {
      setInterval(() => {
          const now = Date.now();
          const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes
          for (const [key, cached] of connectionPoolCache.entries()) {
              if (now - cached.lastUsed > IDLE_TIMEOUT) {
                  console.log(`[DB Router] Closing idle connection pool: ${key}`);
                  cached.client.end();
                  connectionPoolCache.delete(key);
              }
          }
      }, 5 * 60 * 1000); // Check every 5 minutes
  }
  ```
- `lib/tenant/resolver.ts:38-39`:
  ```ts
  const resolverCache = new Map<string, { data: TenantMetadata | null; expires: number }>();
  const CACHE_TTL = 3 * 60 * 1000;
  ```

## Commands you will need

| Purpose   | Command                         | Expected on success |
|-----------|---------------------------------|---------------------|
| Typecheck | `pnpm typecheck`                | exit 0, no errors   |
| Tests     | `pnpm run test:saas-environment`| exit 0, all pass    |

## Scope

**In scope**:
- `lib/db/tenant-connection.ts`
- `lib/tenant/resolver.ts`

**Out of scope**:
- Do not alter tenant connection resolution semantics or `search_path` routing.
- Do not modify master database credentials or Supabase pooler connection strings.

## Git workflow

- Branch: `advisor/016-connection-pool-hygiene`
- Commit message: `perf(db): unref serverless pool pruning timer and bound tenant resolver cache`

## Detailed Implementation Steps

### Step 1: Unref the idle connection pool pruning timer
In `lib/db/tenant-connection.ts`, assign the timer and call `.unref()` if running in a Node environment:
```ts
if (process.env.NODE_ENV !== 'test') {
    const pruneTimer = setInterval(() => {
        const now = Date.now();
        const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes
        for (const [key, cached] of connectionPoolCache.entries()) {
            if (now - cached.lastUsed > IDLE_TIMEOUT) {
                console.log(`[DB Router] Closing idle connection pool: ${key}`);
                cached.client.end().catch(() => {});
                connectionPoolCache.delete(key);
            }
        }
    }, 5 * 60 * 1000);

    if (typeof pruneTimer.unref === 'function') {
        pruneTimer.unref();
    }
}
```

### Step 2: Bound `resolverCache` in `lib/tenant/resolver.ts`
Add an upper bound check (e.g. max 500 entries) and eviction of expired entries before inserting new entries to avoid memory creep under domain scans:
```ts
const MAX_RESOLVER_CACHE_SIZE = 500;

function setResolverCache(host: string, data: TenantMetadata | null) {
    if (resolverCache.size >= MAX_RESOLVER_CACHE_SIZE) {
        const now = Date.now();
        for (const [k, v] of resolverCache.entries()) {
            if (now > v.expires) resolverCache.delete(k);
        }
        if (resolverCache.size >= MAX_RESOLVER_CACHE_SIZE) {
            const firstKey = resolverCache.keys().next().value;
            if (firstKey) resolverCache.delete(firstKey);
        }
    }
    resolverCache.set(host, { data, expires: Date.now() + CACHE_TTL });
}
```

### Step 3: Run Verification
```bash
pnpm run test:saas-environment
pnpm run typecheck
```

## STOP conditions
- If `client.end()` throws or blocks async queries on reconnect, ensure errors are caught and logged non-fatally.
