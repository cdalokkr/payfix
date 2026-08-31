import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    assertTenantSchemaName,
    CANONICAL_TENANT_COLUMNS,
    CANONICAL_TENANT_TABLES,
    TENANT_REQUIRED_FOREIGN_KEYS,
    TENANT_REQUIRED_INDEXES,
    TENANT_SCHEMA_TEMPLATE,
    TENANT_SCHEMA_VERSION,
    shouldRollbackTenantSchema,
    tenantSchemaContractFailure,
    tenantSchemaNameFromSlug,
} from './schema-contract';

const alignmentMigration = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260830160000_align_tenant_schema_contract.sql'),
    'utf8',
);

describe('tenant schema contract', () => {
    it('contains every tenant business table and excludes control-plane tables', () => {
        expect(CANONICAL_TENANT_TABLES).toHaveLength(30);
        expect(CANONICAL_TENANT_TABLES).toContain('biometric_verification_attempts');
        expect(CANONICAL_TENANT_TABLES).toContain('salary_payments');
        expect(CANONICAL_TENANT_TABLES).not.toContain('tenants' as never);
        expect(CANONICAL_TENANT_TABLES).not.toContain('tenant_branding' as never);
    });

    it('keeps evolved biometric, photo approval, and kiosk fields in the contract', () => {
        expect(CANONICAL_TENANT_COLUMNS.profiles).toEqual(
            expect.arrayContaining([
                'face_embedding',
                'face_embedding_512',
                'face_embedding_pipeline_version',
            ]),
        );
        expect(CANONICAL_TENANT_COLUMNS.profile_photo_requests).toEqual(
            expect.arrayContaining([
                'pending_photo_sha256',
                'pending_face_embedding_512',
                'pending_face_embedding_pipeline_version',
            ]),
        );
        expect(CANONICAL_TENANT_COLUMNS.kiosk_devices).toEqual(
            expect.arrayContaining([
                'name',
                'terminal_id',
                'location_id',
                'last_seen_at',
                'credential_hash',
                'credential_expires_at',
            ]),
        );
        expect(TENANT_REQUIRED_INDEXES).toEqual(
            expect.arrayContaining([
                ['profiles', 'profiles_face_embedding_hnsw_idx'],
                ['biometric_verification_attempts', 'biometric_verification_attempts_created_idx'],
            ]),
        );
        expect(TENANT_REQUIRED_FOREIGN_KEYS.length).toBeGreaterThan(40);
    });

    it('normalizes safe tenant schema names and rejects unsafe identifiers', () => {
        expect(tenantSchemaNameFromSlug('Acme-HR')).toBe('tenant_acme_hr');
        expect(() => tenantSchemaNameFromSlug('ab')).toThrow();
        expect(() => assertTenantSchemaName('tenant_bad-name')).toThrow();
        expect(() => assertTenantSchemaName('public')).toThrow();
    });

    it('reports every contract failure category without hiding details', () => {
        const error = tenantSchemaContractFailure({
            schemaName: 'tenant_acme',
            version: null,
            missingTables: ['attendance'],
            missingColumns: [{ table: 'profiles', column: 'face_embedding_512' }],
            missingIndexes: [{ table: 'profiles', index: 'profiles_face_embedding_hnsw_idx' }],
            missingForeignKeys: [{
                table: 'attendance',
                column: 'profile_id',
                referencedTable: 'profiles',
                referencedColumn: 'id',
            }],
            invalidVectorColumns: [{
                table: 'profiles',
                column: 'face_embedding',
                actualType: 'vector(512)',
                expectedType: 'vector(128)',
            }],
            ok: false,
        });

        expect(error.message).toContain('tables: attendance');
        expect(error.message).toContain('profiles.face_embedding_512');
        expect(error.message).toContain('profiles_face_embedding_hnsw_idx');
        expect(error.message).toContain('attendance.profile_id');
        expect(error.message).toContain('vector(512) (expected vector(128))');
    });

    it('only permits rollback for a schema created by the current invocation', () => {
        expect(shouldRollbackTenantSchema(true)).toBe(true);
        expect(shouldRollbackTenantSchema(false)).toBe(false);
    });

    it('preserves legacy photo and kiosk values during alignment', () => {
        expect(alignmentMigration).toMatch(
            /column_name = 'photo_url'[\s\S]*?UPDATE %I\.profile_photo_requests[\s\S]*?COALESCE\(pending_photo_url, photo_url\)/,
        );
        expect(alignmentMigration).toMatch(
            /column_name = 'device_name'[\s\S]*?UPDATE %I\.kiosk_devices[\s\S]*?COALESCE\(name, device_name\)/,
        );
        expect(alignmentMigration).toMatch(
            /column_name = 'last_active_at'[\s\S]*?UPDATE %I\.kiosk_devices[\s\S]*?COALESCE\(last_seen_at, last_active_at\)/,
        );
    });

    it('is versioned independently from the control-plane schema', () => {
        expect(TENANT_SCHEMA_TEMPLATE).toBe('tenant_primary');
        expect(TENANT_SCHEMA_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
    });
});
