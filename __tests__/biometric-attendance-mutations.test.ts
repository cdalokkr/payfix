/** @jest-environment node */

jest.mock('@/lib/db', () => ({
  db: {
    execute: jest.fn(),
    transaction: jest.fn(),
  },
}))

jest.mock('@/lib/cache/smart-cache', () => ({
  SmartCache: {
    getOfficeSettingsCached: jest.fn(),
    getOfficeClosuresCached: jest.fn(),
    getOfficeLocationsCached: jest.fn(),
  },
}))

import { AttendanceService } from '@/lib/services/attendance.service'
import { issueAttendanceProof } from '@/lib/biometric-attendance-proof'
import { runWithTenant } from '@/lib/tenant/with-context'
import { db } from '@/lib/db'
import { SmartCache } from '@/lib/cache/smart-cache'

describe('proof-gated attendance mutations', () => {
  const profileId = '11111111-1111-4111-8111-111111111111'
  const tenantId = 'tenant-1'
  const localDate = '2026-09-03'
  const tenant = {
    tenantId,
    slug: 'acme',
    databaseUrl: null,
    tenantSchema: 'tenant_acme',
    brandName: 'Acme',
    trusted: true,
  }

  const mockedTransaction = jest.mocked(db.transaction)

  function proof(action: 'clock_in' | 'clock_out' = 'clock_in', date = localDate, subject = profileId, tenantForProof = tenantId) {
    return issueAttendanceProof({
      subject,
      tenantId: tenantForProof,
      action,
      localDate: date,
      verificationRequestId: `verification-${action}`,
      embeddingPipelineVersion: 'pipeline-v1',
    })
  }

  function configureSuccessfulClockIn() {
    const attendanceRecord = {
      id: 'attendance-1',
      profile_id: profileId,
      date: localDate,
      current_session_status: 'checked_in',
    }
    const insert = jest.fn().mockImplementation(() => {
      if (insert.mock.calls.length === 1) {
        return {
          values: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([attendanceRecord]),
          })),
        }
      }
      return { values: jest.fn().mockResolvedValue([]) }
    })
    const tx = {
      query: {
        attendanceSessions: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        attendance: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      },
      insert,
      update: jest.fn(),
    }
    mockedTransaction.mockImplementation(async (callback) => callback(tx as never))
    return { attendanceRecord, insert }
  }

  async function clockIn(attendanceProof: string | undefined, date = localDate, coords?: { lat: number; lng: number }) {
    return runWithTenant(tenant, () => AttendanceService.clockIn({
      profileId,
      email: 'employee@example.com',
      localDate: date,
      latitude: coords?.lat,
      longitude: coords?.lng,
      verificationProof: attendanceProof,
    }))
  }

  async function clockOut(attendanceProof: string | undefined, date = localDate, coords?: { lat: number; lng: number }) {
    return runWithTenant(tenant, () => AttendanceService.clockOut({
      profileId,
      email: 'employee@example.com',
      localDate: date,
      latitude: coords?.lat,
      longitude: coords?.lng,
      verificationProof: attendanceProof,
    }))
  }

  function configureSuccessfulClockOut() {
    const attendanceRecord = {
      id: 'attendance-1',
      profile_id: profileId,
      date: localDate,
      current_session_status: 'checked_out',
    }
    const activeSession = {
      id: 'session-1',
      attendance_id: 'attendance-1',
      profile_id: profileId,
      date: localDate,
      check_in: new Date('2026-09-03T09:00:00.000Z'),
      status: 'active',
    }
    const tx = {
      query: {
        attendanceSessions: {
          findFirst: jest.fn().mockResolvedValue(activeSession),
          findMany: jest.fn().mockResolvedValue([{ ...activeSession, working_hours: '8.00', status: 'completed' }]),
        },
        attendance: {
          findFirst: jest.fn().mockResolvedValue(attendanceRecord),
        },
      },
      insert: jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue([]) }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([attendanceRecord]),
          }),
        }),
      }),
    }
    mockedTransaction.mockImplementation(async (callback) => callback(tx as never))
    return { attendanceRecord, tx }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.SESSION_SECRET = 'test-session-secret'
    jest.mocked(SmartCache.getOfficeSettingsCached).mockResolvedValue({ off_days: [] } as never)
    jest.mocked(SmartCache.getOfficeClosuresCached).mockResolvedValue([] as never)
    jest.mocked(SmartCache.getOfficeLocationsCached).mockResolvedValue([] as never)
  })

  it('accepts a fresh proof and passes the mutation through to attendance storage', async () => {
    const { attendanceRecord, insert } = configureSuccessfulClockIn()

    await expect(clockIn(proof())).resolves.toEqual(attendanceRecord)

    expect(insert).toHaveBeenCalled()
    expect(mockedTransaction).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['missing', undefined, localDate],
    ['wrong tenant', proof('clock_in', localDate, profileId, 'tenant-2'), localDate],
    ['wrong action', proof('clock_out'), localDate],
    ['wrong business date', proof('clock_in', '2026-09-04'), localDate],
  ])('rejects a %s proof before writing attendance', async (_name, attendanceProof, date) => {
    await expect(clockIn(attendanceProof, date)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })

    expect(mockedTransaction).not.toHaveBeenCalled()
  })

  it('rejects an expired proof through the clock-in mutation', async () => {
    jest.useFakeTimers()
    try {
      const issuedAt = new Date('2026-09-03T10:00:00.000Z')
      jest.setSystemTime(issuedAt)
      const attendanceProof = proof()
      jest.advanceTimersByTime(2 * 60 * 1000 + 1)

      await expect(clockIn(attendanceProof)).rejects.toMatchObject({ code: 'FORBIDDEN' })
      expect(mockedTransaction).not.toHaveBeenCalled()
    } finally {
      jest.useRealTimers()
    }
  })

  it('rejects replay through the mutation path after the first write consumes the proof', async () => {
    configureSuccessfulClockIn()
    const attendanceProof = proof()

    await expect(clockIn(attendanceProof)).resolves.toBeDefined()
    await expect(clockIn(attendanceProof)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(mockedTransaction).toHaveBeenCalledTimes(1)
  })

  it('requires a clock-out proof bound to clock_out', async () => {
    await expect(clockOut(proof('clock_in'))).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(mockedTransaction).not.toHaveBeenCalled()
  })

  describe('geofence validation for mobile punches', () => {
    const mockOffice = {
      id: 'office-1',
      name: 'Main HQ',
      latitude: '19.0760000',
      longitude: '72.8777000',
      radius_meters: 200,
      is_active: true,
    }

    beforeEach(() => {
      jest.mocked(SmartCache.getOfficeLocationsCached).mockResolvedValue([mockOffice] as never)
    })

    it('rejects mobile clock-in when coordinates are missing and office locations exist', async () => {
      await expect(clockIn(proof())).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: expect.stringContaining('Location access is required to clock in.'),
      })
      expect(mockedTransaction).not.toHaveBeenCalled()
    })

    it('rejects mobile clock-in when coordinates are outside office perimeter', async () => {
      // Coordinates ~5km away from Main HQ
      await expect(clockIn(proof(), localDate, { lat: 19.1200, lng: 72.8777 })).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: expect.stringContaining('You are outside the allowed office location range.'),
      })
      expect(mockedTransaction).not.toHaveBeenCalled()
    })

    it('accepts mobile clock-in when coordinates are inside office perimeter', async () => {
      const { attendanceRecord } = configureSuccessfulClockIn()
      // Coordinates ~10 meters from Main HQ
      await expect(clockIn(proof(), localDate, { lat: 19.07605, lng: 72.87775 })).resolves.toEqual(attendanceRecord)
      expect(mockedTransaction).toHaveBeenCalledTimes(1)
    })

    it('rejects mobile clock-out when coordinates are missing and office locations exist', async () => {
      await expect(clockOut(proof('clock_out'))).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: expect.stringContaining('Location access is required to clock out.'),
      })
      expect(mockedTransaction).not.toHaveBeenCalled()
    })

    it('rejects mobile clock-out when coordinates are outside office perimeter', async () => {
      // Coordinates ~10km away from Main HQ
      await expect(clockOut(proof('clock_out'), localDate, { lat: 19.1500, lng: 72.8777 })).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: expect.stringContaining('You are outside the allowed office location range.'),
      })
      expect(mockedTransaction).not.toHaveBeenCalled()
    })

    it('accepts mobile clock-out when coordinates are inside office perimeter', async () => {
      const { attendanceRecord } = configureSuccessfulClockOut()
      // Coordinates ~10 meters from Main HQ
      await expect(clockOut(proof('clock_out'), localDate, { lat: 19.07605, lng: 72.87775 })).resolves.toEqual(attendanceRecord)
      expect(mockedTransaction).toHaveBeenCalledTimes(1)
    })
  })
})