/**
 * Geofence Service
 * Handles location verification using Haversine formula
 */

import { db } from '@/lib/db'
import { officeLocations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { SmartCache } from '@/lib/cache/smart-cache'

// Haversine formula to calculate distance between two coordinates
function haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371000 // Earth's radius in meters
    const dLat = toRadians(lat2 - lat1)
    const dLon = toRadians(lon2 - lon1)
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c // Distance in meters
}

function toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
}

export interface OfficeLocation {
    id: string
    name: string
    address?: string | null
    latitude: number
    longitude: number
    radiusMeters: number
    isActive: boolean
    checkInTime?: string | null
    checkOutTime?: string | null
    bufferMinutes?: number | null
    offDays?: number[] | null
    dailyWorkingHours?: Record<string, { checkIn: string, checkOut: string }> | null
    absentDeductionMultiplier?: number | null
}

export interface GeofenceResult {
    isAllowed: boolean
    noLocationsConfigured?: boolean
    reason?: string
    nearestOffice?: {
        id: string
        name: string
        distance: number
    }
    withinOffice?: {
        id: string
        name: string
        distance: number
    }
}

export const GeofenceService = {
    /**
     * Get all active office locations
     */
    async getActiveLocations(): Promise<OfficeLocation[]> {
        const locations = await SmartCache.getOfficeLocationsCached()

        return locations.map((loc) => ({
            id: loc.id,
            name: loc.name,
            address: loc.address,
            latitude: Number(loc.latitude),
            longitude: Number(loc.longitude),
            radiusMeters: loc.radius_meters,
            isActive: loc.is_active ?? true,
            checkInTime: (loc as any).check_in_time ?? '10:00:00',
            checkOutTime: (loc as any).check_out_time ?? '19:00:00',
            bufferMinutes: (loc as any).buffer_minutes ?? 15,
            offDays: (loc as any).off_days ?? [0],
            dailyWorkingHours: (loc as any).daily_working_hours ?? {},
            absentDeductionMultiplier: (loc as any).absent_deduction_multiplier ?? null,
        }))
    },

    /**
     * Get all office locations (admin)
     */
    async getAllLocations(): Promise<OfficeLocation[]> {
        const locations = await db.select().from(officeLocations)

        return locations.map((loc) => ({
            id: loc.id,
            name: loc.name,
            address: loc.address,
            latitude: Number(loc.latitude),
            longitude: Number(loc.longitude),
            radiusMeters: loc.radius_meters,
            isActive: loc.is_active ?? true,
            checkInTime: loc.check_in_time ?? '10:00:00',
            checkOutTime: loc.check_out_time ?? '19:00:00',
            bufferMinutes: loc.buffer_minutes ?? 15,
            offDays: loc.off_days ?? [0],
            dailyWorkingHours: (loc.daily_working_hours as any) ?? {},
            absentDeductionMultiplier: loc.absent_deduction_multiplier ?? null,
        }))
    },

    /**
     * Check if user is within any active geofence
     */
    async checkGeofence(
        userLatitude: number,
        userLongitude: number
    ): Promise<GeofenceResult> {
        const locations = await this.getActiveLocations()

        if (locations.length === 0) {
            // No office locations configured - strictly disallow attendance marking
            return {
                isAllowed: false,
                noLocationsConfigured: true,
                reason: 'No office locations configured. Attendance marking is restricted until an office location is added by the administrator.',
            }
        }

        let nearestOffice: GeofenceResult['nearestOffice'] = undefined
        let withinOffice: GeofenceResult['withinOffice'] = undefined
        let minDistance = Infinity

        for (const location of locations) {
            const distance = haversineDistance(
                userLatitude,
                userLongitude,
                location.latitude,
                location.longitude
            )

            // Track nearest office
            if (distance < minDistance) {
                minDistance = distance
                nearestOffice = {
                    id: location.id,
                    name: location.name,
                    distance: Math.round(distance),
                }
            }

            // Check if within geofence
            if (distance <= location.radiusMeters) {
                withinOffice = {
                    id: location.id,
                    name: location.name,
                    distance: Math.round(distance),
                }
                break // Found a valid location
            }
        }

        return {
            isAllowed: !!withinOffice,
            noLocationsConfigured: false,
            nearestOffice,
            withinOffice,
            reason: withinOffice ? undefined : 'You are outside the designated office boundary.',
        }
    },

    /**
     * Add new office location (admin only)
     */
    async addLocation(
        data: {
            name: string
            address?: string
            latitude: number
            longitude: number
            radiusMeters?: number
            checkInTime?: string
            checkOutTime?: string
            bufferMinutes?: number
            offDays?: number[]
            dailyWorkingHours?: Record<string, { checkIn: string, checkOut: string }>
            absentDeductionMultiplier?: number | null
        },
        createdBy: string
    ): Promise<OfficeLocation> {
        const [location] = await db
            .insert(officeLocations)
            .values({
                name: data.name,
                address: data.address,
                latitude: String(data.latitude),
                longitude: String(data.longitude),
                radius_meters: data.radiusMeters ?? 200,
                check_in_time: data.checkInTime || '10:00:00',
                check_out_time: data.checkOutTime || '19:00:00',
                buffer_minutes: data.bufferMinutes ?? 15,
                off_days: data.offDays || [0],
                daily_working_hours: data.dailyWorkingHours || {},
                absent_deduction_multiplier: data.absentDeductionMultiplier !== undefined ? data.absentDeductionMultiplier : null,
                is_active: true,
                created_by: createdBy,
            })
            .returning()

        // Invalidate locations cache namespace
        SmartCache.invalidateLocations()

        return {
            id: location.id,
            name: location.name,
            address: location.address,
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
            radiusMeters: location.radius_meters,
            isActive: location.is_active ?? true,
            checkInTime: location.check_in_time,
            checkOutTime: location.check_out_time,
            bufferMinutes: location.buffer_minutes,
            offDays: location.off_days,
            dailyWorkingHours: location.daily_working_hours as any,
            absentDeductionMultiplier: location.absent_deduction_multiplier,
        }
    },

    /**
     * Update office location (admin only)
     */
    async updateLocation(
        id: string,
        data: {
            name?: string
            address?: string
            latitude?: number
            longitude?: number
            radiusMeters?: number
            isActive?: boolean
            checkInTime?: string
            checkOutTime?: string
            bufferMinutes?: number
            offDays?: number[]
            dailyWorkingHours?: Record<string, { checkIn: string, checkOut: string }>
            absentDeductionMultiplier?: number | null
        }
    ): Promise<OfficeLocation | null> {
        const updateData: Partial<typeof officeLocations.$inferInsert> = {
            updated_at: new Date(),
        }

        if (data.name !== undefined) updateData.name = data.name
        if (data.address !== undefined) updateData.address = data.address
        if (data.latitude !== undefined) updateData.latitude = String(data.latitude)
        if (data.longitude !== undefined) updateData.longitude = String(data.longitude)
        if (data.radiusMeters !== undefined) updateData.radius_meters = data.radiusMeters
        if (data.isActive !== undefined) updateData.is_active = data.isActive
        if (data.checkInTime !== undefined) updateData.check_in_time = data.checkInTime
        if (data.checkOutTime !== undefined) updateData.check_out_time = data.checkOutTime
        if (data.bufferMinutes !== undefined) updateData.buffer_minutes = data.bufferMinutes
        if (data.offDays !== undefined) updateData.off_days = data.offDays
        if (data.dailyWorkingHours !== undefined) updateData.daily_working_hours = data.dailyWorkingHours
        if (data.absentDeductionMultiplier !== undefined) updateData.absent_deduction_multiplier = data.absentDeductionMultiplier

        const [location] = await db
            .update(officeLocations)
            .set(updateData)
            .where(eq(officeLocations.id, id))
            .returning()

        if (!location) return null

        // Invalidate locations cache namespace
        SmartCache.invalidateLocations()

        return {
            id: location.id,
            name: location.name,
            address: location.address,
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
            radiusMeters: location.radius_meters,
            isActive: location.is_active ?? true,
            checkInTime: location.check_in_time,
            checkOutTime: location.check_out_time,
            bufferMinutes: location.buffer_minutes,
            offDays: location.off_days,
            dailyWorkingHours: location.daily_working_hours as any,
            absentDeductionMultiplier: location.absent_deduction_multiplier,
        }
    },

    async deleteLocation(id: string): Promise<boolean> {
        const result = await db
            .delete(officeLocations)
            .where(eq(officeLocations.id, id))
            .returning({ id: officeLocations.id })

        if (result.length > 0) {
            // Invalidate locations cache namespace
            SmartCache.invalidateLocations()
        }

        return result.length > 0
    },

    /**
     * Calculate distance between user and a specific office
     */
    calculateDistance(
        userLat: number,
        userLon: number,
        officeLat: number,
        officeLon: number
    ): number {
        return Math.round(haversineDistance(userLat, userLon, officeLat, officeLon))
    },

    /**
     * Format distance for display
     */
    formatDistance(meters: number): string {
        if (meters < 1000) {
            return `${meters}m`
        }
        return `${(meters / 1000).toFixed(1)}km`
    },
}
