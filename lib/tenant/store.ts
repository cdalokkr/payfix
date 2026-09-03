import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
    tenantId: string;
    slug: string;
    databaseUrl: string | null;
    tenantSchema: string | null;
    brandName: string;
    licenseExpiresAt?: string | null;
    trusted?: boolean;
}

// Global store for the tenant context of the active request
export const tenantStorage = new AsyncLocalStorage<TenantContext>();
