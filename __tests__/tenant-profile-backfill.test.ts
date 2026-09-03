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

function createMockTenantDatabase(profiles: Profile[]) {
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
            const missingProfiles = profiles.filter((profile) => profile.tenant_id === null);
            missingProfiles.forEach((profile) => {
                profile.tenant_id = expectedTenant.id;
            });
            return [{ count: missingProfiles.length }];
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

function configureMockTenantDatabase(profiles: Profile[]) {
    const database = createMockTenantDatabase(profiles);
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
});