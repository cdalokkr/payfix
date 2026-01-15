/**
 * Office Locations Router
 * tRPC endpoints for managing office locations (geofencing)
 */

import { z } from 'zod'
import { router, protectedProcedure, adminProcedure } from '../server'
import { GeofenceService } from '@/lib/services/geofence.service'

export const officeLocationsRouter = router({
    // Get all active locations (for employees)
    getActive: protectedProcedure.query(async () => {
        return GeofenceService.getActiveLocations()
    }),

    // Get all locations (admin only)
    getAll: adminProcedure.query(async () => {
        return GeofenceService.getAllLocations()
    }),

    // Check if user is within geofence
    checkGeofence: protectedProcedure
        .input(z.object({
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
        }))
        .query(async ({ input }) => {
            return GeofenceService.checkGeofence(input.latitude, input.longitude)
        }),

    // Add new location (admin only)
    add: adminProcedure
        .input(z.object({
            name: z.string().min(1).max(100),
            address: z.string().optional(),
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
            radiusMeters: z.number().min(50).max(5000).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            return GeofenceService.addLocation(input, ctx.profile.id)
        }),

    // Update location (admin only)
    update: adminProcedure
        .input(z.object({
            id: z.string().uuid(),
            name: z.string().min(1).max(100).optional(),
            address: z.string().optional(),
            latitude: z.number().min(-90).max(90).optional(),
            longitude: z.number().min(-180).max(180).optional(),
            radiusMeters: z.number().min(50).max(5000).optional(),
            isActive: z.boolean().optional(),
        }))
        .mutation(async ({ input }) => {
            const { id, ...data } = input
            return GeofenceService.updateLocation(id, data)
        }),

    // Delete location (admin only)
    delete: adminProcedure
        .input(z.object({
            id: z.string().uuid(),
        }))
        .mutation(async ({ input }) => {
            return GeofenceService.deleteLocation(input.id)
        }),
})
