import { cacheTag, cacheLife, revalidateTag } from 'next/cache';

/**
 * Tenant-scoped cache tag generator.
 * Enforces multi-tenant data isolation by namespacing all cache tags with the tenant ID.
 */
export function tenantTag(tenantId: string, resource: string, id?: string): string {
  const base = `tenant:${tenantId}:${resource}`;
  return id ? `${base}:${id}` : base;
}

/**
 * Revalidates all cached entries for a specific tenant resource.
 */
export function revalidateTenantTag(tenantId: string, resource: string, id?: string): void {
  const tag = tenantTag(tenantId, resource, id);
  revalidateTag(tag, { expire: 0 });
}

/**
 * Standard cache lifetime presets for tenant workloads.
 */
export const TENANT_CACHE_PROFILES = {
  REALTIME: 'seconds',
  DASHBOARD: 'minutes',
  LOOKUPS: 'hours',
  STATIC: 'days',
} as const;

export { cacheTag, cacheLife, revalidateTag };
