import { z } from 'zod'
import { router, adminProcedure, protectedProcedure, publicProcedure } from '../server'
import { KioskDeviceService } from '@/lib/services/kiosk-device.service'

export const kioskDevicesRouter = router({
    // Used only by an unpaired kiosk to decide whether the signed-in person
    // may enter terminal setup. Daily kiosk attendance never calls this.
    getSetupAccess: protectedProcedure.query(({ ctx }) => ({
        role: ctx.profile.role,
        canRegisterTerminal: ctx.profile.role === 'admin' || ctx.profile.role === 'super_admin',
    })),

    // Get all registered kiosk devices for current tenant (Admin)
    getAll: adminProcedure.query(async () => {
        return await KioskDeviceService.getDevices()
    }),

    // Register a new kiosk device (Admin)
    create: adminProcedure
        .input(z.object({
            name: z.string().min(2, 'Device name must be at least 2 characters'),
            locationId: z.string().uuid().optional().nullable(),
        }))
        .mutation(async ({ ctx, input }) => {
            return await KioskDeviceService.createDevice({
                name: input.name,
                locationId: input.locationId,
                createdBy: ctx.profile.id,
            })
        }),

    // Delete a kiosk device (Admin)
    delete: adminProcedure
        .input(z.object({
            id: z.string().uuid(),
        }))
        .mutation(async ({ input }) => {
            return await KioskDeviceService.deleteDevice(input.id)
        }),

    // Public endpoint: Restore an already-paired terminal on normal kiosk open.
    // This does not register, claim, or reassign a terminal.
    verifyPairingCode: publicProcedure
        .input(z.object({
            pairingCode: z.string().trim().min(3, 'Invalid pairing code'),
            terminalId: z.string().trim().min(8).max(128),
        }))
        .mutation(async ({ input }) => {
            let result = await KioskDeviceService.verifyPairingCode(input.pairingCode, input.terminalId)
            // One-time migration for terminals paired before installation
            // binding existed. Their next normal kiosk open claims the key;
            // every later terminal must present that same installation ID.
            if (result && !result.device.terminalId) {
                result = await KioskDeviceService.claimPairingCode(input.pairingCode, input.terminalId)
            }
            if (!result) {
                return { success: false, message: 'Invalid or inactive pairing code' }
            }
            return {
                success: true,
                device: result.device,
                tenantSlug: result.tenantSlug,
                tenantSchema: result.tenantSchema,
            }
        }),

    // Admin-only endpoint: first-time registration or recovery after local
    // kiosk storage has been lost. Keeping this separate from restore prevents
    // possession of a pairing code from becoming a terminal-management grant.
    registerPairingCode: adminProcedure
        .input(z.object({
            pairingCode: z.string().trim().min(3, 'Invalid pairing code'),
            terminalId: z.string().trim().min(8).max(128),
        }))
        .mutation(async ({ ctx, input }) => {
            await KioskDeviceService.ensureSchema()
            const existing = await KioskDeviceService.verifyPairingCode(input.pairingCode)
            if (!existing) {
                return { success: false, message: 'Invalid or inactive pairing code' }
            }

            if (!ctx.tenant || existing.tenantSlug !== ctx.tenant.slug) {
                return { success: false, message: 'This terminal does not belong to the current tenant workspace' }
            }

            const result = await KioskDeviceService.claimPairingCode(input.pairingCode, input.terminalId)
            if (!result) {
                return { success: false, message: 'This pairing key is already registered to another kiosk terminal. Unpair it in Admin Settings before registering a replacement.' }
            }

            return {
                success: true,
                device: result.device,
                tenantSlug: result.tenantSlug,
                tenantSchema: result.tenantSchema,
            }
        }),
})
