import {
    main,
    runTenantProfileBackfill,
} from '../scripts/assign-tenant-ids-to-schemas';

type Profile = {
    id: string;
    email: string;
    tenant_id: string | null;
};

const expectedTenant = {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'acme-team',
    company_name: 'Acme Team',
    tenant_schema: 'tenant_acme_team',
    database_url: null,
};
const conflictingTenantId = '22222222-2222-4222-8222-222222222222';

jest.mock('../lib/db/index', () => ({ centralDb: { execute: jest.fn() } }));
jest.mock('../lib/db/master-connection', () => ({
    masterDb: {
        query: {
            tenants: {
                findMany: jest.fn(),
            },
        },
        insert: jest.fn(() => ({
            values: jest.fn().mockResolvedValue([]),
        })),
    },
}));

const mockCentralDb = jest.requireMock('../lib/db/index').centralDb as {
    execute: jest.Mock;
};
const mockMasterDb = jest.requireMock('../lib/db/master-connection').masterDb as {
    query: {
        tenants: {
            findMany: jest.Mock;
        };
    };
    insert: jest.Mock;
};

function queryText(query: unknown): string {
    const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];

    return chunks.map((chunk) => {
        if (typeof chunk === 'string') {
            return chunk;
        }
        if (typeof chunk === 'object' && chunk !== null && 'value' in chunk) {
            const value = (chunk as { value: unknown }).value;
            return Array.isArray(value) ? value.join('') : String(value);
        }
        if (typeof chunk === 'object' && chunk !== null && 'queryChunks' in chunk) {
            return queryText(chunk);
        }
        return '?';
    }).join('');
}

function createProfiles(): Profile[] {
    return [
        {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            email: 'missing@example.com',
            tenant_id: null,
        },
        {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            email: 'owned@example.com',
            tenant_id: expectedTenant.id,
        },
        {
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            email: 'conflict@example.com',
            tenant_id: conflictingTenantId,
        },
    ];
}

function profileCounts(profiles: Profile[]) {
    return [{
        total: profiles.length,
        matching: profiles.filter((profile) => profile.tenant_id === expectedTenant.id).length,
        missing: profiles.filter((profile) => profile.tenant_id === null).length,
        conflicting: profiles.filter(
            (profile) => profile.tenant_id !== null && profile.tenant_id !== expectedTenant.id,
        ).length,
    }];
}

function affectedRowsResult(count: number): unknown[] & { count: number } {
    const result = [] as unknown[] & { count: number };
    result.count = count;
    return result;
}

function createMockTenantDatabase(profiles: Profile[], beforeUpdate?: () => void) {
    const execute = jest.fn(async (query: unknown) => {
        const text = queryText(query);

        if (text.includes('information_schema.schemata')) {
            return [{ exists: true }];
        }
        if (text.includes('information_schema.tables')) {
            return [{ exists: true }];
        }
        if (text.includes('information_schema.columns')) {
            return [{ data_type: 'uuid', udt_name: 'uuid' }];
        }
        if (text.includes('UPDATE')) {
            beforeUpdate?.();
            const missingProfiles = profiles.filter((profile) => profile.tenant_id === null);
            missingProfiles.forEach((profile) => {
                profile.tenant_id = expectedTenant.id;
            });
            return affectedRowsResult(missingProfiles.length);
        }
        if (text.includes('SELECT id::text AS profile_id')) {
            return profiles
                .filter((profile) => profile.tenant_id !== null && profile.tenant_id !== expectedTenant.id)
                .map((profile) => ({
                    profile_id: profile.id,
                    email: profile.email,
                    current_tenant_id: profile.tenant_id,
                }));
        }
        if (text.includes('COUNT(*)')) {
            return profileCounts(profiles);
        }

        throw new Error(`Unexpected query in tenant backfill test: ${text}`);
    });

    return { execute };
}

function configureMockTenantDatabase(profiles: Profile[], beforeUpdate?: () => void) {
    const database = createMockTenantDatabase(profiles, beforeUpdate);
    mockMasterDb.query.tenants.findMany.mockResolvedValue([expectedTenant]);
    mockCentralDb.execute = database.execute;
    return database;
}

describe('tenant profile ownership backfill', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('reports missing and conflicting ownership during a dry-run without writing profiles', async () => {
        const profiles = createProfiles();
        const before = profiles.map((profile) => ({ ...profile }));
        configureMockTenantDatabase(profiles);

        const report = await runTenantProfileBackfill({
            tenantSlug: expectedTenant.slug,
        });

        expect(report).toMatchObject({
            mode: 'dry-run',
            tenantCount: 1,
            verified: false,
        });
        expect(report.tenants[0]).toMatchObject({
            status: 'conflicts',
            totalProfiles: 3,
            matchingProfiles: 1,
            missingTenantId: 1,
            conflictingProfiles: 1,
            updatedProfiles: 0,
        });
        expect(report.tenants[0].conflicts).toEqual([{
            profileId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            email: 'conflict@example.com',
            currentTenantId: conflictingTenantId,
            expectedTenantId: expectedTenant.id,
        }]);
        expect(profiles).toEqual(before);
        expect(mockCentralDb.execute.mock.calls.some(([query]) => queryText(query).includes('UPDATE')))
            .toBe(false);
        expect(mockMasterDb.insert).not.toHaveBeenCalled();
    });

    it('fills only NULL ownership, preserves conflicts, and exits non-zero', async () => {
        const profiles = createProfiles();
        const database = configureMockTenantDatabase(profiles);
        let exitCode: number | undefined;
        const exit = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
            exitCode = code;
            throw new Error('process exited');
        }) as never);

        await expect(main(['--apply', '--tenant', expectedTenant.slug])).rejects.toThrow('process exited');

        expect(exitCode).toBe(1);
        expect(profiles).toEqual([
            {
                id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                email: 'missing@example.com',
                tenant_id: expectedTenant.id,
            },
            {
                id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                email: 'owned@example.com',
                tenant_id: expectedTenant.id,
            },
            {
                id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
                email: 'conflict@example.com',
                tenant_id: conflictingTenantId,
            },
        ]);
        expect(database.execute.mock.calls.some(([query]) => queryText(query).includes('UPDATE')))
            .toBe(true);
        expect(mockMasterDb.insert).toHaveBeenCalledTimes(1);
        const auditValues = mockMasterDb.insert.mock.results[0].value.values.mock.calls[0][0];
        expect(auditValues).toEqual([expect.objectContaining({
            tenant_id: expectedTenant.id,
            tenant_schema: expectedTenant.tenant_schema,
            mode: 'apply',
            status: 'partial',
            total_profiles: 3,
            matching_profiles: 2,
            missing_tenant_id: 0,
            conflicting_profiles: 1,
            updated_profiles: 1,
            unresolved_conflict_count: 1,
        })]);
        expect(JSON.stringify(auditValues)).not.toContain('email');
        expect(JSON.stringify(auditValues)).not.toContain('database_url');

        const report = await runTenantProfileBackfill({
            apply: true,
            tenantSlug: expectedTenant.slug,
        });
        expect(report.verified).toBe(false);
        expect(report.tenants[0]).toMatchObject({
            status: 'conflicts',
            missingTenantId: 0,
            conflictingProfiles: 1,
            updatedProfiles: 0,
        });

        exit.mockRestore();
    });

    it('reports the affected rows in both the apply report and audit record', async () => {
        const profiles = createProfiles().filter((profile) => profile.tenant_id === null);
        configureMockTenantDatabase(profiles);

        const report = await runTenantProfileBackfill({
            apply: true,
            tenantSlug: expectedTenant.slug,
        });

        expect(profiles).toEqual([{
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            email: 'missing@example.com',
            tenant_id: expectedTenant.id,
        }]);
        expect(report).toMatchObject({
            mode: 'apply',
            tenantCount: 1,
            verified: true,
        });
        expect(report.tenants[0]).toMatchObject({
            status: 'updated',
            totalProfiles: 1,
            matchingProfiles: 1,
            missingTenantId: 0,
            conflictingProfiles: 0,
            updatedProfiles: 1,
        });

        expect(mockMasterDb.insert).toHaveBeenCalledTimes(1);
        const auditValues = mockMasterDb.insert.mock.results[0].value.values.mock.calls[0][0];
        expect(auditValues).toEqual([expect.objectContaining({
            tenant_id: expectedTenant.id,
            tenant_schema: expectedTenant.tenant_schema,
            mode: 'apply',
            status: 'verified',
            total_profiles: 1,
            matching_profiles: 1,
            missing_tenant_id: 0,
            conflicting_profiles: 0,
            updated_profiles: 1,
            unresolved_conflict_count: 0,
        })]);
    });

    it('preserves and reports a conflict introduced after the initial scan', async () => {
        const profiles = createProfiles();
        let concurrentUpdateApplied = false;
        const database = configureMockTenantDatabase(profiles, () => {
            concurrentUpdateApplied = true;
            const profile = profiles.find((candidate) => candidate.tenant_id === null);
            if (!profile) {
                throw new Error('Expected a NULL profile for the concurrent update');
            }
            profile.tenant_id = conflictingTenantId;
        });
        let exitCode: number | undefined;
        const exit = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
            exitCode = code;
            throw new Error('process exited');
        }) as never);

        await expect(main(['--apply', '--tenant', expectedTenant.slug])).rejects.toThrow('process exited');

        expect(concurrentUpdateApplied).toBe(true);
        expect(exitCode).toBe(1);
        expect(database.execute.mock.calls.some(([query]) => {
            const text = queryText(query);
            return text.includes('UPDATE') && text.includes('WHERE tenant_id IS NULL');
        })).toBe(true);
        expect(profiles.find((profile) => profile.email === 'missing@example.com')?.tenant_id)
            .toBe(conflictingTenantId);
        expect(profiles).toEqual([
            {
                id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                email: 'missing@example.com',
                tenant_id: conflictingTenantId,
            },
            {
                id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                email: 'owned@example.com',
                tenant_id: expectedTenant.id,
            },
            {
                id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
                email: 'conflict@example.com',
                tenant_id: conflictingTenantId,
            },
        ]);

        const report = await runTenantProfileBackfill({
            apply: true,
            tenantSlug: expectedTenant.slug,
        });
        expect(report.verified).toBe(false);
        expect(report.tenants[0]).toMatchObject({
            status: 'conflicts',
            missingTenantId: 0,
            conflictingProfiles: 2,
            updatedProfiles: 0,
        });
        expect(report.tenants[0].conflicts).toEqual([
            {
                profileId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                email: 'missing@example.com',
                currentTenantId: conflictingTenantId,
                expectedTenantId: expectedTenant.id,
            },
            {
                profileId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
                email: 'conflict@example.com',
                currentTenantId: conflictingTenantId,
                expectedTenantId: expectedTenant.id,
            },
        ]);

        exit.mockRestore();
    });
});
