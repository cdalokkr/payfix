/**
 * Push Notifications Router
 * tRPC endpoints for push notification management
 */

import { z } from 'zod'
import { router, protectedProcedure, adminProcedure } from '../server'
import { PushNotificationService } from '@/lib/services/push-notification.service'

export const pushRouter = router({
    // Get VAPID public key
    getVapidKey: protectedProcedure.query(() => {
        return { key: PushNotificationService.getVapidPublicKey() }
    }),

    // Subscribe to push notifications
    subscribe: protectedProcedure
        .input(z.object({
            endpoint: z.string().url(),
            keys: z.object({
                p256dh: z.string(),
                auth: z.string(),
            }),
            userAgent: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const success = await PushNotificationService.saveSubscription(
                ctx.profile.id,
                {
                    endpoint: input.endpoint,
                    keys: input.keys,
                },
                input.userAgent
            )
            return { success }
        }),

    // Unsubscribe from push notifications
    unsubscribe: protectedProcedure
        .input(z.object({
            endpoint: z.string().url(),
        }))
        .mutation(async ({ ctx, input }) => {
            const success = await PushNotificationService.removeSubscription(
                ctx.profile.id,
                input.endpoint
            )
            return { success }
        }),

    // Send test notification (to self)
    sendTest: protectedProcedure.mutation(async ({ ctx }) => {
        const result = await PushNotificationService.sendToUser(ctx.profile.id, {
            title: '🔔 Test Notification',
            body: 'Push notifications are working!',
            icon: '/icons/icon-192x192.png',
            tag: 'test',
        })
        return result
    }),

    // Send notification to specific user (admin only)
    sendToUser: adminProcedure
        .input(z.object({
            profileId: z.string().uuid(),
            title: z.string(),
            body: z.string(),
            link: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
            return PushNotificationService.sendToUser(input.profileId, {
                title: input.title,
                body: input.body,
                data: input.link ? { link: input.link } : undefined,
            })
        }),

    // Send notification to all users with role (admin only)
    sendToRole: adminProcedure
        .input(z.object({
            role: z.enum(['admin', 'moderator', 'employee']),
            title: z.string(),
            body: z.string(),
            link: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
            return PushNotificationService.sendToRole(input.role, {
                title: input.title,
                body: input.body,
                data: input.link ? { link: input.link } : undefined,
            })
        }),
})
