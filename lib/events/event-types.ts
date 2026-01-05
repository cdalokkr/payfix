/**
 * Enhanced Event Types for Real-Time Notification System
 * 
 * Defines sophisticated event types with role-based routing rules
 * and payload optimization for multi-browser synchronization.
 */

// ============================================
// CORE EVENT TYPES
// ============================================

export type UserRole = 'admin' | 'user' | 'moderator'

export type EventPriority = 'ultra-critical' | 'critical' | 'secondary' | 'detailed'

export type EventCategory =
    | 'user_created'
    | 'user_activity'
    | 'admin_action'
    | 'system_notification'
    | 'dashboard_sync'

// ============================================
// EVENT INTERFACES
// ============================================

export interface EventMetadata {
    /** Event ID for tracking and deduplication */
    eventId: string
    /** Timestamp when event was created */
    timestamp: string
    /** Source of the event (userId, system, etc.) */
    source: {
        type: 'user' | 'system' | 'admin'
        id: string
        name?: string
    }
    /** Event priority level for TTL routing */
    priority: EventPriority
    /** Event category for filtering */
    category: EventCategory
    /** Target roles for this event */
    targetRoles: UserRole[]
    /** Event metadata for additional context */
    metadata?: Record<string, any>
}

export interface EventPayload {
    /** Core event data */
    data: Record<string, any>
    /** Optimized payload flags */
    optimization?: {
        compressed?: boolean
        minimized?: boolean
        cached?: boolean
    }
    /** Related entity IDs for cascade operations */
    relatedIds?: {
        userId?: string
        activityId?: string
        adminActionId?: string
    }
}

export interface RealtimeEvent {
    /** Event metadata */
    metadata: EventMetadata
    /** Event payload data */
    payload: EventPayload
    /** Event routing information */
    routing: {
        /** Channels this event should be broadcast on */
        channels: string[]
        /** Whether event should be persisted */
        persistent: boolean
        /** TTL in seconds for event expiry */
        ttl: number
        /** Batch ID for grouping related events */
        batchId?: string
    }
    /** Event processing flags */
    flags: {
        /** Whether event has been processed */
        processed: boolean
        /** Whether event failed to process */
        failed: boolean
        /** Retry count for failed events */
        retryCount: number
    }
}

// ============================================
// ROLE-BASED ROUTING RULES
// ============================================

export interface RoutingRule {
    /** Rule name */
    name: string
    /** Event types this rule applies to */
    eventTypes: EventCategory[]
    /** Target roles */
    targetRoles: UserRole[]
    /** Channel configuration */
    channels: {
        /** Primary channel name */
        primary: string
        /** Secondary channels */
        secondary?: string[]
    }
    /** TTL configuration by priority */
    ttlByPriority: Record<EventPriority, number>
    /** Whether to persist the event */
    persistent: boolean
    /** Batch configuration */
    batching?: {
        /** Enable batching for this rule */
        enabled: boolean
        /** Batch timeout in ms */
        timeout: number
        /** Maximum batch size */
        maxSize: number
    }
}

// ============================================
// EVENT ROUTING CONFIGURATION
// ============================================

/**
 * Default routing rules for different event types
 * These rules define how events are distributed across browsers
 * based on user roles and event priorities.
 */
export const EVENT_ROUTING_RULES: Record<EventCategory, RoutingRule> = {
    user_created: {
        name: 'user-creation',
        eventTypes: ['user_created'],
        targetRoles: ['admin'], // Only admins should see new user creations
        channels: {
            primary: 'dashboard-admin-shared',
            secondary: ['notifications-admin']
        },
        ttlByPriority: {
            'ultra-critical': 1,  // 1 second for immediate admin alerts
            'critical': 3,        // 3 seconds for important updates
            'secondary': 10,      // 10 seconds for standard updates
            'detailed': 30        // 30 seconds for detailed events
        },
        persistent: true,
        batching: {
            enabled: true,
            timeout: 100, // 100ms batch window
            maxSize: 10   // Max 10 events per batch
        }
    },

    user_activity: {
        name: 'user-activity',
        eventTypes: ['user_activity'],
        targetRoles: ['admin', 'user'], // All users should see relevant activity
        channels: {
            primary: 'dashboard-activity',
            secondary: ['notifications-user', 'notifications-admin', 'dashboard-management-shared']
        },
        ttlByPriority: {
            'ultra-critical': 1,
            'critical': 3,
            'secondary': 10,
            'detailed': 30
        },
        persistent: true,
        batching: {
            enabled: true,
            timeout: 200,
            maxSize: 20
        }
    },

    admin_action: {
        name: 'admin-action',
        eventTypes: ['admin_action'],
        targetRoles: ['admin', 'moderator'], // Admins and moderators see admin actions
        channels: {
            primary: 'dashboard-admin-actions',
            secondary: ['notifications-admin']
        },
        ttlByPriority: {
            'ultra-critical': 1,
            'critical': 3,
            'secondary': 10,
            'detailed': 30
        },
        persistent: true,
        batching: {
            enabled: true,
            timeout: 50,
            maxSize: 5
        }
    },

    system_notification: {
        name: 'system-notification',
        eventTypes: ['system_notification'],
        targetRoles: ['admin', 'user', 'moderator'], // System notifications go to all
        channels: {
            primary: 'dashboard-system',
            secondary: ['notifications-system']
        },
        ttlByPriority: {
            'ultra-critical': 1,
            'critical': 3,
            'secondary': 10,
            'detailed': 30
        },
        persistent: false, // System notifications are typically ephemeral
        batching: {
            enabled: true,
            timeout: 500,
            maxSize: 50
        }
    },
    dashboard_sync: {
        name: 'dashboard-sync',
        eventTypes: ['dashboard_sync'],
        targetRoles: ['admin', 'moderator', 'user'],
        channels: {
            primary: 'dashboard-management-shared',
            secondary: ['dashboard-activity']
        },
        ttlByPriority: {
            'ultra-critical': 1,
            'critical': 1,
            'secondary': 1,
            'detailed': 1
        },
        persistent: false,
        batching: {
            enabled: false,
            timeout: 0,
            maxSize: 0
        }
    }
}

// ============================================
// EVENT TYPE DEFINITIONS
// ============================================

/**
 * User Creation Event
 * Triggered when a new user is created
 * Only visible to admin users
 */
export interface UserCreatedEvent extends RealtimeEvent {
    metadata: EventMetadata & {
        category: 'user_created'
        targetRoles: ['admin']
    }
    payload: EventPayload & {
        data: {
            userId: string
            email: string
            fullName: string
            createdBy: string
            createdByName: string
            userRole: UserRole
        }
    }
}

/**
 * User Activity Event
 * Triggered when a user performs an activity
 * Visible to relevant users based on permissions
 */
export interface UserActivityEvent extends RealtimeEvent {
    metadata: EventMetadata & {
        category: 'user_activity'
        targetRoles: UserRole[]
    }
    payload: EventPayload & {
        data: {
            activityId: string
            userId: string
            userName: string
            action: string
            description: string
            metadata?: Record<string, any>
        }
    }
}

/**
 * Admin Action Event
 * Triggered when an admin performs administrative actions
 * Visible to admin and moderator users
 */
export interface AdminActionEvent extends RealtimeEvent {
    metadata: EventMetadata & {
        category: 'admin_action'
        targetRoles: ['admin', 'moderator']
    }
    payload: EventPayload & {
        data: {
            actionId: string
            adminId: string
            adminName: string
            actionType: string
            description: string
            targetUserId?: string
            metadata?: Record<string, any>
        }
    }
}

/**
 * System Notification Event
 * System-wide notifications for all users
 * Visible to all user roles
 */
export interface SystemNotificationEvent extends RealtimeEvent {
    metadata: EventMetadata & {
        category: 'system_notification'
        targetRoles: ['admin', 'user', 'moderator']
    }
    payload: EventPayload & {
        data: {
            notificationId: string
            title: string
            message: string
            type: 'info' | 'warning' | 'error' | 'success'
            actionUrl?: string
            expiresAt?: string
        }
    }
}

// ============================================
// UTILITY TYPES
// ============================================

export type AnyRealtimeEvent =
    | UserCreatedEvent
    | UserActivityEvent
    | AdminActionEvent
    | SystemNotificationEvent

// ============================================
// EVENT VALIDATION
// ============================================

export interface EventValidationError {
    field: string
    message: string
    code: string
}

export function validateEvent(event: AnyRealtimeEvent): EventValidationError[] {
    const errors: EventValidationError[] = []

    // Validate metadata
    if (!event.metadata?.eventId) {
        errors.push({ field: 'metadata.eventId', message: 'Event ID is required', code: 'REQUIRED_FIELD' })
    }

    if (!event.metadata?.timestamp) {
        errors.push({ field: 'metadata.timestamp', message: 'Timestamp is required', code: 'REQUIRED_FIELD' })
    }

    if (!event.metadata?.source?.type) {
        errors.push({ field: 'metadata.source.type', message: 'Source type is required', code: 'REQUIRED_FIELD' })
    }

    // Validate payload
    if (!event.payload?.data) {
        errors.push({ field: 'payload.data', message: 'Payload data is required', code: 'REQUIRED_FIELD' })
    }

    // Validate routing
    if (!event.routing?.channels?.length) {
        errors.push({ field: 'routing.channels', message: 'At least one channel is required', code: 'REQUIRED_FIELD' })
    }

    return errors
}

// ============================================
// EXPORTS
// ============================================

// All exports are already declared inline above