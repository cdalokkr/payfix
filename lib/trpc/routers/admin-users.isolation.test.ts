const mockCreateUser = jest.fn()
const mockDeleteUser = jest.fn()
const mockUpdateUserById = jest.fn()

jest.mock('@/lib/auth/supabase-admin', () => ({
  createSupabaseAdminClient: () => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
        updateUserById: mockUpdateUserById,
      },
    },
  }),
}))

import { createCallerFactory } from '../server'
import { adminUsersRouter } from './admin-users'

const createCaller = createCallerFactory(adminUsersRouter)

const TENANT_A = '11111111-1111-4111-8111-111111111111'
const TENANT_B = '22222222-2222-4222-8222-222222222222'

function containsValue(value: unknown, expected: string, seen = new Set<object>()): boolean {
  if (value === expected) return true
  if (!value || typeof value !== 'object') return false
  if (seen.has(value as object)) return false
  seen.add(value as object)

  if (Array.isArray(value)) {
    return value.some((item) => containsValue(item, expected, seen))
  }

  return Object.values(value).some((item) => containsValue(item, expected, seen))
}

function profile(id: string, tenantId: string, email: string) {
  return {
    id,
    tenant_id: tenantId,
    email,
    full_name: email,
    status: 'active',
    role: 'employee',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    designation: null,
  }
}

function contextFor(tenantId: string, tenantProfiles: ReturnType<typeof profile>[]) {
  const findMany = jest.fn(async () => tenantProfiles)
  const findFirst = jest.fn(async () => null)
  const countWhere = jest.fn(async () => [{ value: tenantProfiles.length, count: tenantProfiles.length }])
  const insertReturning = jest.fn(async () => [{
    id: 'new-auth-id',
    tenant_id: tenantId,
    email: 'newuser@example.com',
    role: 'employee',
    status: 'active',
  }])
  const db = {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: countWhere,
      })),
    })),
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: insertReturning,
      })),
    })),
    query: {
      profiles: {
        findMany,
        findFirst,
      },
    },
  }

  return {
    db,
    user: { id: `${tenantId}-admin`, email: `admin@${tenantId}.example` },
    profile: {
      id: `${tenantId}-admin`,
      role: 'admin',
      status: 'active',
    },
    tenant: {
      tenantId,
      slug: tenantId === TENANT_A ? 'acme' : 'beta',
      databaseUrl: null,
      tenantSchema: tenantId === TENANT_A ? 'tenant_acme' : 'tenant_beta',
      brandName: tenantId,
      trusted: true,
    },
    performance: {
      contextCreationTime: 0,
      cacheHit: false,
      userFound: true,
      profileFound: true,
      totalMetrics: {},
    },
    supabase: null,
  } as any
}

describe('admin user tenant isolation', () => {
  it('keeps concurrent tenant user lists and query predicates tenant-local', async () => {
    const acmeContext = contextFor(
      TENANT_A,
      [profile('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', TENANT_A, 'employee@acme.example')],
    )
    const betaContext = contextFor(
      TENANT_B,
      [profile('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', TENANT_B, 'employee@beta.example')],
    )

    const [acmeResult, betaResult] = await Promise.all([
      createCaller(acmeContext).getUsers({
        page: 1,
        limit: 9999,
        getAll: true,
        tenantScope: TENANT_A,
      }),
      createCaller(betaContext).getUsers({
        page: 1,
        limit: 9999,
        getAll: true,
        tenantScope: TENANT_B,
      }),
    ])

    expect(acmeResult.users.map((user) => user.email)).toEqual(['employee@acme.example'])
    expect(betaResult.users.map((user) => user.email)).toEqual(['employee@beta.example'])
    expect(acmeResult.users).not.toEqual(expect.arrayContaining(betaResult.users))
    expect(betaResult.users).not.toEqual(expect.arrayContaining(acmeResult.users))

    const acmeWhere = acmeContext.db.query.profiles.findMany.mock.calls[0][0].where
    const betaWhere = betaContext.db.query.profiles.findMany.mock.calls[0][0].where
    expect(containsValue(acmeWhere, TENANT_A)).toBe(true)
    expect(containsValue(acmeWhere, TENANT_B)).toBe(false)
    expect(containsValue(betaWhere, TENANT_B)).toBe(true)
    expect(containsValue(betaWhere, TENANT_A)).toBe(false)
  })

  it('rejects a list cache scope that does not match the trusted workspace', async () => {
    const context = contextFor(TENANT_A, [])
    const caller = createCaller(context)

    await expect(caller.getUsers({
      page: 1,
      limit: 9999,
      getAll: true,
      tenantScope: TENANT_B,
    })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })

    expect(context.db.query.profiles.findMany).not.toHaveBeenCalled()
  })

  it('creates an auth user using dedicated Supabase admin client and inserts tenant profile', async () => {
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: 'auth-user-123', email: 'staff@acme.example' } },
      error: null,
    })

    const context = contextFor(TENANT_A, [])
    const caller = createCaller(context)

    const result = await caller.createUser({
      email: 'staff@acme.example',
      password: 'Password@123',
      confirmPassword: 'Password@123',
      firstName: 'Staff',
      lastName: 'Member',
      mobileNo: '9876543210',
      dateOfBirth: '1995-01-01',
      role: 'employee',
      designationId: '33333333-3333-4333-8333-333333333333',
      sex: 'male',
    })

    expect(mockCreateUser).toHaveBeenCalledWith({
      email: 'staff@acme.example',
      password: 'Password@123',
      email_confirm: true,
      user_metadata: {
        full_name: 'Staff Member',
        status: 'active',
      },
    })
    expect(result).toBeDefined()
    expect(context.db.insert).toHaveBeenCalled()
  })

  it('translates auth already-registered error to CONFLICT TRPCError', async () => {
    mockCreateUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'A user with this email address has already been registered', status: 422 },
    })

    const context = contextFor(TENANT_A, [])
    const caller = createCaller(context)

    await expect(caller.createUser({
      email: 'existing@acme.example',
      password: 'Password@123',
      confirmPassword: 'Password@123',
      firstName: 'Existing',
      lastName: 'Member',
      mobileNo: '9876543210',
      dateOfBirth: '1995-01-01',
      role: 'employee',
      designationId: '33333333-3333-4333-8333-333333333333',
      sex: 'male',
    })).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'A user with email existing@acme.example already exists',
    })
  })

  it('rolls back created auth user if profile creation fails', async () => {
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: 'rollback-user-id', email: 'fail@acme.example' } },
      error: null,
    })
    mockDeleteUser.mockResolvedValueOnce({ data: {}, error: null })

    const context = contextFor(TENANT_A, [])
    // Make profile insert fail
    context.db.insert = jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn(async () => {
          throw new Error('Database connection failed during insert')
        }),
      })),
    }))
    const caller = createCaller(context)

    await expect(caller.createUser({
      email: 'fail@acme.example',
      password: 'Password@123',
      confirmPassword: 'Password@123',
      firstName: 'Fail',
      lastName: 'Insert',
      mobileNo: '9876543210',
      dateOfBirth: '1995-01-01',
      role: 'employee',
      designationId: '33333333-3333-4333-8333-333333333333',
      sex: 'male',
    })).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create user profile: Database connection failed during insert',
    })

    expect(mockDeleteUser).toHaveBeenCalledWith('rollback-user-id')
  })
})