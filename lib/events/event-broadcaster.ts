/**
 * Enhanced Event Broadcaster for Real-Time Subscription Filtering
 * 
 * Provides sophisticated event broadcasting with role-based routing,
 * payload optimization, and multi-tier TTL caching for optimal performance.
 */

import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import {
    type AnyRealtimeEvent,
    type EventCategory,
    type EventPriority,
    type UserRole,
    type RoutingRule,
    EVENT_ROUTING_RULES,
    validateEvent
} from './event-types'

// ============================================
// EVENT BROADCASTER INTERFACE
// ============================================

export interface BroadcastOptions {
    /** Event priority for TTL routing */
    priority?: EventPriority
    /** Additional metadata for the event */
    metadata?: Record<string, any>
    /** Whether to persist the event */
    persistent?: boolean
    /** Custom batch ID for grouping */
    batchId?: string
    /** Suppress event validation (for performance) */
    skipValidation?: boolean
}

export interface EventBroadcasterConfig {
    /** Enable batching for performance optimization */
    enableBatching: boolean
    /** Default batch timeout in ms */
    defaultBatchTimeout: number
    /** Maximum batch size */
    maxBatchSize: number
    /** Enable payload compression */
    enableCompression: boolean
    /** Enable event persistence */
    enablePersistence: boolean
    /** Connection health monitoring */
    enableHealthMonitoring: boolean
    /** Auto-reconnection settings */
    autoReconnect: {
        enabled: boolean
        maxAttempts: number
        baseDelay: number
        maxDelay: number
    }
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_CONFIG: EventBroadcasterConfig = {
    enableBatching: true,
    defaultBatchTimeout: 100,
    maxBatchSize: 20,
    enableCompression: true,
    enablePersistence: true,
    enableHealthMonitoring: true,
    autoReconnect: {
        enabled: true,
        maxAttempts: 5,
        baseDelay: 1000,
        maxDelay: 30000
    }
}

// ============================================
// BATCH MANAGEMENT
// ============================================

interface BatchItem {
    event: AnyRealtimeEvent
    timestamp: number
    resolve: () => void
    reject: (error: Error) => void
}

class EventBatch {
    private items: BatchItem[] = []
    private timeout: NodeJS.Timeout | null = null
    public readonly channelName: string

    constructor(
        private broadcaster: EnhancedEventBroadcaster,
        channelName: string,
        private timeoutMs: number = DEFAULT_CONFIG.defaultBatchTimeout,
        private maxSize: number = DEFAULT_CONFIG.maxBatchSize
    ) {
        this.channelName = channelName
    }

    add(event: AnyRealtimeEvent): Promise<void> {
        return new Promise((resolve, reject) => {
            this.items.push({
                event,
                timestamp: Date.now(),
                resolve,
                reject
            })

            // Auto-flush if batch is full
            if (this.items.length >= this.maxSize) {
                this.flush()
                return
            }

            // Set timeout if not already set
            if (!this.timeout) {
                this.timeout = setTimeout(() => this.flush(), this.timeoutMs)
            }
        })
    }

    async flush(): Promise<void> {
        if (this.timeout) {
            clearTimeout(this.timeout)
            this.timeout = null
        }

        if (this.items.length === 0) return

        const items = [...this.items]
        this.items = []

        try {
            // Broadcast the batch
            await this.broadcaster.broadcastBatch(items.map(item => item.event), this.channelName)

            // Resolve all promises
            items.forEach(item => item.resolve())
        } catch (error) {
            // Reject all promises on error
            const err = error instanceof Error ? error : new Error('Batch broadcast failed')
            items.forEach(item => item.reject(err))
        }
    }

    size(): number {
        return this.items.length
    }

    isEmpty(): boolean {
        return this.items.length === 0
    }
}

// ============================================
// CONNECTION HEALTH MONITORING
// ============================================

export interface ChannelHealth {
    channelName: string
    status: 'connected' | 'disconnected' | 'error' | 'reconnecting'
    lastActivity: number
    reconnectAttempts: number
    errorCount: number
}

class ConnectionHealthMonitor {
    private channels = new Map<string, ChannelHealth>()
    private healthCheckInterval: NodeJS.Timeout | null = null

    constructor(private broadcaster: EnhancedEventBroadcaster) {
        if (broadcaster.getConfig().enableHealthMonitoring) {
            this.startHealthChecks()
        }
    }

    updateChannelStatus(channelName: string, status: ChannelHealth['status'], error?: Error): void {
        const existing = this.channels.get(channelName) || {
            channelName,
            status: 'disconnected',
            lastActivity: Date.now(),
            reconnectAttempts: 0,
            errorCount: 0
        }

        const updated = {
            ...existing,
            status,
            lastActivity: Date.now(),
            reconnectAttempts: status === 'reconnecting' ? existing.reconnectAttempts + 1 : 0,
            errorCount: error ? existing.errorCount + 1 : existing.errorCount
        }

        this.channels.set(channelName, updated)

        // Log significant status changes
        if (status === 'error' || status === 'disconnected') {
            console.warn(`[EVENT-BROADCASTER] Channel ${channelName} status changed to ${status}`, {
                error: error?.message,
                errorCount: updated.errorCount,
                reconnectAttempts: updated.reconnectAttempts
            })
        } else if (status === 'connected') {
            console.log(`[EVENT-BROADCASTER] Channel ${channelName} reconnected successfully`)
        }
    }

    getChannelHealth(channelName: string): ChannelHealth | null {
        return this.channels.get(channelName) || null
    }

    getAllChannelsHealth(): ChannelHealth[] {
        return Array.from(this.channels.values())
    }

    private startHealthChecks(): void {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthChecks()
        }, 30000) // Check every 30 seconds
    }

    private async performHealthChecks(): Promise<void> {
        const config = this.broadcaster.getConfig()
        for (const [channelName, health] of this.channels) {
            if (health.status === 'disconnected' && config.autoReconnect.enabled) {
                if (health.reconnectAttempts < config.autoReconnect.maxAttempts) {
                    console.log(`[EVENT-BROADCASTER] Attempting to reconnect to channel ${channelName}`)
                    this.broadcaster.reconnectChannel(channelName)
                }
            }
        }
    }

    destroy(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval)
            this.healthCheckInterval = null
        }
    }
}

// ============================================
// ENHANCED EVENT BROADCASTER
// ============================================

export class EnhancedEventBroadcaster {
    private config: EventBroadcasterConfig
    private channels = new Map<string, RealtimeChannel>()
    private batches = new Map<string, EventBatch>()
    private healthMonitor: ConnectionHealthMonitor
    private supabase = createClient()

    constructor(config: Partial<EventBroadcasterConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config }
        this.healthMonitor = new ConnectionHealthMonitor(this)
    }

    /**
     * Get broadcaster configuration (public for inner classes)
     */
    getConfig(): EventBroadcasterConfig {
        return this.config
    }

    /**
     * Broadcast an event with role-based routing and optimization
     */
    async broadcastEvent(
        category: EventCategory,
        data: any,
        options: BroadcastOptions = {}
    ): Promise<void> {
        const {
            priority = 'critical',
            metadata = {},
            persistent = true,
            batchId,
            skipValidation = false
        } = options

        try {
            // Get routing rule for this event category
            const routingRule = this.getRoutingRule(category)
            if (!routingRule) {
                throw new Error(`No routing rule found for event category: ${category}`)
            }

            // Create event instance
            const event = this.createEvent(category, data, {
                priority,
                metadata,
                persistent,
                batchId,
                routingRule
            })

            // Validate event if not skipped
            if (!skipValidation) {
                const validationErrors = validateEvent(event)
                if (validationErrors.length > 0) {
                    throw new Error(`Event validation failed: ${validationErrors.map(e => e.message).join(', ')}`)
                }
            }

            // Route event based on configuration
            await this.routeEvent(event, routingRule)

            console.log(`[EVENT-BROADCASTER] Successfully broadcast ${category} event`, {
                eventId: event.metadata.eventId,
                priority,
                channels: event.routing.channels.length,
                targetRoles: event.metadata.targetRoles
            })
        } catch (error) {
            const err = error instanceof Error ? error : new Error('Unknown broadcast error')
            console.error(`[EVENT-BROADCASTER] Failed to broadcast ${category} event:`, err.message)
            throw err
        }
    }

    /**
     * Create a real-time event instance
     */
    private createEvent(
        category: EventCategory,
        data: any,
        options: {
            priority: EventPriority
            metadata: Record<string, any>
            persistent: boolean
            batchId?: string
            routingRule: RoutingRule
        }
    ): AnyRealtimeEvent {
        const { priority, metadata, persistent, batchId, routingRule } = options

        // Generate unique event ID
        const eventId = `${category}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        // Determine TTL based on priority
        const ttl = routingRule.ttlByPriority[priority] || 30

        // Create base event structure with proper typing
        const baseEvent: AnyRealtimeEvent = {
            metadata: {
                eventId,
                timestamp: new Date().toISOString(),
                source: {
                    type: 'system' as const,
                    id: 'system',
                    name: 'Event Broadcaster'
                },
                priority,
                category,
                targetRoles: routingRule.targetRoles,
                metadata
            } as any, // Type assertion to handle complex union types
            payload: {
                data,
                optimization: {
                    compressed: this.config.enableCompression,
                    minimized: true,
                    cached: this.config.enablePersistence
                }
            },
            routing: {
                channels: this.getChannelsForEvent(routingRule),
                persistent,
                ttl,
                batchId
            },
            flags: {
                processed: false,
                failed: false,
                retryCount: 0
            }
        }

        return baseEvent
    }

    /**
     * Route event to appropriate channels
     */
    private async routeEvent(event: AnyRealtimeEvent, routingRule: RoutingRule): Promise<void> {
        if (this.config.enableBatching && routingRule.batching?.enabled) {
            // Use batching for performance
            await this.batchEvent(event, routingRule)
        } else {
            // Direct broadcast
            await this.broadcastEventToChannels(event)
        }
    }

    /**
     * Batch event for efficient transmission
     */
    private async batchEvent(event: AnyRealtimeEvent, routingRule: RoutingRule): Promise<void> {
        const primaryChannel = event.routing.channels[0]
        if (!primaryChannel) return

        let batch = this.batches.get(primaryChannel)
        if (!batch) {
            batch = new EventBatch(
                this,
                primaryChannel,
                routingRule.batching!.timeout,
                routingRule.batching!.maxSize
            )
            this.batches.set(primaryChannel, batch)
        }

        await batch.add(event)
    }

    /**
     * Broadcast batch of events to channels (public for EventBatch access)
     */
    async broadcastBatch(events: AnyRealtimeEvent[], channelName: string): Promise<void> {
        const channel = await this.getOrCreateChannel(channelName)

        if (!channel) {
            throw new Error(`Failed to create or get channel: ${channelName}`)
        }

        // Broadcast batch payload
        const batchPayload = {
            type: 'event-batch',
            events: events.map(event => ({
                metadata: event.metadata,
                payload: event.payload
            })),
            timestamp: Date.now(),
            batchSize: events.length
        }

        channel.send({
            type: 'broadcast',
            event: 'realtime-events',
            payload: batchPayload
        })

        // Update health status
        this.healthMonitor.updateChannelStatus(channelName, 'connected')
    }

    /**
     * Broadcast event directly to channels
     */
    private async broadcastEventToChannels(event: AnyRealtimeEvent): Promise<void> {
        const channels = await Promise.all(
            event.routing.channels.map(channelName => this.getOrCreateChannel(channelName))
        )

        const validChannels = channels.filter(channel => channel !== null) as RealtimeChannel[]

        if (validChannels.length === 0) {
            throw new Error(`No valid channels available for event: ${event.metadata.eventId}`)
        }

        // Broadcast to all channels
        for (const channel of validChannels) {
            try {
                channel.send({
                    type: 'broadcast',
                    event: 'realtime-event',
                    payload: {
                        metadata: event.metadata,
                        payload: event.payload
                    }
                })
            } catch (error) {
                console.error(`Failed to broadcast to channel:`, error)
            }
        }

        // Update health status for all channels
        for (const channelName of event.routing.channels) {
            this.healthMonitor.updateChannelStatus(channelName, 'connected')
        }
    }

    /**
     * Get or create a Supabase channel
     */
    private async getOrCreateChannel(channelName: string): Promise<RealtimeChannel | null> {
        // Return existing channel if available
        const existingChannel = this.channels.get(channelName)
        if (existingChannel) {
            return existingChannel
        }

        try {
            // Create new channel
            const channel = this.supabase.channel(channelName)

            // Set up channel event handlers
            channel.on('system', {}, (payload) => {
                if (payload.status === 'connected') {
                    this.healthMonitor.updateChannelStatus(channelName, 'connected')
                } else if (payload.status === 'disconnected') {
                    this.healthMonitor.updateChannelStatus(channelName, 'disconnected')
                } else if (payload.status === 'error') {
                    this.healthMonitor.updateChannelStatus(channelName, 'error', new Error(payload.message))
                }
            })

            // Subscribe to channel
            await new Promise<void>((resolve, reject) => {
                channel.subscribe((status, err) => {
                    if (status === 'SUBSCRIBED') {
                        console.log(`[EVENT-BROADCASTER] Successfully subscribed to channel: ${channelName}`)
                        this.channels.set(channelName, channel)
                        this.healthMonitor.updateChannelStatus(channelName, 'connected')
                        resolve()
                    } else if (status === 'CHANNEL_ERROR') {
                        const error = err || new Error('Channel subscription failed')
                        console.error(`[EVENT-BROADCASTER] Channel error for ${channelName}:`, error.message)
                        this.healthMonitor.updateChannelStatus(channelName, 'error', error)
                        reject(error)
                    }
                })
            })

            return channel
        } catch (error) {
            console.error(`[EVENT-BROADCASTER] Failed to create channel ${channelName}:`, error)
            this.healthMonitor.updateChannelStatus(channelName, 'error', error instanceof Error ? error : undefined)
            return null
        }
    }

    /**
     * Get routing rule for event category
     */
    private getRoutingRule(category: EventCategory): RoutingRule | null {
        return EVENT_ROUTING_RULES[category] || null
    }

    /**
     * Get channels for event based on routing rule
     */
    private getChannelsForEvent(routingRule: RoutingRule): string[] {
        const channels = [routingRule.channels.primary]

        if (routingRule.channels.secondary) {
            channels.push(...routingRule.channels.secondary)
        }

        return channels
    }

    /**
     * Reconnect to a channel
     */
    reconnectChannel(channelName: string): void {
        const channel = this.channels.get(channelName)
        if (channel) {
            console.log(`[EVENT-BROADCASTER] Reconnecting to channel: ${channelName}`)
            channel.subscribe()
            this.healthMonitor.updateChannelStatus(channelName, 'reconnecting')
        }
    }

    /**
     * Get channel health status
     */
    getChannelHealth(channelName: string): ChannelHealth | null {
        return this.healthMonitor.getChannelHealth(channelName)
    }

    /**
     * Get health status for all channels
     */
    getAllChannelsHealth(): ChannelHealth[] {
        return this.healthMonitor.getAllChannelsHealth()
    }

    /**
     * Flush all pending batches
     */
    async flushAllBatches(): Promise<void> {
        const flushPromises = Array.from(this.batches.values()).map(batch => batch.flush())
        await Promise.all(flushPromises)
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        // Clear all batches
        this.batches.clear()

        // Unsubscribe from all channels
        for (const channel of this.channels.values()) {
            try {
                this.supabase.removeChannel(channel)
            } catch (error) {
                console.error('Error removing channel:', error)
            }
        }

        this.channels.clear()

        // Destroy health monitor
        this.healthMonitor.destroy()
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let broadcasterInstance: EnhancedEventBroadcaster | null = null

export function getEventBroadcaster(config?: Partial<EventBroadcasterConfig>): EnhancedEventBroadcaster {
    if (!broadcasterInstance) {
        broadcasterInstance = new EnhancedEventBroadcaster(config)
    }
    return broadcasterInstance
}

export function createEventBroadcaster(config: Partial<EventBroadcasterConfig>): EnhancedEventBroadcaster {
    return new EnhancedEventBroadcaster(config)
}

// ============================================
// EXPORTS
// ============================================

// All types and interfaces are already exported inline above