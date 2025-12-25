// ============================================
// Feature Flags Configuration for Next.js 16
// ============================================
// This file manages feature flags for gradual rollout and A/B testing

import React from 'react';

export interface FeatureFlag {
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  conditions?: {
    userId?: string[];
    emailDomain?: string[];
    environment?: string[];
  };
  metadata?: {
    createdAt: string;
    updatedAt: string;
    owner: string;
    jiraTicket?: string;
  };
}

export class FeatureFlagsManager {
  private flags: Map<string, FeatureFlag> = new Map();
  private static instance: FeatureFlagsManager;

  private constructor() {
    this.initializeFlags();
  }

  static getInstance(): FeatureFlagsManager {
    if (!FeatureFlagsManager.instance) {
      FeatureFlagsManager.instance = new FeatureFlagsManager();
    }
    return FeatureFlagsManager.instance;
  }

  private initializeFlags() {
    // Next.js 16 Performance Features
    this.flags.set('nextjs16-optimize-package-imports', {
      name: 'Next.js 16 Package Import Optimization',
      description: 'Enables optimized package imports for better tree shaking',
      enabled: true,
      rolloutPercentage: 100,
      metadata: {
        createdAt: '2025-10-30T11:23:47.274Z',
        updatedAt: '2025-10-30T11:23:47.274Z',
        owner: 'Kilo Code',
        jiraTicket: 'NEXTJS-16-PERF-001'
      }
    });

    this.flags.set('nextjs16-server-actions', {
      name: 'Next.js 16 Server Actions',
      description: 'Enables enhanced server actions with better error handling',
      enabled: true,
      rolloutPercentage: 100,
      metadata: {
        createdAt: '2025-10-30T11:23:47.274Z',
        updatedAt: '2025-10-30T11:23:47.274Z',
        owner: 'Kilo Code',
        jiraTicket: 'NEXTJS-16-PERF-002'
      }
    });

    this.flags.set('enhanced-caching', {
      name: 'Enhanced Smart Caching',
      description: 'Enables adaptive TTL caching with background refresh',
      enabled: true,
      rolloutPercentage: 100,
      metadata: {
        createdAt: '2025-10-30T11:23:47.274Z',
        updatedAt: '2025-10-30T11:23:47.274Z',
        owner: 'Kilo Code',
        jiraTicket: 'CACHE-OPT-001'
      }
    });

    this.flags.set('progressive-dashboard', {
      name: 'Progressive Dashboard Loading',
      description: 'Enables progressive loading for dashboard components',
      enabled: true,
      rolloutPercentage: 100,
      metadata: {
        createdAt: '2025-10-30T11:23:47.274Z',
        updatedAt: '2025-10-30T11:23:47.274Z',
        owner: 'Kilo Code',
        jiraTicket: 'DASHBOARD-PERF-001'
      }
    });

    // Security Features
    this.flags.set('enhanced-security-headers', {
      name: 'Enhanced Security Headers',
      description: 'Enables additional security headers for Next.js 16',
      enabled: true,
      rolloutPercentage: 100,
      metadata: {
        createdAt: '2025-10-30T11:23:47.274Z',
        updatedAt: '2025-10-30T11:23:47.274Z',
        owner: 'Kilo Code',
        jiraTicket: 'SECURITY-HEADERS-001'
      }
    });

    // Monitoring Features
    this.flags.set('performance-monitoring', {
      name: 'Performance Monitoring',
      description: 'Enables comprehensive performance monitoring',
      enabled: true,
      rolloutPercentage: 100,
      metadata: {
        createdAt: '2025-10-30T11:23:47.274Z',
        updatedAt: '2025-10-30T11:23:47.274Z',
        owner: 'Kilo Code',
        jiraTicket: 'MONITORING-001'
      }
    });

    this.flags.set('error-tracking', {
      name: 'Error Tracking',
      description: 'Enables enhanced error tracking and reporting',
      enabled: true,
      rolloutPercentage: 100,
      metadata: {
        createdAt: '2025-10-30T11:23:47.274Z',
        updatedAt: '2025-10-30T11:23:47.274Z',
        owner: 'Kilo Code',
        jiraTicket: 'ERROR-TRACKING-001'
      }
    });

    // Experimental Features (Gradual Rollout)
    this.flags.set('experimental-features', {
      name: 'Experimental Features',
      description: 'Enables experimental Next.js 16 features for testing',
      enabled: false,
      rolloutPercentage: 10,
      conditions: {
        userId: ['admin-user-1', 'admin-user-2'], // Specific users for testing
        environment: ['development', 'staging']
      },
      metadata: {
        createdAt: '2025-10-30T11:23:47.274Z',
        updatedAt: '2025-10-30T11:23:47.274Z',
        owner: 'Kilo Code',
        jiraTicket: 'EXPERIMENTAL-001'
      }
    });
  }

  isEnabled(flagName: string, context?: {
    userId?: string;
    email?: string;
    environment?: string;
  }): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) {
      console.warn(`Feature flag '${flagName}' not found`);
      return false;
    }

    if (!flag.enabled) {
      return false;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const userHash = this.getUserHash(context?.userId || 'anonymous');
      if (userHash > flag.rolloutPercentage) {
        return false;
      }
    }

    // Check conditions
    if (flag.conditions && context) {
      if (flag.conditions.userId && context.userId) {
        if (!flag.conditions.userId.includes(context.userId)) {
          return false;
        }
      }

      if (flag.conditions.emailDomain && context.email) {
        const domain = context.email.split('@')[1];
        if (!flag.conditions.emailDomain.includes(domain)) {
          return false;
        }
      }

      if (flag.conditions.environment && context.environment) {
        if (!flag.conditions.environment.includes(context.environment)) {
          return false;
        }
      }
    }

    return true;
  }

  private getUserHash(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }

  getFlag(flagName: string): FeatureFlag | undefined {
    return this.flags.get(flagName);
  }

  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  updateFlag(flagName: string, updates: Partial<FeatureFlag>): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) {
      return false;
    }

    this.flags.set(flagName, {
      ...flag,
      ...updates,
      metadata: {
        ...flag.metadata,
        createdAt: flag.metadata?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        owner: flag.metadata?.owner || 'System'
      }
    });

    return true;
  }

  getFlagsByStatus(enabled: boolean): FeatureFlag[] {
    return Array.from(this.flags.values()).filter(flag => flag.enabled === enabled);
  }

  getFlagsByRolloutPercentage(minPercentage: number, maxPercentage: number): FeatureFlag[] {
    return Array.from(this.flags.values()).filter(flag =>
      flag.rolloutPercentage >= minPercentage && flag.rolloutPercentage <= maxPercentage
    );
  }
}

// Export singleton instance
export const featureFlags = FeatureFlagsManager.getInstance();

// Utility functions for components
export const useFeatureFlag = (flagName: string, context?: Parameters<FeatureFlagsManager['isEnabled']>[1]) => {
  return featureFlags.isEnabled(flagName, context);
};

export const withFeatureFlag = <P extends object>(
  Component: React.ComponentType<P>,
  flagName: string,
  FallbackComponent?: React.ComponentType<P>
) => {
  return (props: P) => {
    if (featureFlags.isEnabled(flagName)) {
      return React.createElement(Component, props);
    }

    if (FallbackComponent) {
      return React.createElement(FallbackComponent, props);
    }

    return null;
  };
};

// Server-side feature flag checking
export const checkFeatureFlag = (flagName: string, context?: Parameters<FeatureFlagsManager['isEnabled']>[1]) => {
  return featureFlags.isEnabled(flagName, context);
};

// Admin utilities for managing flags
export const getFeatureFlagsReport = () => {
  const allFlags = featureFlags.getAllFlags();
  const enabledFlags = featureFlags.getFlagsByStatus(true);
  const disabledFlags = featureFlags.getFlagsByStatus(false);
  const partialRollout = featureFlags.getFlagsByRolloutPercentage(1, 99);

  return {
    total: allFlags.length,
    enabled: enabledFlags.length,
    disabled: disabledFlags.length,
    partialRollout: partialRollout.length,
    flags: allFlags.map(flag => ({
      name: flag.name,
      enabled: flag.enabled,
      rolloutPercentage: flag.rolloutPercentage,
      description: flag.description,
      owner: flag.metadata?.owner,
      jiraTicket: flag.metadata?.jiraTicket
    }))
  };
};