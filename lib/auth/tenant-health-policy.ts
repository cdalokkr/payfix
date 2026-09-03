import type { Profile } from '@/types';

export const TENANT_HEALTH_PROBE_TOKEN_HEADER = 'x-tenant-health-probe-token';

const TENANT_HEALTH_PATHS = new Set([
    '/api/health/tenant',
    '/api/health/tenant-deep',
]);

type HeaderRequest = {
    headers?: {
        get(name: string): string | null;
    };
} | null | undefined;

/**
 * Tenant health diagnostics expose tenant identity and aggregate counts.
 * Keep the operator role boundary explicit instead of treating any signed-in
 * user as an operator.
 */
export function isTenantHealthOperator(
    profile: Pick<Profile, 'role'> | null | undefined,
): boolean {
    return profile?.role === 'admin' || profile?.role === 'super_admin';
}

export function isTenantHealthDiagnosticPath(pathname: string): boolean {
    const normalizedPath = pathname.length > 1
        ? pathname.replace(/\/+$/, '')
        : pathname;
    return TENANT_HEALTH_PATHS.has(normalizedPath);
}

function constantTimeEqual(left: string, right: string): boolean {
    if (left.length !== right.length) return false;

    let difference = 0;
    for (let index = 0; index < left.length; index += 1) {
        difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return difference === 0;
}

/**
 * Release probes must present a server-side token. An absent token is never
 * treated as an authorization signal, including when the environment is
 * misconfigured.
 */
export function hasValidTenantHealthProbeToken(request: HeaderRequest): boolean {
    const expectedToken = process.env.TENANT_HEALTH_PROBE_TOKEN;
    const suppliedToken = request?.headers?.get(TENANT_HEALTH_PROBE_TOKEN_HEADER);

    return Boolean(
        expectedToken &&
        suppliedToken &&
        constantTimeEqual(suppliedToken, expectedToken),
    );
}