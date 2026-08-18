# Next.js 16.3 + React 19 Full-Project Architecture & Coding Standard

This document establishes the official architectural patterns and coding standards for all future modules, pages, and components in PayFix.

---

## 1. Core Principles

1. **Instant Navigations & Partial Prefetching**:
   - All shared App Shells (Navbars, Sidebars, Footers, Card Layouts) are separated from dynamic user data.
   - Use `<Link href="..." prefetch={true}>` for primary navigation routes so the destination App Shell is available on the client before the user clicks.
   - Dynamic data sections must stream in through React 19 `<Suspense fallback={<Skeleton />}>` boundaries without blocking page transitions.

2. **React 19 Concurrent Actions (`useActionState` + `useOptimistic`)**:
   - **Optimistic State Updates**: Any user action that changes state (e.g. Attendance clock in/out, leave application, approval toggle, theme switch, settings save) must immediately update the UI using `useOptimistic`.
   - **Action Queue Coordination**: Use `useActionState` to coordinate asynchronous server actions. It guarantees that rapid consecutive actions (e.g. fast clicks, punch toggles) are executed in strict FIFO order and prevents race conditions.
   - **Graceful Rollback**: If a server transaction encounters an error, `useOptimistic` automatically reverts the UI to the last confirmed state with an error toast.

3. **Multi-Tenant Schema Isolation**:
   - All tenant operations (attendance, leaves, payroll, profiles, activities) must execute strictly inside `tenant_<slug>` schema.
   - Database operations inside Server Actions, Route Handlers, and tRPC must use `runWithTenantSchema(tenantSchema, fn)` or `runWithRequestHeaders(fn)` which sets PostgreSQL `search_path = tenant_<slug>, public`.
   - Never query `public.profiles` or use `supabase.auth.getSession()` for tenant user data. Always use `await supabase.auth.getUser()` and query the tenant schema.

4. **Zero Cross-User Cache Leakage**:
   - Set `staleTimes: { dynamic: 0, static: 180 }` for dynamic authenticated route boundaries.
   - On Login / Logout transitions, use clean full-tree mounts (`window.location.replace`) to ensure the Next.js React Server Component (RSC) tree is 100% freshly rendered.
   - Layout headers must bind dynamically to live session hooks (`trpc.profile.get.useQuery`) rather than solely relying on static layout props.

---

## 2. Project-Wide Architectural Implementation Matrix

| Layer / Role | Route Tree | Next.js 16.3 + React 19 Pattern | Multi-Tenant Enforcement |
| :--- | :--- | :--- | :--- |
| **PWA Mobile App** | `/mobile/*` | Instant Navigations, `useOptimistic` for multi-session attendance punch, `useActionState` for leave/ticket forms, dynamic `<MobileHeader>` | Bound to `tenant_<slug>` via `tenant_fallback` cookie and request headers. |
| **Kiosk Terminal** | `/kiosk` | 512-d ArcFace vectors cached in IndexedDB + RAM Float32Array, sub-50ms offline match, multi-session badges | Scoped strictly to paired tenant schema via `x-kiosk-secret` pairing key. |
| **Admin Backoffice** | `/admin/*` | Partial Prefetching for sidebar links, optimistic approval toggles, Suspense metric cards | Strict `tenant_<slug>` search_path for all employee rosters and payroll. |
| **Moderator Portal** | `/moderator/*` | Instant layout transitions, optimistic attendance & shift overrides | Scoped strictly to that tenant's employee attendance & leave queue. |
| **Employee Web** | `/employee/*` | App Shell prefetching, optimistic leave requests, instant payslip generation | Reads own records inside `tenant_<slug>`. |
| **SuperAdmin** | `/superadmin/*` | Global control plane, server-cached tenant directory (`'use cache'`) | Queries `masterDb` / `public.tenants` & `public.tenant_plans`. |
| **Tenant Provisioning**| `/setup`, `/login` | High-speed schema migration, immediate cache invalidation | Automatically creates `tenant_<slug>` schema with isolated tables. |

---

## 3. Standard Component Templates

### A. Optimistic Action Component (React 19)
```tsx
'use client';

import { useActionState, useOptimistic, startTransition } from 'react';
import { toast } from 'sonner';

interface Item {
  id: string;
  status: 'active' | 'inactive';
}

export function StatusToggle({ item, onToggleAction }: { item: Item; onToggleAction: (id: string, status: string) => Promise<Item> }) {
  const [optimisticItem, setOptimisticItem] = useOptimistic(
    item,
    (state, nextStatus: 'active' | 'inactive') => ({ ...state, status: nextStatus })
  );

  const [state, formAction, isPending] = useActionState(async (prevState: Item, nextStatus: 'active' | 'inactive') => {
    try {
      return await onToggleAction(prevState.id, nextStatus);
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
      return prevState; // Rollback
    }
  }, item);

  const handleToggle = () => {
    const next = optimisticItem.status === 'active' ? 'inactive' : 'active';
    startTransition(async () => {
      setOptimisticItem(next);
      await formAction(next);
    });
  };

  return (
    <button onClick={handleToggle} disabled={isPending} className="btn-toggle">
      {optimisticItem.status}
    </button>
  );
}
```

### B. Tenant-Scoped Server Route Loader
```tsx
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { runWithRequestHeaders } from '@/lib/tenant/with-context';
import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

export default async function TenantPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await runWithRequestHeaders(async () => {
    return await db.query.profiles.findFirst({
      where: eq(profiles.id, user.id),
      with: { designation: true }
    });
  });

  if (!profile) redirect('/login');

  return <TenantClientComponent profile={profile} />;
}
```
