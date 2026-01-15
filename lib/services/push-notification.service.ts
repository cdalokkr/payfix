/**
 * Push Notification Service
 * Handles web push subscription and notification management
 */

import { db } from '@/lib/db'
import { pushSubscriptions, profiles } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

// VAPID keys should be in environment variables
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''

export interface PushSubscription {
    endpoint: string
    keys: {
        p256dh: string
        auth: string
    }
}

export interface NotificationPayload {
    title: string
    body: string
    icon?: string
    badge?: string
    tag?: string
    data?: Record<string, unknown>
    actions?: Array<{
        action: string
        title: string
        icon?: string
    }>
    requireInteraction?: boolean
}

export const PushNotificationService = {
    /**
     * Get VAPID public key for client
     */
    getVapidPublicKey(): string {
        return VAPID_PUBLIC_KEY
    },

    /**
     * Save push subscription for user
     */
    async saveSubscription(
        profileId: string,
        subscription: PushSubscription,
        userAgent?: string
    ): Promise<boolean> {
        try {
            // Check if subscription already exists
            const existing = await db
                .select()
                .from(pushSubscriptions)
                .where(
                    and(
                        eq(pushSubscriptions.profile_id, profileId),
                        eq(pushSubscriptions.endpoint, subscription.endpoint)
                    )
                )
                .limit(1)

            if (existing.length > 0) {
                // Update existing subscription
                await db
                    .update(pushSubscriptions)
                    .set({
                        p256dh_key: subscription.keys.p256dh,
                        auth_key: subscription.keys.auth,
                        is_active: true,
                    })
                    .where(eq(pushSubscriptions.id, existing[0].id))
            } else {
                // Create new subscription
                await db.insert(pushSubscriptions).values({
                    profile_id: profileId,
                    endpoint: subscription.endpoint,
                    p256dh_key: subscription.keys.p256dh,
                    auth_key: subscription.keys.auth,
                    user_agent: userAgent,
                    is_active: true,
                })
            }

            return true
        } catch (error) {
            console.error('Failed to save push subscription:', error)
            return false
        }
    },

    /**
     * Remove push subscription
     */
    async removeSubscription(profileId: string, endpoint: string): Promise<boolean> {
        try {
            await db
                .delete(pushSubscriptions)
                .where(
                    and(
                        eq(pushSubscriptions.profile_id, profileId),
                        eq(pushSubscriptions.endpoint, endpoint)
                    )
                )
            return true
        } catch (error) {
            console.error('Failed to remove push subscription:', error)
            return false
        }
    },

    /**
     * Send push notification to a specific user
     */
    async sendToUser(
        profileId: string,
        payload: NotificationPayload
    ): Promise<{ success: number; failed: number }> {
        const subscriptions = await db
            .select()
            .from(pushSubscriptions)
            .where(
                and(
                    eq(pushSubscriptions.profile_id, profileId),
                    eq(pushSubscriptions.is_active, true)
                )
            )

        if (subscriptions.length === 0) {
            return { success: 0, failed: 0 }
        }

        return this.sendToSubscriptions(subscriptions, payload)
    },

    /**
     * Send push notification to multiple subscriptions
     */
    async sendToSubscriptions(
        subscriptions: Array<{
            id: string
            endpoint: string
            p256dh_key: string
            auth_key: string
        }>,
        payload: NotificationPayload
    ): Promise<{ success: number; failed: number }> {
        // Note: In production, use web-push library
        // npm install web-push
        // 
        // const webpush = require('web-push')
        // webpush.setVapidDetails(
        //     'mailto:admin@payfix.com',
        //     VAPID_PUBLIC_KEY,
        //     VAPID_PRIVATE_KEY
        // )

        let success = 0
        let failed = 0

        for (const sub of subscriptions) {
            try {
                // In production:
                // await webpush.sendNotification(
                //     {
                //         endpoint: sub.endpoint,
                //         keys: {
                //             p256dh: sub.p256dh_key,
                //             auth: sub.auth_key,
                //         },
                //     },
                //     JSON.stringify(payload)
                // )

                console.log(`[Push] Would send to ${sub.endpoint}:`, payload)
                success++
            } catch (error) {
                console.error('Push notification failed:', error)
                failed++

                // Mark subscription as inactive if it's expired
                const err = error as { statusCode?: number }
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await db
                        .update(pushSubscriptions)
                        .set({ is_active: false })
                        .where(eq(pushSubscriptions.id, sub.id))
                }
            }
        }

        return { success, failed }
    },

    /**
     * Send notification to all users with a specific role
     */
    async sendToRole(
        role: 'admin' | 'moderator' | 'employee',
        payload: NotificationPayload
    ): Promise<{ success: number; failed: number }> {
        const usersWithRole = await db
            .select({ id: profiles.id })
            .from(profiles)
            .where(eq(profiles.role, role))

        let totalSuccess = 0
        let totalFailed = 0

        for (const user of usersWithRole) {
            const result = await this.sendToUser(user.id, payload)
            totalSuccess += result.success
            totalFailed += result.failed
        }

        return { success: totalSuccess, failed: totalFailed }
    },

    /**
     * Send attendance reminder to employees
     */
    async sendAttendanceReminder(profileId: string): Promise<boolean> {
        const result = await this.sendToUser(profileId, {
            title: '⏰ Attendance Reminder',
            body: 'Don\'t forget to mark your attendance today!',
            icon: '/icons/icon-192x192.png',
            tag: 'attendance-reminder',
            data: {
                type: 'attendance_reminder',
                link: '/employee',
            },
            actions: [
                {
                    action: 'mark',
                    title: 'Mark Now',
                },
            ],
        })

        return result.success > 0
    },

    /**
     * Send attendance verified notification
     */
    async sendAttendanceVerified(
        profileId: string,
        status: 'verified' | 'rejected',
        date: string
    ): Promise<boolean> {
        const result = await this.sendToUser(profileId, {
            title: status === 'verified' ? '✅ Attendance Verified' : '❌ Attendance Rejected',
            body: `Your attendance for ${date} has been ${status}`,
            icon: '/icons/icon-192x192.png',
            tag: `attendance-${status}`,
            data: {
                type: 'attendance_verification',
                status,
                date,
                link: '/employee/attendance',
            },
        })

        return result.success > 0
    },
}

export default PushNotificationService
