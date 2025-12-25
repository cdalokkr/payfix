// ============================================
// lib/cache/cache-invalidation.ts
// ============================================

export interface CacheInvalidationEvent {
  type: 'user-action' | 'data-change' | 'time-based' | 'manual' | 'cross-tab'
  key: string
  namespace?: string
  timestamp: number
  reason?: string
  metadata?: Record<string, unknown>
}

export interface InvalidationRule {
  pattern: string | RegExp
  eventType: CacheInvalidationEvent['type']
  handler: (event: CacheInvalidationEvent) => void
  priority: number // Higher numbers = higher priority
}

export interface CacheInvalidationConfig {
  enableCrossTabSync: boolean
  crossTabChannelName?: string
  maxEventHistory: number
  debounceTime: number // in milliseconds
}

class CacheInvalidationSystem {
  private static instance: CacheInvalidationSystem;
  private invalidationRules: Map<string, InvalidationRule[]> = new Map();
  private eventHistory: CacheInvalidationEvent[] = [];
  private broadcastChannel: BroadcastChannel | null = null;
  private config: CacheInvalidationConfig;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private eventListeners: Map<string, ((event: CacheInvalidationEvent) => void)[]> = new Map();

  private constructor(config: Partial<CacheInvalidationConfig> = {}) {
    this.config = {
      enableCrossTabSync: true,
      crossTabChannelName: 'cache-invalidation',
      maxEventHistory: 1000,
      debounceTime: 100,
      ...config
    };

    this.initializeCrossTabSync();
    this.setupDefaultRules();
  }

  static getInstance(config?: Partial<CacheInvalidationConfig>): CacheInvalidationSystem {
    if (!CacheInvalidationSystem.instance) {
      CacheInvalidationSystem.instance = new CacheInvalidationSystem(config);
    }
    return CacheInvalidationSystem.instance;
  }

  private initializeCrossTabSync(): void {
    if (typeof window !== 'undefined' && this.config.enableCrossTabSync) {
      try {
        this.broadcastChannel = new BroadcastChannel(this.config.crossTabChannelName!);
        
        this.broadcastChannel.onmessage = (event) => {
          const invalidationEvent = event.data as CacheInvalidationEvent;
          if (invalidationEvent.type === 'cross-tab') {
            this.handleInvalidationEvent(invalidationEvent);
          }
        };
      } catch (error) {
        console.warn('BroadcastChannel not supported, cross-tab sync disabled:', error);
        this.config.enableCrossTabSync = false;
      }
    }
  }

  private setupDefaultRules(): void {
    // User action invalidations
    this.addInvalidationRule({
      pattern: /^user-/,
      eventType: 'user-action',
      handler: (event) => this.handleUserActionInvalidation(event),
      priority: 10
    });

    // Data change invalidations
    this.addInvalidationRule({
      pattern: /^dashboard-/,
      eventType: 'data-change',
      handler: (event) => this.handleDataChangeInvalidation(event),
      priority: 8
    });

    // Profile data invalidations
    this.addInvalidationRule({
      pattern: /^profile-/,
      eventType: 'data-change',
      handler: (event) => this.handleProfileInvalidation(event),
      priority: 9
    });

    // Analytics data invalidations
    this.addInvalidationRule({
      pattern: /^analytics-/,
      eventType: 'time-based',
      handler: (event) => this.handleAnalyticsInvalidation(event),
      priority: 5
    });
  }

  addInvalidationRule(rule: InvalidationRule): void {
    const key = typeof rule.pattern === 'string' ? rule.pattern : rule.pattern.toString();
    const rules = this.invalidationRules.get(key) || [];
    rules.push(rule);
    rules.sort((a, b) => b.priority - a.priority); // Sort by priority (highest first)
    this.invalidationRules.set(key, rules);
  }

  removeInvalidationRule(pattern: string | RegExp, eventType: CacheInvalidationEvent['type']): void {
    const key = typeof pattern === 'string' ? pattern : pattern.toString();
    const rules = this.invalidationRules.get(key) || [];
    const filteredRules = rules.filter(rule => rule.eventType !== eventType);
    this.invalidationRules.set(key, filteredRules);
  }

  invalidate(
    key: string,
    type: CacheInvalidationEvent['type'],
    reason?: string,
    metadata?: Record<string, unknown>,
    namespace?: string
  ): void {
    const event: CacheInvalidationEvent = {
      type,
      key,
      namespace,
      timestamp: Date.now(),
      reason,
      metadata
    };

    this.handleInvalidationEvent(event);
  }

  private handleInvalidationEvent(event: CacheInvalidationEvent): void {
    // Add to event history
    this.addToHistory(event);

    // Debounce rapid invalidations for the same key
    const debounceKey = `${event.namespace || 'default'}:${event.key}`;
    const existingTimer = this.debounceTimers.get(debounceKey);
    
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Use immediate processing for user-action events to ensure instant cache invalidation
    const debounceDelay = event.type === 'user-action' ? 0 : this.config.debounceTime;

    const timer = setTimeout(() => {
      this.processInvalidationEvent(event);
      this.debounceTimers.delete(debounceKey);
    }, debounceDelay);

    this.debounceTimers.set(debounceKey, timer);

    // Notify event listeners
    this.notifyEventListeners(event);

    // Broadcast to other tabs if enabled
    if (this.config.enableCrossTabSync && this.broadcastChannel && event.type !== 'cross-tab') {
      this.broadcastToOtherTabs(event);
    }
  }

  private processInvalidationEvent(event: CacheInvalidationEvent): void {
    // Find matching rules and execute them
    const matchingRules = this.findMatchingRules(event.key);
    
    for (const rule of matchingRules) {
      if (rule.eventType === event.type) {
        try {
          rule.handler(event);
        } catch (error) {
          console.error('Error executing invalidation rule:', error);
        }
      }
    }
  }

  private findMatchingRules(key: string): InvalidationRule[] {
    const matchingRules: InvalidationRule[] = [];
    
    for (const [patternKey, rules] of this.invalidationRules) {
      for (const rule of rules) {
        if (this.matchesPattern(key, rule.pattern)) {
          matchingRules.push(rule);
        }
      }
    }

    return matchingRules.sort((a, b) => b.priority - a.priority);
  }

  private matchesPattern(key: string, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      return key.startsWith(pattern) || key.includes(pattern);
    } else {
      return pattern.test(key);
    }
  }

  private addToHistory(event: CacheInvalidationEvent): void {
    this.eventHistory.push(event);
    
    // Keep only the most recent events
    if (this.eventHistory.length > this.config.maxEventHistory) {
      this.eventHistory = this.eventHistory.slice(-this.config.maxEventHistory);
    }
  }

  private broadcastToOtherTabs(event: CacheInvalidationEvent): void {
    if (this.broadcastChannel) {
      const crossTabEvent: CacheInvalidationEvent = {
        ...event,
        type: 'cross-tab'
      };
      
      try {
        this.broadcastChannel.postMessage(crossTabEvent);
      } catch (error) {
        console.warn('Failed to broadcast invalidation event:', error);
      }
    }
  }

  private notifyEventListeners(event: CacheInvalidationEvent): void {
    const listeners = this.eventListeners.get(event.type) || [];
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    });
  }

  // Default invalidation handlers
  private handleUserActionInvalidation(event: CacheInvalidationEvent): void {
    // Invalidate user-specific cache entries
    if (event.metadata?.userId) {
      this.invalidate(`user-${event.metadata.userId}`, 'user-action', 'User action performed');
    }
    
    // Invalidate dashboard data that might be affected by user actions
    this.invalidate('dashboard-critical', 'user-action', 'User action may affect dashboard');
    this.invalidate('dashboard-secondary', 'user-action', 'User action may affect dashboard');
  }

  private handleDataChangeInvalidation(event: CacheInvalidationEvent): void {
    // Invalidate related dashboard data
    const dashboardTypes = ['critical', 'secondary', 'detailed'];
    dashboardTypes.forEach(type => {
      this.invalidate(`dashboard-${type}`, 'data-change', `Data change in ${event.key}`);
    });
  }

  private handleProfileInvalidation(event: CacheInvalidationEvent): void {
    // Invalidate profile-related cache entries
    this.invalidate('user-profile', 'data-change', 'Profile data changed');
    
    // If it's the current user's profile, invalidate more aggressively
    if (event.metadata?.isCurrentUser) {
      this.invalidate('dashboard-critical', 'data-change', 'Current user profile changed');
    }
  }

  private handleAnalyticsInvalidation(event: CacheInvalidationEvent): void {
    // Invalidate analytics cache entries
    this.invalidate('analytics-data', 'time-based', 'Analytics data refreshed');
    this.invalidate('dashboard-secondary', 'time-based', 'Analytics data refreshed');
  }

  // Public API methods
  addEventListener(eventType: CacheInvalidationEvent['type'], listener: (event: CacheInvalidationEvent) => void): void {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.push(listener);
    this.eventListeners.set(eventType, listeners);
  }

  removeEventListener(eventType: CacheInvalidationEvent['type'], listener: (event: CacheInvalidationEvent) => void): void {
    const listeners = this.eventListeners.get(eventType) || [];
    const filteredListeners = listeners.filter(l => l !== listener);
    this.eventListeners.set(eventType, filteredListeners);
  }

  getEventHistory(limit?: number): CacheInvalidationEvent[] {
    if (limit) {
      return this.eventHistory.slice(-limit);
    }
    return [...this.eventHistory];
  }

  getInvalidationStats(): {
    totalEvents: number
    eventsByType: Record<string, number>
    recentEvents: CacheInvalidationEvent[]
  } {
    const eventsByType: Record<string, number> = {};
    
    this.eventHistory.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
    });

    return {
      totalEvents: this.eventHistory.length,
      eventsByType,
      recentEvents: this.eventHistory.slice(-10)
    };
  }

  // Utility methods for common invalidation scenarios
  invalidateOnUserAction(userId: string, action: string, metadata?: Record<string, unknown>): void {
    this.invalidate(
      `user-action-${userId}`,
      'user-action',
      `User performed ${action}`,
      { userId, action, ...metadata }
    );
  }

  invalidateOnDataChange(dataType: string, recordId?: string, metadata?: Record<string, unknown>): void {
    const key = recordId ? `${dataType}-${recordId}` : dataType;
    this.invalidate(
      key,
      'data-change',
      `${dataType} data changed`,
      { dataType, recordId, ...metadata }
    );
  }

  invalidateNamespace(namespace: string, reason?: string): void {
    // This would need to be implemented by the cache manager
    // that uses this invalidation system
    this.invalidate(
      `namespace-${namespace}`,
      'manual',
      reason || `Namespace ${namespace} invalidated`
    );
  }
  invalidatePattern(pattern: string, type: CacheInvalidationEvent['type'], reason?: string, metadata?: Record<string, unknown>): void {
    console.log(`🔄 Invalidating cache entries matching pattern: ${pattern}`)
    
    // For pattern-based invalidation, we'll create a special event
    // that triggers all matching rules
    const event: CacheInvalidationEvent = {
      type,
      key: pattern,
      timestamp: Date.now(),
      reason: reason || `Pattern invalidation: ${pattern}`,
      metadata: { pattern, ...metadata }
    }

    // Process the event immediately for pattern invalidation
    this.processInvalidationEvent(event)
    
    // Notify listeners
    this.notifyEventListeners(event)
  }

  // Cleanup method
  destroy(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
    
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    this.eventListeners.clear();
    this.invalidationRules.clear();
    this.eventHistory = [];
  }
}

export const cacheInvalidation = CacheInvalidationSystem.getInstance();