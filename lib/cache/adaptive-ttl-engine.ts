// ============================================
// lib/cache/adaptive-ttl-engine.ts
// ============================================

export interface DataVolatilityProfile {
  changeFrequency: 'low' | 'medium' | 'high' | 'realtime'
  businessHours: boolean
  userActivityImpact: boolean
  priority: 'critical' | 'important' | 'normal' | 'low'
}

export interface TTLCalculationContext {
  dataType: string
  userProfile?: {
    isActive: boolean
    lastActivity: Date
    role: string
  }
  timeOfDay: Date
  dayOfWeek: number
  systemLoad: 'low' | 'medium' | 'high'
}

export interface TTLStrategy {
  baseTTL: number // in milliseconds
  minTTL: number
  maxTTL: number
  volatilityMultiplier: number
  timeOfDayMultiplier: number
  activityMultiplier: number
  priorityMultiplier: number
}

class AdaptiveTTLEngine {
  private static instance: AdaptiveTTLEngine;
  private volatilityProfiles: Map<string, DataVolatilityProfile> = new Map();
  private ttlStrategies: Map<string, TTLStrategy> = new Map();
  private accessPatterns: Map<string, { count: number; lastAccess: Date }> = new Map();

  private constructor() {
    this.initializeDefaultProfiles();
    this.initializeDefaultStrategies();
  }

  static getInstance(): AdaptiveTTLEngine {
    if (!AdaptiveTTLEngine.instance) {
      AdaptiveTTLEngine.instance = new AdaptiveTTLEngine();
    }
    return AdaptiveTTLEngine.instance;
  }

  private initializeDefaultProfiles(): void {
    // Critical dashboard data
    this.volatilityProfiles.set('critical-dashboard-data', {
      changeFrequency: 'medium',
      businessHours: true,
      userActivityImpact: true,
      priority: 'critical'
    });

    // Secondary dashboard data
    this.volatilityProfiles.set('secondary-dashboard-data', {
      changeFrequency: 'low',
      businessHours: true,
      userActivityImpact: false,
      priority: 'important'
    });

    // Detailed dashboard data
    this.volatilityProfiles.set('detailed-dashboard-data', {
      changeFrequency: 'medium',
      businessHours: false,
      userActivityImpact: false,
      priority: 'normal'
    });

    // User profile data
    this.volatilityProfiles.set('user-profile', {
      changeFrequency: 'low',
      businessHours: false,
      userActivityImpact: true,
      priority: 'important'
    });

    // Analytics data
    this.volatilityProfiles.set('analytics', {
      changeFrequency: 'low',
      businessHours: false,
      userActivityImpact: false,
      priority: 'normal'
    });

    // Real-time data
    this.volatilityProfiles.set('realtime', {
      changeFrequency: 'realtime',
      businessHours: true,
      userActivityImpact: true,
      priority: 'critical'
    });
  }

  private initializeDefaultStrategies(): void {
    // Critical data strategy
    this.ttlStrategies.set('critical', {
      baseTTL: 15 * 1000, // 15 seconds
      minTTL: 5 * 1000,   // 5 seconds
      maxTTL: 60 * 1000,  // 60 seconds
      volatilityMultiplier: 0.5,
      timeOfDayMultiplier: 1.2,
      activityMultiplier: 0.8,
      priorityMultiplier: 1.0
    });

    // Important data strategy
    this.ttlStrategies.set('important', {
      baseTTL: 30 * 1000, // 30 seconds
      minTTL: 10 * 1000,  // 10 seconds
      maxTTL: 120 * 1000, // 2 minutes
      volatilityMultiplier: 0.7,
      timeOfDayMultiplier: 1.3,
      activityMultiplier: 0.9,
      priorityMultiplier: 1.1
    });

    // Normal data strategy
    this.ttlStrategies.set('normal', {
      baseTTL: 60 * 1000, // 1 minute
      minTTL: 30 * 1000,  // 30 seconds
      maxTTL: 300 * 1000, // 5 minutes
      volatilityMultiplier: 0.8,
      timeOfDayMultiplier: 1.5,
      activityMultiplier: 1.0,
      priorityMultiplier: 1.2
    });

    // Low priority data strategy
    this.ttlStrategies.set('low', {
      baseTTL: 300 * 1000, // 5 minutes
      minTTL: 60 * 1000,   // 1 minute
      maxTTL: 1800 * 1000, // 30 minutes
      volatilityMultiplier: 1.0,
      timeOfDayMultiplier: 2.0,
      activityMultiplier: 1.2,
      priorityMultiplier: 1.5
    });
  }

  calculateOptimalTTL(
    dataType: string,
    context: TTLCalculationContext
  ): number {
    const profile = this.volatilityProfiles.get(dataType);
    if (!profile) {
      return this.getDefaultTTL();
    }

    const strategy = this.ttlStrategies.get(profile.priority);
    if (!strategy) {
      return this.getDefaultTTL();
    }

    let ttl = strategy.baseTTL;

    // Apply volatility multiplier
    ttl *= this.getVolatilityMultiplier(profile.changeFrequency);

    // Apply time of day multiplier
    ttl *= this.getTimeOfDayMultiplier(context.timeOfDay, profile.businessHours);

    // Apply user activity multiplier
    if (profile.userActivityImpact && context.userProfile) {
      ttl *= this.getUserActivityMultiplier(context.userProfile);
    }

    // Apply system load multiplier
    ttl *= this.getSystemLoadMultiplier(context.systemLoad);

    // Apply priority multiplier
    ttl *= strategy.priorityMultiplier;

    // Apply day of week multiplier (weekends might have different patterns)
    ttl *= this.getDayOfWeekMultiplier(context.dayOfWeek);

    // Ensure TTL is within bounds
    ttl = Math.max(strategy.minTTL, Math.min(strategy.maxTTL, ttl));

    // Record access pattern for future optimization
    this.recordAccessPattern(dataType);

    return Math.round(ttl);
  }

  private getVolatilityMultiplier(changeFrequency: string): number {
    switch (changeFrequency) {
      case 'realtime':
        return 0.1; // Very short cache for realtime data
      case 'high':
        return 0.3;
      case 'medium':
        return 0.6;
      case 'low':
        return 1.0;
      default:
        return 0.8;
    }
  }

  private getTimeOfDayMultiplier(timeOfDay: Date, businessHours: boolean): number {
    const hour = timeOfDay.getHours();
    
    if (!businessHours) {
      return 1.0; // No time-based adjustment for non-business data
    }

    // Business hours typically 9 AM - 6 PM
    if (hour >= 9 && hour <= 18) {
      return 0.8; // Shorter TTL during business hours for fresher data
    } else if (hour >= 19 && hour <= 23) {
      return 1.2; // Longer TTL in evening
    } else {
      return 1.5; // Longest TTL overnight
    }
  }

  private getUserActivityMultiplier(userProfile: {
    isActive: boolean;
    lastActivity: Date;
    role: string;
  }): number {
    const now = new Date();
    const timeSinceLastActivity = now.getTime() - userProfile.lastActivity.getTime();
    const hoursSinceActivity = timeSinceLastActivity / (1000 * 60 * 60);

    if (userProfile.isActive && hoursSinceActivity < 1) {
      return 0.7; // Shorter TTL for active users
    } else if (hoursSinceActivity < 24) {
      return 1.0; // Normal TTL for recently active users
    } else {
      return 1.3; // Longer TTL for inactive users
    }
  }

  private getSystemLoadMultiplier(systemLoad: 'low' | 'medium' | 'high'): number {
    switch (systemLoad) {
      case 'high':
        return 1.5; // Longer TTL under high load to reduce pressure
      case 'medium':
        return 1.2;
      case 'low':
        return 0.9; // Shorter TTL when system has capacity
      default:
        return 1.0;
    }
  }

  private getDayOfWeekMultiplier(dayOfWeek: number): number {
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 1.3; // Longer TTL on weekends
    } else {
      return 1.0; // Normal TTL on weekdays
    }
  }

  private recordAccessPattern(dataType: string): void {
    const current = this.accessPatterns.get(dataType) || { count: 0, lastAccess: new Date() };
    this.accessPatterns.set(dataType, {
      count: current.count + 1,
      lastAccess: new Date()
    });
  }

  private getDefaultTTL(): number {
    return 60 * 1000; // 1 minute default
  }

  // Public methods for configuration and monitoring
  registerVolatilityProfile(dataType: string, profile: DataVolatilityProfile): void {
    this.volatilityProfiles.set(dataType, profile);
  }

  registerTTLStrategy(priority: string, strategy: TTLStrategy): void {
    this.ttlStrategies.set(priority, strategy);
  }

  getAccessPattern(dataType: string): { count: number; lastAccess: Date } | undefined {
    return this.accessPatterns.get(dataType);
  }

  getAllAccessPatterns(): Map<string, { count: number; lastAccess: Date }> {
    return new Map(this.accessPatterns);
  }

  // Method to get recommended refresh time (70-90% of TTL)
  getRecommendedRefreshTime(dataType: string, context: TTLCalculationContext): number {
    const ttl = this.calculateOptimalTTL(dataType, context);
    const refreshPercentage = 0.7 + Math.random() * 0.2; // Random between 70-90%
    return Math.round(ttl * refreshPercentage);
  }

  // Method to adjust TTL based on cache hit/miss patterns
  adjustTTLBasedOnPerformance(
    dataType: string,
    currentTTL: number,
    hitRate: number,
    missRate: number
  ): number {
    const pattern = this.accessPatterns.get(dataType);
    if (!pattern) {
      return currentTTL;
    }

    // If hit rate is high, we can increase TTL
    if (hitRate > 0.8) {
      return Math.min(currentTTL * 1.2, 300 * 1000); // Cap at 5 minutes
    }
    
    // If miss rate is high, decrease TTL
    if (missRate > 0.3) {
      return Math.max(currentTTL * 0.8, 5 * 1000); // Minimum 5 seconds
    }

    return currentTTL;
  }
}

export const adaptiveTTLEngine = AdaptiveTTLEngine.getInstance();