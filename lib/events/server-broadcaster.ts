import { createClient } from '@supabase/supabase-js'
import { EVENT_ROUTING_RULES, type EventCategory } from './event-types'

/**
 * Server-side version of the event broadcaster.
 * Uses the service role key to broadcast events without RLS restrictions.
 */
export async function broadcastServerEvent(category: EventCategory, payload: any, userId?: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
        console.warn('[SERVER-BROADCAST] Supabase environment variables missing. Skipping broadcast.')
        return
    }

    // Create a one-off client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        }
    })

    const routingRule = EVENT_ROUTING_RULES[category]
    if (!routingRule) {
        console.warn(`[SERVER-BROADCAST] No routing rule found for category: ${category}`)
        return
    }

    const channels = [routingRule.channels.primary, ...(routingRule.channels.secondary || [])]

    // Also include the user-specific channel if userId is provided
    if (userId) {
        channels.push(`dashboard-user-${userId}`)
    }

    // Deduplicate channels
    const uniqueChannels = Array.from(new Set(channels))

    const eventPayload = {
        metadata: {
            category,
            timestamp: new Date().toISOString(),
            eventId: crypto.randomUUID(),
            priority: 'critical'
        },
        payload
    }

    console.log(`[SERVER-BROADCAST] Broadcasting ${category} to channels: ${uniqueChannels.join(', ')}`)

    await Promise.all(uniqueChannels.map(async (channelName) => {
        const channel = supabase.channel(channelName)

        return new Promise<void>((resolve) => {
            channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.send({
                        type: 'broadcast',
                        event: 'realtime-event',
                        payload: eventPayload
                    })
                    // We don't need to keep the channel open on the server
                    await supabase.removeChannel(channel)
                    resolve()
                } else if (status === 'CHANNEL_ERROR') {
                    console.error(`[SERVER-BROADCAST] Failed to subscribe to ${channelName}`)
                    resolve()
                }
            })

            // Safety timeout
            setTimeout(resolve, 5000)
        })
    }))
}
