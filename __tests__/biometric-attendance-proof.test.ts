/** @jest-environment node */

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      profiles: {
        findFirst: jest.fn(),
      },
    },
  },
}))

jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(),
}))

jest.mock('@/lib/face-service-client', () => ({
  FaceServiceClient: {
    extract: jest.fn(),
  },
}))

jest.mock('@/lib/biometric-frame-validation', () => ({
  findFrameFailure: jest.fn(() => null),
  hasDistinctNaturalFrames: jest.fn(() => true),
  selectBestValidatedFrame: jest.fn((frames: unknown[]) => frames[0]),
}))

jest.mock('@/lib/liveness-challenge', () => ({
  LIVENESS_FRAME_COUNT: 3,
  consumeLivenessChallenge: jest.fn(),
}))

jest.mock('@/lib/services/profile.service', () => ({
  ProfileService: {
    ensurePhotoRequestsSchema: jest.fn(),
  },
}))

jest.mock('@/lib/services/biometric-verification-attempt.service', () => ({
  recordBiometricVerificationAttempt: jest.fn(),
}))

jest.mock('@/lib/tenant/with-context', () => {
  const { tenantStorage } = jest.requireActual('@/lib/tenant/store')
  return {
    runWithRequestHeaders: (callback: () => Promise<unknown>) => tenantStorage.run({
      tenantId: 'tenant-1',
      slug: 'acme',
      databaseUrl: null,
      tenantSchema: 'tenant_acme',
      brandName: 'Acme',
      trusted: true,
    }, callback),
  }
})

jest.mock('@/lib/utils/date-utils', () => ({
  getLocalDateIST: jest.fn(),
}))

import {
  consumeAttendanceProof,
  issueAttendanceProof,
} from '@/lib/biometric-attendance-proof'
import { POST as verifyFace } from '@/app/api/attendance/verify-face/route'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { FaceServiceClient } from '@/lib/face-service-client'
import { consumeLivenessChallenge } from '@/lib/liveness-challenge'
import { getLocalDateIST } from '@/lib/utils/date-utils'

describe('biometric attendance proofs', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-session-secret'
  })

  it('binds a proof to its subject, tenant, action, and date', () => {
    const proof = issueAttendanceProof({
      subject: 'employee-1',
      tenantId: 'tenant-1',
      action: 'clock_in',
      localDate: '2026-09-03',
      verificationRequestId: 'verification-1',
      embeddingPipelineVersion: 'pipeline-v1',
    })

    expect(consumeAttendanceProof(proof, {
      subject: 'employee-1',
      tenantId: 'tenant-1',
      action: 'clock_in',
      localDate: '2026-09-03',
    })).toMatchObject({
      subject: 'employee-1',
      tenantId: 'tenant-1',
      action: 'clock_in',
      localDate: '2026-09-03',
    })

    const mismatchedProof = issueAttendanceProof({
      subject: 'employee-1',
      tenantId: 'tenant-1',
      action: 'clock_in',
      localDate: '2026-09-03',
      verificationRequestId: 'verification-2',
      embeddingPipelineVersion: 'pipeline-v1',
    })
    expect(consumeAttendanceProof(mismatchedProof, {
      subject: 'employee-1',
      tenantId: 'tenant-1',
      action: 'clock_out',
      localDate: '2026-09-03',
    })).toBeNull()
  })

  it('rejects replay and expired proofs', () => {
    const proof = issueAttendanceProof({
      subject: 'employee-1',
      tenantId: 'tenant-1',
      action: 'clock_out',
      localDate: '2026-09-03',
      verificationRequestId: 'verification-3',
      embeddingPipelineVersion: 'pipeline-v1',
    })
    const expected = {
      subject: 'employee-1',
      tenantId: 'tenant-1',
      action: 'clock_out' as const,
      localDate: '2026-09-03',
    }

    expect(consumeAttendanceProof(proof, expected)).not.toBeNull()
    expect(consumeAttendanceProof(proof, expected)).toBeNull()

    jest.useFakeTimers()
    try {
      const expiringProof = issueAttendanceProof({
        subject: 'employee-1',
        tenantId: 'tenant-1',
        action: 'clock_in',
        localDate: '2026-09-03',
        verificationRequestId: 'verification-4',
        embeddingPipelineVersion: 'pipeline-v1',
      })
      jest.advanceTimersByTime(2 * 60 * 1000 + 1)
      expect(consumeAttendanceProof(expiringProof, {
        ...expected,
        action: 'clock_in',
      })).toBeNull()
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('attendance verification proof issuance', () => {
  const profileId = '11111111-1111-4111-8111-111111111111'
  const embedding = Array.from({ length: 512 }, (_, index) => index === 0 ? 1 : 0)
  const frames = [
    'data:image/jpeg;base64,Zmlyc3QtZnJhbWU=',
    'data:image/jpeg;base64,c2Vjb25kLWZyYW1l',
    'data:image/jpeg;base64,dGhpcmQtZnJhbWU=',
  ]

  const mockedProfileFindFirst = jest.mocked(db.query.profiles.findFirst)
  const mockedGetUser = jest.fn()
  const mockedExtract = jest.mocked(FaceServiceClient.extract)
  const mockedConsumeChallenge = jest.mocked(consumeLivenessChallenge)
  const mockedGetLocalDate = jest.mocked(getLocalDateIST)

  function request(action: 'clock_in' | 'clock_out' = 'clock_in') {
    return new NextRequest('http://localhost/api/attendance/verify-face', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        frames,
        challenge: 'attendance-challenge',
        biometricPipelineVersion: 'natural-portrait-v1',
        action,
      }),
    })
  }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.SESSION_SECRET = 'test-session-secret'
    mockedGetLocalDate.mockReturnValue('2026-09-03')
    mockedProfileFindFirst.mockResolvedValue({
      face_embedding_512: embedding,
      face_embedding_pipeline_version: 'pipeline-v1',
    } as never)
    mockedGetUser.mockResolvedValue({ data: { user: { id: profileId } } })
    jest.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: mockedGetUser },
    } as never)
    mockedConsumeChallenge.mockReturnValue({ ok: true } as never)
    mockedExtract.mockResolvedValue({
      success: true,
      face_detected: true,
      face_count: 1,
      embedding_512: embedding,
      embedding_pipeline_version: 'pipeline-v1',
      is_live: true,
      canonical_portrait_base64: 'data:image/jpeg;base64,Y2Fub25pY2Fs',
      canonical_portrait_aspect_ratio: '3:4',
      diagnostics: { backend_engine: 'test-engine' },
      quality_score: 0.98,
    } as never)
  })

  it('issues an action- and tenant-bound proof only after server verification succeeds', async () => {
    const response = await verifyFace(request('clock_in'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.matched).toBe(true)
    expect(typeof body.attendance_proof).toBe('string')
    expect(consumeAttendanceProof(body.attendance_proof, {
      subject: profileId,
      tenantId: 'tenant-1',
      action: 'clock_in',
      localDate: '2026-09-03',
    })).toMatchObject({
      subject: profileId,
      tenantId: 'tenant-1',
      action: 'clock_in',
      localDate: '2026-09-03',
      embeddingPipelineVersion: 'pipeline-v1',
    })
  })

  it('binds a clock-out proof to the requested action', async () => {
    const response = await verifyFace(request('clock_out'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(consumeAttendanceProof(body.attendance_proof, {
      subject: profileId,
      tenantId: 'tenant-1',
      action: 'clock_out',
      localDate: '2026-09-03',
    })).not.toBeNull()
    expect(consumeAttendanceProof(body.attendance_proof, {
      subject: profileId,
      tenantId: 'tenant-1',
      action: 'clock_in',
      localDate: '2026-09-03',
    })).toBeNull()
  })
})