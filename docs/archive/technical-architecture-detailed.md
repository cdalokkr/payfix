# Real-Time Dashboard Technical Architecture

## System Overview

This document provides detailed technical specifications for implementing the enhanced real-time dashboard system, building upon the existing Supabase infrastructure.

## Architecture Components

### 1. Enhanced Real-Time Event System

#### 1.1 Event Definition and Broadcasting

```typescript
// types/realtime-events.ts
export interface RealtimeEvent {
  id: string
  type: 'user_created' | 'user_updated' | 'user_deleted' | 'activity_performed' | 'system_alert'
  actorId: string
  actorRole: 'admin' | 'user'
  targetAudience: {
    admins: boolean
    allUsers: boolean
    specificUsers?: string[]
  }
  timestamp: string
  data: {
    entityId?: string
    entityType?: string
    changes?: Record<string, any>
    metadata?: Record<string, any>
  }
  priority: 'low' | 'medium' | 'high' | 'critical'
  ttl: number // Time to live in milliseconds
}

// Event factory for consistent event creation
export class RealtimeEventFactory {
  static createUserCreatedEvent(actorId: string, actorRole: 'admin' | 'user', userId: string, userData: any): RealtimeEvent {
    return {
      id: `user_created_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'user_created',
      actorId,
      actorRole,
      targetAudience: {
        admins: true,
        allUsers: false,
        specificUsers: [userId] // Notify the newly created user
      },
      timestamp: new Date().toISOString(),
      data: {
        entityId: userId,
        entityType: 'user',
        changes: userData
      },
      priority: 'medium',
      ttl: 30000 // 30 seconds
    }
  }

  static createActivityPerformedEvent(actorId: string, actorRole: 'admin' | 'user', activityData: any): RealtimeEvent {
    return {
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'activity_performed',
      actorId,
      actorRole,
      targetAudience: {
        admins: true, // Admins see all activities
        allUsers: true, // All users see activities for visibility
        specificUsers: [actorId] // Actor sees their own activity highlighted
      },
      timestamp: new Date().toISOString(),
      data: {
        entityType: 'activity',
        changes: activityData
      },
      priority: 'low',
      ttl: 60000 // 1 minute
    }
  }
}
```

#### 1.2 Enhanced Channel Architecture

```typescript
// lib/realtime/channels.ts
export enum RealtimeChannel {
  ADMIN_SHARED = 'dashboard-admin-shared',
  GLOBAL_ACTIVITIES = 'dashboard-global-activities',
  USER_SPECIFIC = 'dashboard-user-specific',
  SYSTEM_EVENTS = 'dashboard-system-events',
  NOTIFICATIONS = 'dashboard-notifications'
}

export interface ChannelConfig {
  name: RealtimeChannel
  eventTypes: RealtimeEvent['type'][]
  allowedRoles: ('admin' | 'user')[]
  maxSubscribers: number
  reconnectPolicy: {
    maxAttempts: number
    baseDelay: number
    maxDelay: number
    backoffMultiplier: number
  }
}

export const CHANNEL_CONFIGS: Record<RealtimeChannel, ChannelConfig> = {
  [RealtimeChannel.ADMIN_SHARED]: {
    name: RealtimeChannel.ADMIN_SHARED,
    eventTypes: ['user_created', 'user_updated', 'user_deleted', 'system_alert'],
    allowedRoles: ['admin'],
    maxSubscribers: 10,
    reconnectPolicy: {
      maxAttempts: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2
    }
  },
  [RealtimeChannel.GLOBAL_ACTIVITIES]: {
    name: RealtimeChannel.GLOBAL_ACTIVITIES,
    eventTypes: ['activity_performed'],
    allowedRoles: ['admin', 'user'],
    maxSubscribers: 100,
    reconnectPolicy: {
      maxAttempts: 3,
      baseDelay: 2000,
      maxDelay: 10000,
      backoffMultiplier: 1.5
    }
  },
  [RealtimeChannel.USER_SPECIFIC]: {
    name: RealtimeChannel.USER_SPECIFIC,
    eventTypes: ['user_created', 'user_updated', 'activity_performed'],
    allowedRoles: ['admin', 'user'],
    maxSubscribers: 1,
    reconnectPolicy: {
      maxAttempts: 5,
      baseDelay: 1000,
      maxDelay: 15000,
      backoffMultiplier: 2
    }
  },
  [RealtimeChannel.SYSTEM_EVENTS]: {
    name: RealtimeChannel.SYSTEM_EVENTS,
    eventTypes: ['system_alert'],
    allowedRoles: ['admin', 'user'],
    maxSubscribers: 1000,
    reconnectPolicy: {
      maxAttempts: 3,
      baseDelay: 5000,
      maxDelay: 30000,
      backoffMultiplier: 1.2
    }
  },
  [RealtimeChannel.NOTIFICATIONS]: {
    name: RealtimeChannel.NOTIFICATIONS,
    eventTypes: ['user_created', 'system_alert'],
    allowedRoles: ['admin', 'user'],
    maxSubscribers: 1000,
    reconnectPolicy: {
      maxAttempts: 3,
      baseDelay: 2000,
      maxDelay: 20000,
      backoffMultiplier: 1.5
    }
  }
}
```

#### 1.3 Event Broadcasting Service

```typescript
// services/realtime-broadcaster.ts
import { createClient } from '@/lib/supabase/client'
import { RealtimeEvent, RealtimeEventFactory } from '@/types/realtime-events'
import { RealtimeChannel, CHANNEL_CONFIGS } from '@/lib/realtime/channels'

export class RealtimeBroadcaster {
  private supabase = createClient()
  private eventQueue: RealtimeEvent[] = []
  private processing = false

  async broadcastEvent(event: RealtimeEvent): Promise<void> {
    console.log('[BROADCASTER] Broadcasting event:', event.type, event.id)
    
    // Determine target channels based on event and audience
    const targetChannels = this.determineTargetChannels(event)
    
    // Queue event for processing
    this.eventQueue.push(event)
    
    // Process queue if not already processing
    if (!this.processing) {
      this.processQueue()
    }
  }

  private determineTargetChannels(event: RealtimeEvent): RealtimeChannel[] {
    const channels: RealtimeChannel[] = []
    
    // Admin-only events
    if (event.targetAudience.admins && !event.targetAudience.allUsers) {
      channels.push(RealtimeChannel.ADMIN_SHARED)
    }
    
    // Global activity events
    if (event.type === 'activity_performed') {
      channels.push(RealtimeChannel.GLOBAL_ACTIVITIES)
    }
    
    // System-wide events
    if (event.type === 'system_alert') {
      channels.push(RealtimeChannel.SYSTEM_EVENTS, RealtimeChannel.NOTIFICATIONS)
    }
    
    // User-specific events
    if (event.targetAudience.specificUsers?.length) {
      channels.push(RealtimeChannel.USER_SPECIFIC)
    }
    
    // High-priority notifications
    if (event.priority === 'high' || event.priority === 'critical') {
      channels.push(RealtimeChannel.NOTIFICATIONS)
    }
    
    return [...new Set(channels)] // Remove duplicates
  }

  private async processQueue(): Promise<void> {
    this.processing = true
    
    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!
        const targetChannels = this.determineTargetChannels(event)
        
        // Broadcast to all target channels
        await Promise.all(
          targetChannels.map(channel => this.broadcastToChannel(channel, event))
        )
        
        // Add small delay between events to prevent overwhelming
        await this.delay(50)
      }
    } catch (error) {
      console.error('[BROADCASTER] Error processing event queue:', error)
    } finally {
      this.processing = false
    }
  }

  private async broadcastToChannel(channel: RealtimeChannel, event: RealtimeEvent): Promise<void> {
    try {
      const channelName = this.getChannelName(channel, event)
      
      await this.supabase.channel(channelName).send({
        type: 'broadcast',
        event: 'realtime-event',
        payload: {
          event,
          channel: channelName,
          timestamp: new Date().toISOString()
        }
      })
      
      console.log(`[BROADCASTER] Event ${event.id} broadcast to ${channelName}`)
    } catch (error) {
      console.error(`[BROADCASTER] Failed to broadcast to ${channel}:`, error)
      
      // Implement retry logic for critical events
      if (event.priority === 'critical') {
        await this.retryBroadcast(channel, event)
      }
    }
  }

  private getChannelName(channel: RealtimeChannel, event: RealtimeEvent): string {
    switch (channel) {
      case RealtimeChannel.USER_SPECIFIC:
        return `${channel}-${event.targetAudience.specificUsers?.[0] || 'unknown'}`
      default:
        return channel
    }
  }

  private async retryBroadcast(channel: RealtimeChannel, event: RealtimeEvent, maxRetries: number = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.delay(Math.pow(2, attempt) * 1000) // Exponential backoff
        await this.broadcastToChannel(channel, event)
        return
      } catch (error) {
        console.warn(`[BROADCASTER] Retry ${attempt} failed for ${channel}:`, error)
      }
    }
    
    console.error(`[BROADCASTER] All retries exhausted for event ${event.id} on ${channel}`)
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Global broadcaster instance
export const realtimeBroadcaster = new RealtimeBroadcaster()
```

### 2. Enhanced Real-Time Hook

#### 2.1 Advanced Filtering and Processing

```typescript
// hooks/use-enhanced-realtime-dashboard.ts
'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { trpc } from '@/lib/trpc/client'
import { RealtimeEvent, RealtimeEventFactory } from '@/types/realtime-events'
import { RealtimeChannel } from '@/lib/realtime/channels'
import { realtimeBroadcaster } from '@/services/realtime-broadcaster'
import { UserRole } from '@/types'
import { invalidateDashboardCache } from '@/lib/trpc/routers/admin-dashboard-optimized'

interface EnhancedRealtimeConfig {
  role: UserRole
  userId: string
  userEmail?: string
}

interface EventProcessingState {
  isProcessing: boolean
  processedEvents: Set<string>
  lastProcessedTimestamp: string | null
  batchQueue: RealtimeEvent[]
}

export function useEnhancedRealtimeDashboard(config: EnhancedRealtimeConfig): RealtimeDashboardData {
  const { role, userId, userEmail } = config
  const supabase = createClient()
  
  // Enhanced state management
  const [eventState, setEventState] = useState<EventProcessingState>({
    isProcessing: false,
    processedEvents: new Set(),
    lastProcessedTimestamp: null,
    batchQueue: []
  })
  
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected')
  const [channelHealth, setChannelHealth] = useState<Record<RealtimeChannel, 'healthy' | 'degraded' | 'offline'>>()
  
  // Refs for cleanup and performance
  const channelsRef = useRef<Map<RealtimeChannel, any>>(new Map())
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<string>('')
  
  // tRPC utilities
  const utils = trpc.useUtils()
  
  // Enhanced filtering logic
  const shouldProcessEvent = useCallback((event: RealtimeEvent): boolean => {
    // Skip if already processed
    if (eventState.processedEvents.has(event.id)) {
      return false
    }
    
    // Role-based filtering
    switch (event.type) {
      case 'user_created':
      case 'user_updated':
      case 'user_deleted':
        return role === 'admin' // Only admins see user management events directly
      
      case 'activity_performed':
        // Admins see all activities, users see their own + highlighted ones
        return role === 'admin' || event.actorId === userId
      
      case 'system_alert':
        return true // Everyone sees system alerts
      
      default:
        return false
    }
  }, [role, userId, eventState.processedEvents])
  
  // Batch processing for performance
  const processEventBatch = useCallback(async () => {
    if (eventState.batchQueue.length === 0 || eventState.isProcessing) {
      return
    }
    
    setEventState(prev => ({ ...prev, isProcessing: true }))
    
    try {
      // Take all events from batch and process them
      const eventsToProcess = [...eventState.batchQueue]
      eventState.batchQueue.length = 0
      
      console.log(`[ENHANCED-REALTIME] Processing batch of ${eventsToProcess.length} events`)
      
      // Sort events by priority and timestamp
      const sortedEvents = eventsToProcess.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
        if (priorityDiff !== 0) return priorityDiff
        
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      })
      
      // Process each event
      for (const event of sortedEvents) {
        if (shouldProcessEvent(event)) {
          await processIndividualEvent(event)
          
          // Mark as processed
          setEventState(prev => ({
            ...prev,
            processedEvents: new Set([...prev.processedEvents, event.id])
          }))
          
          lastActivityRef.current = event.timestamp
        }
      }
      
      setEventState(prev => ({
        ...prev,
        lastProcessedTimestamp: new Date().toISOString(),
        isProcessing: false
      }))
      
      // Trigger dashboard refresh if any relevant events were processed
      if (sortedEvents.some(shouldProcessEvent)) {
        await invalidateDashboardCache('realtime-update')
        await utils.admin.dashboard.getUnifiedDashboardData.invalidate()
      }
      
    } catch (error) {
      console.error('[ENHANCED-REALTIME] Error processing event batch:', error)
      setEventState(prev => ({ ...prev, isProcessing: false }))
    }
  }, [eventState.batchQueue, eventState.isProcessing, shouldProcessEvent, utils])
  
  // Individual event processing
  const processIndividualEvent = useCallback(async (event: RealtimeEvent) => {
    console.log(`[ENHANCED-REALTIME] Processing event: ${event.type}`, {
      id: event.id,
      actorId: event.actorId,
      priority: event.priority
    })
    
    // Handle different event types
    switch (event.type) {
      case 'user_created':
        if (role === 'admin') {
          // Trigger user list refresh
          await utils.admin.users.getUsers.invalidate()
          
          // Show notification
          showNotification('New user created', 'info')
        }
        break
        
      case 'activity_performed':
        // Highlight the activity in real-time
        highlightRecentActivity(event.data.changes)
        
        if (event.actorId === userId) {
          showNotification('Your activity has been recorded', 'success')
        }
        break
        
      case 'system_alert':
        showNotification('System notification received', 'warning')
        break
    }
  }, [role, userId, utils])
  
  // Queue event for batch processing
  const queueEvent = useCallback((event: RealtimeEvent) => {
    setEventState(prev => ({
      ...prev,
      batchQueue: [...prev.batchQueue, event]
    }))
    
    // Set timeout for batch processing
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current)
    }
    
    processingTimeoutRef.current = setTimeout(processEventBatch, 100)
  }, [processEventBatch])
  
  // Enhanced channel subscription setup
  useEffect(() => {
    const setupChannels = async () => {
      console.log(`[ENHANCED-REALTIME] Setting up channels for ${role} user: ${userId}`)
      setConnectionStatus('connecting')
      
      try {
        // Subscribe to role-appropriate channels
        const channelsToSubscribe = getChannelsForRole(role, userId)
        
        for (const channelType of channelsToSubscribe) {
          const channelName = getChannelName(channelType, userId)
          const channel = supabase.channel(channelName)
          
          // Set up event listener
          channel.on('broadcast', { event: 'realtime-event' }, (payload) => {
            const event = payload.payload.event as RealtimeEvent
            console.log(`[ENHANCED-REALTIME] Received event on ${channelName}:`, event.type)
            
            // Validate event and queue for processing
            if (isValidEvent(event)) {
              queueEvent(event)
            }
          })
          
          // Subscribe to channel
          const status = await channel.subscribe()
          
          if (status === 'SUBSCRIBED') {
            console.log(`[ENHANCED-REALTIME] Successfully subscribed to ${channelName}`)
            channelsRef.current.set(channelType, channel)
            setChannelHealth(prev => ({ ...prev, [channelType]: 'healthy' }))
          } else {
            console.warn(`[ENHANCED-REALTIME] Failed to subscribe to ${channelName}, status: ${status}`)
            setChannelHealth(prev => ({ ...prev, [channelType]: 'degraded' }))
          }
        }
        
        setConnectionStatus('connected')
        
      } catch (error) {
        console.error('[ENHANCED-REALTIME] Error setting up channels:', error)
        setConnectionStatus('disconnected')
      }
    }
    
    setupChannels()
    
    // Cleanup function
    return () => {
      console.log('[ENHANCED-REALTIME] Cleaning up channels')
      
      // Clear processing timeout
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current)
      }
      
      // Unsubscribe from all channels
      channelsRef.current.forEach((channel, channelType) => {
        try {
          supabase.removeChannel(channel)
          console.log(`[ENHANCED-REALTIME] Removed channel: ${channelType}`)
        } catch (error) {
          console.warn(`[ENHANCED-REALTIME] Error removing channel ${channelType}:`, error)
        }
      })
      
      channelsRef.current.clear()
    }
  }, [role, userId, supabase, queueEvent])
  
  // Helper functions
  const getChannelsForRole = (role: UserRole, userId: string): RealtimeChannel[] => {
    if (role === 'admin') {
      return [
        RealtimeChannel.ADMIN_SHARED,
        RealtimeChannel.GLOBAL_ACTIVITIES,
        RealtimeChannel.SYSTEM_EVENTS,
        RealtimeChannel.NOTIFICATIONS
      ]
    } else {
      return [
        RealtimeChannel.GLOBAL_ACTIVITIES,
        RealtimeChannel.USER_SPECIFIC,
        RealtimeChannel.SYSTEM_EVENTS,
        RealtimeChannel.NOTIFICATIONS
      ]
    }
  }
  
  const getChannelName = (channel: RealtimeChannel, userId: string): string => {
    switch (channel) {
      case RealtimeChannel.USER_SPECIFIC:
        return `${channel}-${userId}`
      default:
        return channel
    }
  }
  
  const isValidEvent = (event: any): event is RealtimeEvent => {
    return event && 
           typeof event.id === 'string' && 
           typeof event.type === 'string' && 
           typeof event.actorId === 'string' &&
           typeof event.timestamp === 'string'
  }
  
  const showNotification = (message: string, type: 'info' | 'success' | 'warning' | 'error') => {
    // Integration with existing toast system
    if (typeof window !== 'undefined' && (window as any).toast) {
      (window as any).toast[type](message)
    }
    
    console.log(`[ENHANCED-REALTIME] Notification: ${type} - ${message}`)
  }
  
  const highlightRecentActivity = (activityData: any) => {
    // Trigger visual highlight in activity feed
    window.dispatchEvent(new CustomEvent('activity-highlight', {
      detail: activityData
    }))
  }
  
  // Memoized return value
  return useMemo(() => ({
    // Existing dashboard data structure
    ...useBaseRealtimeDashboard(config),
    
    // Enhanced real-time features
    eventProcessing: {
      isProcessing: eventState.isProcessing,
      processedEventsCount: eventState.processedEvents.size,
      lastProcessedTimestamp: eventState.lastProcessedTimestamp,
      queuedEventsCount: eventState.batchQueue.length
    },
    
    connectionStatus,
    channelHealth,
    
    // Enhanced actions
    forceRefresh: async () => {
      await invalidateDashboardCache('manual-refresh')
      await utils.admin.dashboard.getUnifiedDashboardData.invalidate()
    },
    
    testEvent: (eventType: RealtimeEvent['type']) => {
      // Test function for debugging
      const testEvent = RealtimeEventFactory.createActivityPerformedEvent(userId, role, {
        test: true,
        timestamp: new Date().toISOString()
      })
      realtimeBroadcaster.broadcastEvent(testEvent)
    }
  }), [config, eventState, connectionStatus, channelHealth, utils])
}

// Base dashboard data hook (existing implementation)
function useBaseRealtimeDashboard(config: EnhancedRealtimeConfig): RealtimeDashboardData {
  // This would integrate with your existing use-realtime-dashboard-data.ts
  // For now, returning a basic structure
  return {
    stats: { totalUsers: 0, totalActivities: 0, todayActivities: 0 },
    recentActivities: [],
    analytics: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: () => Promise.resolve(),
    activeUsers: 0,
    dataSource: 'cache',
    lastUpdated: null,
    magicCardsDataReady: true,
    recentActivityDataReady: true,
    showSkeleton: false
  }
}
```

### 3. Performance Optimization Layer

#### 3.1 Smart Cache Manager

```typescript
// services/smart-cache-manager.ts
interface CacheTier {
  name: 'critical' | 'secondary' | 'detailed' | 'prefetch'
  ttl: number
  maxSize: number
  priority: number
  backgroundRefresh: boolean
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  accessCount: number
  lastAccessed: number
  priority: number
  isStale: boolean
}

export class SmartCacheManager {
  private caches: Map<string, CacheTier> = new Map()
  private entries: Map<string, CacheEntry<any>> = new Map()
  private refreshQueue: Map<string, () => Promise<any>> = new Map()
  
  constructor() {
    this.initializeCacheTiers()
    this.startBackgroundRefresh()
  }
  
  private initializeCacheTiers() {
    const tiers: CacheTier[] = [
      {
        name: 'critical',
        ttl: 3000, // 3 seconds
        maxSize: 10,
        priority: 4,
        backgroundRefresh: true
      },
      {
        name: 'secondary',
        ttl: 10000, // 10 seconds
        maxSize: 25,
        priority: 3,
        backgroundRefresh: true
      },
      {
        name: 'detailed',
        ttl: 30000, // 30 seconds
        maxSize: 50,
        priority: 2,
        backgroundRefresh: false
      },
      {
        name: 'prefetch',
        ttl: 10000, // 10 seconds
        maxSize: 20,
        priority: 1,
        backgroundRefresh: true
      }
    ]
    
    tiers.forEach(tier => this.caches.set(tier.name, tier))
  }
  
  async get<T>(key: string, fetcher?: () => Promise<T>): Promise<T | null> {
    const entry = this.entries.get(key)
    const now = Date.now()
    
    // Check if entry exists and is not stale
    if (entry && !this.isStale(entry)) {
      this.updateAccessStats(key)
      return entry.data
    }
    
    // If stale and we have a fetcher, refresh in background
    if (entry && entry.isStale && fetcher) {
      this.scheduleBackgroundRefresh(key, fetcher)
      
      // Return stale data while refreshing
      return entry.data
    }
    
    // No entry or no fetcher
    return null
  }
  
  async set<T>(key: string, data: T, tier: CacheTier['name'] = 'secondary'): Promise<void> {
    const tierConfig = this.caches.get(tier)
    if (!tierConfig) {
      throw new Error(`Invalid cache tier: ${tier}`)
    }
    
    const now = Date.now()
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      priority: tierConfig.priority,
      isStale: false
    }
    
    // Evict old entries if cache is full
    if (this.entries.size >= tierConfig.maxSize) {
      this.evictEntries(tierConfig.maxSize - 1)
    }
    
    this.entries.set(key, entry)
    console.log(`[CACHE] Set ${key} in ${tier} tier`)
  }
  
  private isStale(entry: CacheEntry<any>): boolean {
    const age = Date.now() - entry.timestamp
    const tier = Array.from(this.caches.values()).find(t => t.priority === entry.priority)
    return age > (tier?.ttl || 10000)
  }
  
  private updateAccessStats(key: string): void {
    const entry = this.entries.get(key)
    if (entry) {
      entry.accessCount++
      entry.lastAccessed = Date.now()
    }
  }
  
  private evictEntries(targetSize: number): void {
    const entriesArray = Array.from(this.entries.entries())
    
    // Sort by priority (lower first) and last accessed (oldest first)
    entriesArray.sort((a, b) => {
      const [aKey, aEntry] = a
      const [bKey, bEntry] = b
      
      // First by priority (lower priority evicted first)
      if (aEntry.priority !== bEntry.priority) {
        return aEntry.priority - bEntry.priority
      }
      
      // Then by last accessed (oldest accessed first)
      return aEntry.lastAccessed - bEntry.lastAccessed
    })
    
    // Remove excess entries
    const toRemove = entriesArray.slice(0, this.entries.size - targetSize)
    toRemove.forEach(([key]) => {
      this.entries.delete(key)
      console.log(`[CACHE] Evicted ${key}`)
    })
  }
  
  private scheduleBackgroundRefresh<T>(key: string, fetcher: () => Promise<T>): void {
    if (this.refreshQueue.has(key)) {
      return // Already scheduled
    }
    
    this.refreshQueue.set(key, fetcher)
    
    setTimeout(async () => {
      try {
        const fetcher = this.refreshQueue.get(key)
        if (fetcher) {
          const freshData = await fetcher()
          await this.set(key, freshData)
          console.log(`[CACHE] Background refresh completed for ${key}`)
        }
      } catch (error) {
        console.warn(`[CACHE] Background refresh failed for ${key}:`, error)
      } finally {
        this.refreshQueue.delete(key)
      }
    }, 100) // Small delay to batch refreshes
  }
  
  private startBackgroundRefresh(): void {
    setInterval(() => {
      const now = Date.now()
      
      this.entries.forEach((entry, key) => {
        if (entry.isStale) return
        
        const tier = Array.from(this.caches.values()).find(t => t.priority === entry.priority)
        if (tier?.backgroundRefresh) {
          const age = now - entry.timestamp
          const refreshThreshold = tier.ttl * 0.8 // Refresh when 80% of TTL elapsed
          
          if (age > refreshThreshold) {
            entry.isStale = true
            console.log(`[CACHE] Marked ${key} as stale, will refresh in background`)
          }
        }
      })
    }, 5000) // Check every 5 seconds
  }
  
  // Public utility methods
  invalidate(key: string): void {
    this.entries.delete(key)
    console.log(`[CACHE] Invalidated ${key}`)
  }
  
  invalidateTier(tier: CacheTier['name']): void {
    const tierConfig = this.caches.get(tier)
    if (!tierConfig) return
    
    const keysToRemove: string[] = []
    
    this.entries.forEach((entry, key) => {
      if (entry.priority === tierConfig.priority) {
        keysToRemove.push(key)
      }
    })
    
    keysToRemove.forEach(key => this.entries.delete(key))
    console.log(`[CACHE] Invalidated tier ${tier}, removed ${keysToRemove.length} entries`)
  }
  
  getStats() {
    const stats = {
      totalEntries: this.entries.size,
      tierBreakdown: {} as Record<string, number>,
      memoryUsage: 0
    }
    
    this.entries.forEach(entry => {
      const tier = Array.from(this.caches.values()).find(t => t.priority === entry.priority)
      const tierName = tier?.name || 'unknown'
      stats.tierBreakdown[tierName] = (stats.tierBreakdown[tierName] || 0) + 1
    })
    
    return stats
  }
}

// Global cache manager instance
export const smartCacheManager = new SmartCacheManager()
```

This technical architecture document provides the detailed implementation specifications for:

1. **Enhanced Event System** - Complete event definitions, broadcasting logic, and channel management
2. **Advanced Real-time Hook** - Sophisticated filtering, batching, and processing capabilities  
3. **Performance Optimization** - Smart caching with multiple tiers and background refresh

The architecture builds upon your existing infrastructure while adding the sophisticated real-time capabilities needed for the three-browser notification scenario. Each component is designed to integrate seamlessly with your current Supabase and tRPC setup.
