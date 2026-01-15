/**
 * MPIN Router
 * tRPC endpoints for MPIN authentication
 */

import { z } from 'zod'
import { router, protectedProcedure } from '../server'
import { MpinService } from '@/lib/services/mpin.service'

export const mpinRouter = router({
    // Get MPIN status for current user
    getStatus: protectedProcedure.query(async ({ ctx }) => {
        return MpinService.getStatus(ctx.profile.id)
    }),

    // Set up MPIN
    setup: protectedProcedure
        .input(z.object({
            mpin: z.string().length(6).regex(/^\d+$/),
        }))
        .mutation(async ({ ctx, input }) => {
            return MpinService.setup(ctx.profile.id, input.mpin)
        }),

    // Validate MPIN
    validate: protectedProcedure
        .input(z.object({
            mpin: z.string().length(6).regex(/^\d+$/),
        }))
        .mutation(async ({ ctx, input }) => {
            return MpinService.validate(ctx.profile.id, input.mpin)
        }),

    // Enable/disable biometric
    setBiometric: protectedProcedure
        .input(z.object({
            enabled: z.boolean(),
            credentialId: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            return MpinService.setBiometric(
                ctx.profile.id,
                input.enabled,
                input.credentialId
            )
        }),

    // Validate biometric credential
    validateBiometric: protectedProcedure
        .input(z.object({
            credentialId: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
            return MpinService.validateBiometric(ctx.profile.id, input.credentialId)
        }),

    // Reset MPIN (after email verification)
    reset: protectedProcedure
        .input(z.object({
            newMpin: z.string().length(6).regex(/^\d+$/),
        }))
        .mutation(async ({ ctx, input }) => {
            return MpinService.reset(ctx.profile.id, input.newMpin)
        }),
})
