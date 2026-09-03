import { db } from './index';
import { getTenantDb } from './tenant-connection';

describe('tenant database isolation', () => {
    it('does not fall back to central or public when tenant context is missing', () => {
        expect(() => (db as any).query).toThrow(
            'TENANT_CONTEXT_REQUIRED: use centralDb explicitly for control-plane operations.',
        );
    });

    it('does not accept untrusted routing values or public as a tenant schema', () => {
        expect(() => getTenantDb('tenant-id', null, 'tenant_acme')).toThrow(
            'TENANT_CONTEXT_REQUIRED',
        );
        expect(() => getTenantDb('tenant-id', null, 'public', true)).toThrow();
    });
});