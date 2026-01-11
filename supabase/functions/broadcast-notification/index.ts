// @ts-nocheck
// Note: This is a Supabase Edge Function that runs in Deno runtime.
// TypeScript errors about Deno imports are expected in Node.js environments.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCors } from '../_shared/cors.ts'
import { createSupabaseClient } from '../_shared/supabase.ts'
import { successResponse, errorResponse } from '../_shared/response.ts'

interface NotificationRequest {
    user_ids: string[]
    title: string
    message: string
    type: string
    link?: string
    broadcast_channel?: string
}

serve(async (req: Request) => {
    // Handle CORS preflight
    const corsResponse = handleCors(req)
    if (corsResponse) return corsResponse

    try {
        const supabase = createSupabaseClient()
        const body: NotificationRequest = await req.json()

        const { user_ids, title, message, type, link, broadcast_channel } = body

        if (!user_ids?.length || !title || !message || !type) {
            return errorResponse('Missing required fields: user_ids, title, message, type', 400)
        }

        // Insert notifications for all users
        const notifications = user_ids.map(user_id => ({
            user_id,
            title,
            message,
            type,
            link: link || null,
            is_read: false
        }))

        const { data, error } = await supabase
            .from('notifications')
            .insert(notifications)
            .select()

        if (error) {
            return errorResponse(`Database error: ${error.message}`, 500)
        }

        // Broadcast via Supabase Realtime to each user's channel
        const broadcastPromises = user_ids.map(async (userId) => {
            const channel = supabase.channel(`dashboard-user-${userId}`)

            return new Promise<void>((resolve) => {
                channel.subscribe(async (status: string) => {
                    if (status === 'SUBSCRIBED') {
                        await channel.send({
                            type: 'broadcast',
                            event: 'realtime-event',
                            payload: {
                                metadata: {
                                    category: 'new_notification',
                                    timestamp: new Date().toISOString(),
                                    eventId: crypto.randomUUID(),
                                    priority: 'critical'
                                },
                                payload: { title, message, type, link, targetUserId: userId }
                            }
                        })
                        await supabase.removeChannel(channel)
                        resolve()
                    } else if (status === 'CHANNEL_ERROR') {
                        resolve()
                    }
                })

                // Safety timeout
                setTimeout(resolve, 3000)
            })
        })

        // Also broadcast to shared channel if specified
        if (broadcast_channel) {
            broadcastPromises.push(
                (async () => {
                    const channel = supabase.channel(broadcast_channel)

                    return new Promise<void>((resolve) => {
                        channel.subscribe(async (status: string) => {
                            if (status === 'SUBSCRIBED') {
                                await channel.send({
                                    type: 'broadcast',
                                    event: 'realtime-event',
                                    payload: {
                                        metadata: {
                                            category: 'new_notification',
                                            timestamp: new Date().toISOString(),
                                            eventId: crypto.randomUUID(),
                                            priority: 'normal'
                                        },
                                        payload: { title, message, type, link }
                                    }
                                })
                                await supabase.removeChannel(channel)
                                resolve()
                            } else if (status === 'CHANNEL_ERROR') {
                                resolve()
                            }
                        })

                        setTimeout(resolve, 3000)
                    })
                })()
            )
        }

        await Promise.all(broadcastPromises)

        return successResponse({
            inserted: data?.length || 0,
            broadcasted_to: user_ids.length
        })

    } catch (err: unknown) {
        console.error('Edge Function Error:', err)
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        return errorResponse(`Server error: ${errorMessage}`, 500)
    }
})
