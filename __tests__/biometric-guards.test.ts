/** @jest-environment node */

jest.mock('@/lib/db', () => ({
  db: {},
}))

jest.mock('@/lib/auth/optimized-context', () => ({
  invalidateUserSession: jest.fn(),
}))

jest.mock('@/lib/trpc/routers/admin-dashboard-optimized', () => ({
  invalidateDashboardCache: jest.fn(),
}))

jest.mock('@/lib/services/profile.service', () => ({
  ProfileService: {},
}))

import { NextRequest } from 'next/server'
import { createCallerFactory } from '@/lib/trpc/server'
import { profileRouter } from '@/lib/trpc/routers/profile'
import { POST as legacyAttendanceCheck } from '@/app/api/attendance/check/route'

describe('biometric mutation and compatibility guards', () => {
  const caller = createCallerFactory(profileRouter)({
    user: { id: '11111111-1111-4111-8111-111111111111' },
    profile: {
      id: '11111111-1111-4111-8111-111111111111',
      role: 'employee',
      status: 'active',
    },
    tenant: {
      tenantId: 'tenant-1',
      slug: 'acme',
      databaseUrl: null,
      tenantSchema: 'tenant_acme',
      brandName: 'Acme',
      trusted: true,
    },
    db: {},
    supabase: null,
    performance: { contextCreationTime: 0 },
  } as never)

  it('rejects direct browser template mutation', async () => {
    await expect(caller.saveFaceEmbedding({
      embedding: Array.from({ length: 512 }, () => 0),
    })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Biometric templates can only be created by the approved enrollment workflow.',
    })
  })

  it('rejects direct profile photo mutation', async () => {
    await expect(caller.updateProfilePicture({
      userId: '11111111-1111-4111-8111-111111111111',
      avatarUrl: 'https://example.com/photo.jpg',
    })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Profile photos must be submitted through the approval workflow.',
    })
  })

  it('returns the explicit retirement response for the legacy attendance route', async () => {
    const response = await legacyAttendanceCheck(new NextRequest('http://localhost/api/attendance/check', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: 'spoofed-tenant',
        embedding: Array.from({ length: 512 }, () => 0),
      }),
    }))

    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: 'LEGACY_ATTENDANCE_ROUTE_RETIRED',
      message: 'This attendance endpoint has been retired. Use authenticated biometric verification.',
    })
  })
})