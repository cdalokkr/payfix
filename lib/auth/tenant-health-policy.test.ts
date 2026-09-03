/** @jest-environment node */

import {
    TENANT_HEALTH_PROBE_TOKEN_HEADER,
    hasValidTenantHealthProbeToken,
    isTenantHealthDiagnosticPath,
    isTenantHealthOperator,
} from './tenant-health-policy';

describe('tenant health diagnostic access policy', () => {
    const originalProbeToken = process.env.TENANT_HEALTH_PROBE_TOKEN;

    afterEach(() => {
        if (originalProbeToken === undefined) {
            delete process.env.TENANT_HEALTH_PROBE_TOKEN;
        } else {
            process.env.TENANT_HEALTH_PROBE_TOKEN = originalProbeToken;
        }
    });

    it('limits operator access to admin roles and recognizes both diagnostic paths', () => {
        expect(isTenantHealthOperator({ role: 'admin' })).toBe(true);
        expect(isTenantHealthOperator({ role: 'super_admin' })).toBe(true);
        expect(isTenantHealthOperator({ role: 'moderator' })).toBe(false);
        expect(isTenantHealthOperator(null)).toBe(false);

        expect(isTenantHealthDiagnosticPath('/api/health/tenant')).toBe(true);
        expect(isTenantHealthDiagnosticPath('/api/health/tenant-deep/')).toBe(true);
        expect(isTenantHealthDiagnosticPath('/api/health')).toBe(false);
    });

    it('requires the configured probe token and rejects missing or incorrect tokens', () => {
        process.env.TENANT_HEALTH_PROBE_TOKEN = 'synthetic-test-token';

        expect(hasValidTenantHealthProbeToken({
            headers: new Headers({
                [TENANT_HEALTH_PROBE_TOKEN_HEADER]: 'synthetic-test-token',
            }),
        })).toBe(true);
        expect(hasValidTenantHealthProbeToken({
            headers: new Headers({
                [TENANT_HEALTH_PROBE_TOKEN_HEADER]: 'wrong-token',
            }),
        })).toBe(false);
        expect(hasValidTenantHealthProbeToken({
            headers: new Headers(),
        })).toBe(false);

        delete process.env.TENANT_HEALTH_PROBE_TOKEN;
        expect(hasValidTenantHealthProbeToken({
            headers: new Headers({
                [TENANT_HEALTH_PROBE_TOKEN_HEADER]: 'synthetic-test-token',
            }),
        })).toBe(false);
    });
});