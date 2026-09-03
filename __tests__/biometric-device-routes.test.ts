/** @jest-environment node */

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      biometricDevices: {
        findFirst: jest.fn(),
      },
      employeeSettings: {
        findFirst: jest.fn(),
      },
      attendanceSessions: {
        findFirst: jest.fn(),
      },
    },
    update: jest.fn(),
    insert: jest.fn(),
  },
}))

jest.mock('@/lib/db/master-connection', () => ({
  masterDb: {
    query: {
      tenants: {
        findFirst: jest.fn(),
      },
    },
  },
}))

jest.mock('@/lib/services/attendance.service', () => ({
  AttendanceService: {
    clockIn: jest.fn(),
    clockOut: jest.fn(),
  },
}))

import { NextRequest } from 'next/server'
import { POST as syncBiometric } from '@/app/api/biometric/sync/route'
import { GET as iclockHandshake, POST as iclockPunch } from '@/app/api/biometric/iclock/route'
import { db } from '@/lib/db'
import { masterDb } from '@/lib/db/master-connection'
import { AttendanceService } from '@/lib/services/attendance.service'

const tenant = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'acme',
  database_url: null,
  tenant_schema: 'tenant_acme',
  company_name: 'Acme',
  biometric_api_key: 'tenant-device-secret',
  status: 'active',
  plan: null,
}

const registeredDevice = {
  id: 'device-1',
  serial_number: 'device-serial-1',
  location_id: null,
}

const profileId = '22222222-2222-4222-8222-222222222222'

const mockedTenantFindFirst = jest.mocked(masterDb.query.tenants.findFirst)
const mockedDeviceFindFirst = jest.mocked(db.query.biometricDevices.findFirst)
const mockedSettingsFindFirst = jest.mocked(db.query.employeeSettings.findFirst)
const mockedActiveSessionFindFirst = jest.mocked(db.query.attendanceSessions.findFirst)
const mockedAttendanceClockIn = jest.mocked(AttendanceService.clockIn)
const insertedValues: unknown[] = []

function configureRegisteredDevice() {
  mockedTenantFindFirst.mockResolvedValue(tenant as never)
  mockedDeviceFindFirst.mockResolvedValue(registeredDevice as never)
  mockedSettingsFindFirst.mockResolvedValue({ profile_id: profileId } as never)
  mockedActiveSessionFindFirst.mockResolvedValue(null)
  mockedAttendanceClockIn.mockResolvedValue({ id: 'attendance-1' } as never)
}

function configureDbWrites() {
  jest.mocked(db.update).mockImplementation(() => ({
    set: jest.fn(() => ({
      where: jest.fn().mockResolvedValue([]),
    })),
  } as never))
  jest.mocked(db.insert).mockImplementation(() => ({
    values: jest.fn((values: unknown) => {
      insertedValues.push(values)
      return Promise.resolve([])
    }),
  } as never))
}

function bearerRequest(url: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(url, {
    ...init,
    headers: {
      authorization: 'Bearer tenant-device-secret',
      ...(init.headers || {}),
    },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  insertedValues.length = 0
  configureDbWrites()
})

describe('biometric sync device boundaries', () => {
  it('rejects a sync from an unregistered device before processing logs', async () => {
    mockedTenantFindFirst.mockResolvedValue(tenant as never)
    mockedDeviceFindFirst.mockResolvedValue(null)

    const response = await syncBiometric(bearerRequest('http://localhost/api/biometric/sync', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: 'unknown-device',
        logs: [{ userId: '101', timestamp: '2026-09-03 00:15:00', punchType: 0 }],
      }),
    }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Unregistered device for workspace.',
    })
    expect(mockedSettingsFindFirst).not.toHaveBeenCalled()
    expect(mockedAttendanceClockIn).not.toHaveBeenCalled()
  })

  it('keeps a post-midnight device punch on the correct IST business date', async () => {
    configureRegisteredDevice()

    const response = await syncBiometric(bearerRequest('http://localhost/api/biometric/sync', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: registeredDevice.serial_number,
        // 00:15 on Sep 3 in IST is Sep 2 in UTC.
        logs: [{ userId: '101', timestamp: '2026-09-03 00:15:00', punchType: 0 }],
      }),
    }))

    expect(response.status).toBe(200)
    expect(mockedAttendanceClockIn).toHaveBeenCalledWith(expect.objectContaining({
      profileId,
      localDate: '2026-09-03',
      source: 'biometric',
      deviceId: registeredDevice.serial_number,
    }))
    expect(insertedValues[0]).toEqual(expect.objectContaining({
      biometric_user_id: '101',
      device_id: registeredDevice.serial_number,
      punch_time: new Date('2026-09-02T18:45:00.000Z'),
    }))
    expect(mockedAttendanceClockIn).toHaveBeenCalledTimes(1)
  })
})

describe('iclock device boundaries', () => {
  it('rejects an unregistered device during the protocol handshake', async () => {
    mockedTenantFindFirst.mockResolvedValue(tenant as never)
    mockedDeviceFindFirst.mockResolvedValue(null)

    const response = await iclockHandshake(bearerRequest(
      'http://localhost/api/biometric/iclock?SN=unknown-device',
    ))

    expect(response.status).toBe(403)
    await expect(response.text()).resolves.toBe('Forbidden')
  })

  it('accepts a registered punch and preserves its IST business date', async () => {
    configureRegisteredDevice()

    const response = await iclockPunch(bearerRequest(
      `http://localhost/api/biometric/iclock?SN=${registeredDevice.serial_number}`,
      {
        method: 'POST',
        // The iclock protocol uses tab-separated rows.
        body: `101\t2026-09-03 00:15:00\t0\t0\n`,
      },
    ))

    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe('OK')
    expect(mockedAttendanceClockIn).toHaveBeenCalledWith(expect.objectContaining({
      profileId,
      localDate: '2026-09-03',
      source: 'biometric',
      deviceId: registeredDevice.serial_number,
    }))
    expect(insertedValues[0]).toEqual(expect.objectContaining({
      biometric_user_id: '101',
      device_id: registeredDevice.serial_number,
      punch_time: new Date('2026-09-02T18:45:00.000Z'),
    }))
  })
})