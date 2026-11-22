import { createCallerFactory } from '../server';
import { organizationRouter } from './organization';
import { TRPCError } from '@trpc/server';

const createCaller = createCallerFactory(organizationRouter);

const TEST_TENANT_ID = '11111111-1111-4111-8111-111111111111';

// Mock masterDb
const mockBrandingRecord: any = {
  tenant_id: TEST_TENANT_ID,
  app_name: 'Acme Test',
  short_name: 'Acme',
  tagline: 'Building the best',
  logo_url: 'https://example.com/logo.png',
  primary_color: '#4f46e5',
  secondary_color: '#0f172a',
  accent_color: '#f59e0b',
  company_legal_name: 'Acme Technologies Ltd',
  company_address: '123 Tech Park',
  city: 'Bangalore',
  state: 'Karnataka',
  pincode: '560001',
  country: 'India',
  contact_email: 'hr@acme.com',
  contact_phone: '+91 99999 88888',
  website: 'https://acme.com',
  tax_id: '29ABCDE1234F1Z5',
  report_logo_height: 25,
  report_logo_alignment: 'left',
  payslip_notes: 'Computer generated payslip',
};

jest.mock('@/lib/db/master-connection', () => ({
  masterDb: {
    query: {
      tenants: {
        findFirst: jest.fn().mockImplementation(() => Promise.resolve({
          id: TEST_TENANT_ID,
          slug: 'acme',
          company_name: 'Acme Corporation',
          admin_email: 'admin@acme.com',
        })),
      },
      tenantBranding: {
        findFirst: jest.fn().mockImplementation(() => Promise.resolve(mockBrandingRecord)),
      },
    },
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(true),
      }),
    }),
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockResolvedValue(true),
    }),
  },
}));

jest.mock('@/lib/utils/tenant-logo-upload', () => ({
  deleteTenantLogo: jest.fn().mockResolvedValue(undefined),
  validateLogoFile: jest.fn().mockReturnValue({ valid: true }),
}));

describe('Organization Router (Branding & Logo Management)', () => {
  const makeCtx = (role: 'admin' | 'moderator' | 'employee' | 'super_admin') => ({
    user: { id: 'user-1' } as any,
    profile: { id: 'prof-1', role, full_name: 'Test User', email: 'test@example.com' } as any,
    tenant: {
      tenantId: TEST_TENANT_ID,
      slug: 'acme',
      trusted: true,
      brandName: 'Acme',
      databaseUrl: null,
      tenantSchema: 'tenant_acme',
    },
    db: {} as any,
    centralDb: {} as any,
    req: { headers: new Map() } as any,
    supabase: null as any,
    performance: { startTime: Date.now(), queries: [] } as any,
  } as any);

  it('allows tenant admin to get branding details', async () => {
    const caller = createCaller(makeCtx('admin'));
    const result = await caller.getBranding();

    expect(result).toBeDefined();
    expect(result?.companyName).toBe('Acme Corporation');
    expect(result?.branding?.logoUrl).toBe('https://example.com/logo.png');
    expect(result?.branding?.taxId).toBe('29ABCDE1234F1Z5');
  });

  it('allows tenant moderator to get branding details', async () => {
    const caller = createCaller(makeCtx('moderator'));
    const result = await caller.getBranding();

    expect(result).toBeDefined();
    expect(result?.companyName).toBe('Acme Corporation');
  });

  it('allows tenant admin to update logo', async () => {
    const caller = createCaller(makeCtx('admin'));
    const updateRes = await caller.updateLogo({
      logoUrl: 'https://example.com/new-logo.png',
    });

    expect(updateRes.success).toBe(true);
    expect(updateRes.logoUrl).toBe('https://example.com/new-logo.png');
  });

  it('allows tenant moderator to update logo', async () => {
    const caller = createCaller(makeCtx('moderator'));
    const updateRes = await caller.updateLogo({
      logoUrl: 'https://example.com/moderator-logo.png',
    });

    expect(updateRes.success).toBe(true);
    expect(updateRes.logoUrl).toBe('https://example.com/moderator-logo.png');
  });

  it('allows moderator and admin to delete logo', async () => {
    const caller = createCaller(makeCtx('moderator'));
    const deleteRes = await caller.deleteLogo();

    expect(deleteRes.success).toBe(true);
  });

  it('allows admin and moderator to update business details & report settings', async () => {
    const caller = createCaller(makeCtx('moderator'));
    const updateRes = await caller.updateBusinessDetails({
      appName: 'Acme Enterprise',
      companyLegalName: 'Acme Enterprise Pvt Ltd',
      taxId: 'GSTIN99999999',
      reportLogoHeight: 30,
      reportLogoAlignment: 'center',
    });

    expect(updateRes.success).toBe(true);
  });

  it('blocks regular employee from updating logo or business details', async () => {
    const caller = createCaller(makeCtx('employee'));

    await expect(
      caller.updateLogo({ logoUrl: 'https://hacker.com/logo.png' })
    ).rejects.toThrow(TRPCError);

    await expect(
      caller.updateBusinessDetails({ appName: 'Hacked' })
    ).rejects.toThrow(TRPCError);

    await expect(caller.deleteLogo()).rejects.toThrow(TRPCError);
  });
});
