import { GeofenceService } from '@/lib/services/geofence.service'
import { SmartCache } from '@/lib/cache/smart-cache'

jest.mock('@/lib/cache/smart-cache', () => ({
  SmartCache: {
    getOfficeLocationsCached: jest.fn(),
  },
}))

jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
  },
}))

describe('GeofenceService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('strictly disallows check-in when no office locations are configured', async () => {
    jest.mocked(SmartCache.getOfficeLocationsCached).mockResolvedValue([])

    const result = await GeofenceService.checkGeofence(19.0760, 72.8777)

    expect(result).toEqual({
      isAllowed: false,
      noLocationsConfigured: true,
      reason: expect.stringContaining('No office locations configured'),
    })
  })

  it('disallows check-in when user is outside active office geofence', async () => {
    jest.mocked(SmartCache.getOfficeLocationsCached).mockResolvedValue([
      {
        id: 'office-1',
        name: 'Headquarters',
        address: '123 Tech Park',
        latitude: '19.0760000',
        longitude: '72.8777000',
        radius_meters: 200,
        is_active: true,
        tenant_id: 'test-tenant',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: 'admin',
      },
    ] as never)

    // User is ~5km away
    const result = await GeofenceService.checkGeofence(19.1200, 72.8777)

    expect(result.isAllowed).toBe(false)
    expect(result.noLocationsConfigured).toBe(false)
    expect(result.withinOffice).toBeUndefined()
    expect(result.nearestOffice).toBeDefined()
    expect(result.nearestOffice?.name).toBe('Headquarters')
    expect(result.nearestOffice?.distance).toBeGreaterThan(200)
  })

  it('allows check-in when user is inside active office geofence', async () => {
    jest.mocked(SmartCache.getOfficeLocationsCached).mockResolvedValue([
      {
        id: 'office-1',
        name: 'Headquarters',
        address: '123 Tech Park',
        latitude: '19.0760000',
        longitude: '72.8777000',
        radius_meters: 200,
        is_active: true,
        tenant_id: 'test-tenant',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: 'admin',
      },
    ] as never)

    // User is ~10 meters away
    const result = await GeofenceService.checkGeofence(19.07605, 72.87775)

    expect(result.isAllowed).toBe(true)
    expect(result.noLocationsConfigured).toBe(false)
    expect(result.withinOffice).toBeDefined()
    expect(result.withinOffice?.name).toBe('Headquarters')
  })
})
