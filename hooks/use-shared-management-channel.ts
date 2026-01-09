'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Shared Management Channel Manager
 * 
 * Singleton pattern for `dashboard-management-shared` channel.
 * Multiple components can subscribe to the same channel without creating
 * duplicate WebSocket connections.
 * 
 * Usage:
 *   const { subscribe } = useSharedManagementChannel()
 *   useEffect(() => subscribe((category) => { ... }), [subscribe])
 */

// Module-level singleton state
let sharedChannel: RealtimeChannel | null = null
let subscriberCount = 0
let supabaseClient: ReturnType<typeof createClient> | null = null
const callbacks = new Set<(category: string, payload: any) => void>()

const CHANNEL_NAME = 'dashboard-management-shared'

function getOrCreateChannel() {
    if (sharedChannel) {
        return sharedChannel
    }

    console.log('[SHARED-CHANNEL] Creating shared management channel')
    supabaseClient = createClient()

    sharedChannel = supabaseClient
        .channel(CHANNEL_NAME)
        .on(
            'broadcast',
            { event: 'realtime-event' },
            (payload) => {
                const category = payload.payload?.metadata?.category
                const eventPayload = payload.payload?.payload || payload.payload

                console.log(`[SHARED-CHANNEL] Received ${category} event, notifying ${callbacks.size} subscribers`)

                // Notify all subscribers
                callbacks.forEach(callback => {
                    try {
                        callback(category, eventPayload)
                    } catch (error) {
                        console.error('[SHARED-CHANNEL] Error in callback:', error)
                    }
                })
            }
        )
        .subscribe((status) => {
            console.log('[SHARED-CHANNEL] Subscription status:', status)
        })

    return sharedChannel
}

function destroyChannel() {
    if (sharedChannel && supabaseClient) {
        console.log('[SHARED-CHANNEL] Destroying shared management channel')
        supabaseClient.removeChannel(sharedChannel)
        sharedChannel = null
        supabaseClient = null
    }
}

/**
 * Hook for subscribing to the shared management channel.
 * 
 * @returns subscribe function that takes a callback for handling events
 */
export function useSharedManagementChannel() {
    const callbackRef = useRef<((category: string, payload: any) => void) | null>(null)

    const subscribe = useCallback((callback: (category: string, payload: any) => void) => {
        // Store callback in ref for cleanup
        callbackRef.current = callback

        // Add to global callbacks
        callbacks.add(callback)
        subscriberCount++

        console.log(`[SHARED-CHANNEL] Subscriber added (total: ${subscriberCount})`)

        // Ensure channel exists
        getOrCreateChannel()

        // Return unsubscribe function
        return () => {
            if (callbackRef.current) {
                callbacks.delete(callbackRef.current)
                callbackRef.current = null
            }
            subscriberCount--

            console.log(`[SHARED-CHANNEL] Subscriber removed (remaining: ${subscriberCount})`)

            // Destroy channel if no subscribers remain
            if (subscriberCount === 0) {
                destroyChannel()
            }
        }
    }, [])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (callbackRef.current) {
                callbacks.delete(callbackRef.current)
                subscriberCount--

                console.log(`[SHARED-CHANNEL] Cleanup on unmount (remaining: ${subscriberCount})`)

                if (subscriberCount === 0) {
                    destroyChannel()
                }
                callbackRef.current = null
            }
        }
    }, [])

    return { subscribe }
}

// Event types for type safety
export type ManagementChannelEvent =
    | 'attendance_update'
    | 'dashboard_sync'
    | 'leave_update'
    | 'user_update'
