// ============================================
// KPI Dashboard Configuration for Next.js 16
// ============================================
// This file defines KPIs and success metrics for monitoring application performance

export interface KPI {
  id: string;
  name: string;
  description: string;
  category: 'performance' | 'business' | 'technical' | 'user-experience';
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  unit: string;
  target: {
    value: number;
    operator: '>' | '<' | '>=' | '<=' | '=';
    timeframe: 'realtime' | '1m' | '5m' | '15m' | '1h' | '24h' | '7d' | '30d';
  };
  alerts: {
    warning: number;
    critical: number;
    enabled: boolean;
  };
  metadata: {
    owner: string;
    jiraTicket?: string;
    lastReviewed: string;
    importance: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface KPICategory {
  name: string;
  description: string;
  kpis: KPI[];
  weight: number; // Weight in overall score calculation
}

export const kpiCategories: KPICategory[] = [
  {
    name: 'Performance Metrics',
    description: 'Core performance indicators for Next.js 16 application',
    weight: 0.3,
    kpis: [
      {
        id: 'page_load_time',
        name: 'Page Load Time',
        description: 'Average time to fully load pages',
        category: 'performance',
        type: 'histogram',
        unit: 'ms',
        target: {
          value: 2000,
          operator: '<',
          timeframe: '5m'
        },
        alerts: {
          warning: 3000,
          critical: 5000,
          enabled: true
        },
        metadata: {
          owner: 'Performance Team',
          jiraTicket: 'PERF-001',
          lastReviewed: '2025-10-30T11:26:19.532Z',
          importance: 'critical'
        }
      },
      {
        id: 'first_contentful_paint',
        name: 'First Contentful Paint',
        description: 'Time to first contentful paint',
        category: 'performance',
        type: 'histogram',
        unit: 'ms',
        target: {
          value: 1500,
          operator: '<',
          timeframe: '5m'
        },
        alerts: {
          warning: 2000,
          critical: 3000,
          enabled: true
        },
        metadata: {
          owner: 'Frontend Team',
          jiraTicket: 'PERF-002',
          lastReviewed: '2025-10-30T11:26:19.532Z',
          importance: 'high'
        }
      },
      {
        id: 'largest_contentful_paint',
        name: 'Largest Contentful Paint',
        description: 'Time to largest contentful paint',
        category: 'performance',
        type: 'histogram',
        unit: 'ms',
        target: {
          value: 2500,
          operator: '<',
          timeframe: '5m'
        },
        alerts: {
          warning: 3500,
          critical: 5000,
          enabled: true
        },
        metadata: {
          owner: 'Frontend Team',
          jiraTicket: 'PERF-003',
          lastReviewed: '2025-10-30T11:26:19.532Z',
          importance: 'high'
        }
      },
      {
        id: 'api_response_time',
        name: 'API Response Time',
        description: 'Average API endpoint response time',
        category: 'performance',
        type: 'histogram',
        unit: 'ms',
        target: {
          value: 500,
          operator: '<',
          timeframe: '5m'
        },
        alerts: {
          warning: 1000,
          critical: 2000,
          enabled: true
        },
        metadata: {
          owner: 'Backend Team',
          jiraTicket: 'API-001',
          lastReviewed: '2025-10-30T11:26:19.532Z',
          importance: 'critical'
        }
      },
      {
        id: 'error_rate',
        name: 'Error Rate',
        description: 'Percentage of requests resulting in errors',
        category: 'performance',
        type: 'gauge',
        unit: '%',
        target: {
          value: 1,
          operator: '<',
          timeframe: '5m'
        },
        alerts: {
          warning: 2,
          critical: 5,
          enabled: true
        },
        metadata: {
          owner: 'DevOps Team',
          jiraTicket: 'ERROR-001',
          lastReviewed: '2025-10-30T11:26:19.532Z',
          importance: 'critical'
        }
      }
    ]
  },
  {
    name: 'Business Metrics',
    description: 'Key business performance indicators',
    weight: 0.25,
    kpis: [
      {
        id: 'daily_active_users',
        name: 'Daily Active Users',
        description: 'Number of unique users per day',
        category: 'business',
        type: 'counter',
        unit: 'users',
        target: {
          value: 1000,
          operator: '>=',
          timeframe: '24h'
        },
        alerts: {
          warning: 500,
          critical: 100,
          enabled: true
        },
        metadata: {
          owner: 'Product Team',
          jiraTicket: 'BUSINESS-001',
          lastReviewed: '2025-10-30T11:26:19.532Z',
          importance: 'high'
        }
      },
      {
        id: 'user_session_duration',
        name: 'User Session Duration',
        description: 'Average time users spend in the application',
        category: 'business',
        type: 'histogram',
        unit: 'minutes',
        target: {
          value: 10,
          operator: '>=',
          timeframe: '24h'
        },
        alerts: {
          warning: 5,
          critical: 2,
          enabled: true
        },
        metadata: {
          owner: 'Product Team',
          jiraTicket: 'BUSINESS-002',
          lastReviewed: '2025-10-30T11:26:19.532Z',
          importance: 'medium'
        }
      },
      {
        id: 'conversion_rate',
        name: 'Conversion Rate',
        description: 'Percentage of users completing target actions',
        category: 'business',
        type: 'gauge',
        unit: '%',
        target: {
          value: 5,
          operator: '>=',
          timeframe: '7d'
        },
        alerts: {
          warning: 3,
          critical: 1,
          enabled: true
        },
        metadata: {
          owner: 'Marketing Team',
          jiraTicket: 'BUSINESS-003',
          lastReviewed: '2025-10-30T11:26:19.532Z',
          importance: 'high'
        }
      }
    ]
  },
  {
    name: 'Technical Metrics',
    description: 'Infrastructure and technical health indicators',
    weight: 0.2,
    kpis: [
      {
        id: 'server_uptime',
        name: 'Server Uptime',
        description: 'Percentage of time servers are operational',
        category: 'technical',
        type: 'gauge',
        unit: '%',
        target: {
          value: 99.9,
          operator: '>=',
          timeframe: '30d'
        },
        alerts: {
          warning: 99.5,
          critical: 99.0,
          enabled: true
        },
        metadata: {
          owner: 'DevOps Team',
          jiraTicket: 'TECH-001',
          lastReviewed: '2025-10-30T11:26:19.532Z',
          importance: 'critical'
        }
      },
      {
        id: 'database_connection_pool_usage',
        name: 'Database Connection Pool Usage',
        description: 'Percentage of database connection pool in use',
        category: 'technical',
        type: 'gauge',
        unit: '%',
        target: {
          value: 80,
          operator: '<',
          timeframe: '5m'
        },
        alerts: {
          warning: 90,
          critical: 95,
          enabled: true
        },
        metadata: {
          owner: 'Database Team',
          jiraTicket: 'TECH-002',
          lastReviewed: '2025-10-30T11:26:19.532Z',
          importance: 'high'
        }
      },
      {
        id: 'memory_usage',
        name: 'Memory Usage',
        description: 'Application memory usage percentage',
        category: 'technical',
        type: 'gauge',
        unit: '%',
        target: {
          value: 80,
          operator: '<',
          timeframe: '5m'
        },
        alerts: {
          warning: 85,
          critical: 95,
          enabled: true
        },
        metadata: {
          owner: 'DevOps Team',
          jiraTicket: 'TECH-003',
          lastReviewed: '2025-10-30T11:26:19.532Z',
          importance: 'high'
        }
      },
      {
        id: 'disk_usage',
        name: 'Disk Usage',
        description: 'Server disk usage percentage',
        category: 'technical',
        type: 'gauge',
        unit: '%',
        target: {
          value: 80,
          operator: '<',
          timeframe: '1h'
        },
        alerts: {
          warning: 85,
          critical: 95,
          enabled: true
        },
        metadata: {
          owner: 'DevOps Team',
          jiraTicket: 'TECH-004',
          lastReviewed: '2025-10-30T11:26:19.532Z',
          importance: 'medium'
        }
      }
    ]
  },
  {
    name: 'User Experience Metrics',
    description: 'User satisfaction and experience indicators',
    weight: 0.25,
    kpis: [
      {
        id: 'user_satisfaction_score',
        name: 'User Satisfaction Score',
        description: 'Average user satisfaction rating (1-5 scale)',
        category: 'user-experience',
        type: 'gauge',
        unit: 'score',
        target: {
          value: 4.0,
          operator: '>=',
          timeframe: '7d'
        },
        alerts: {
          warning: 3.5,
          critical: 3.0,
          enabled: true
        },
        metadata: {
          owner: 'Product Team',
          jiraTicket: 'UX-001',
          lastReviewed: '2025-10-30T11:26:19.532Z',
          importance: 'high'
        }
      },
      {
        id: 'support_tickets',
        name: 'Support Tickets',
        description: 'Number of support tickets per day',
        category: 'user-experience',
        type: 'counter',
        unit: 'tickets',
        target: {
          value: 50,
          operator: '<',
          timeframe: '24h'
        },
        alerts: {
          warning: 75,
          critical: 100,
          enabled: true
        },
        metadata: {
          owner: 'Support Team',
          jiraTicket: 'UX-002',
          lastReviewed: '2025-10-30T11:26:19.532Z',
          importance: 'medium'
        }
      },
      {
        id: 'feature_adoption_rate',
        name: 'Feature Adoption Rate',
        description: 'Percentage of users using new Next.js 16 features',
        category: 'user-experience',
        type: 'gauge',
        unit: '%',
        target: {
          value: 70,
          operator: '>=',
          timeframe: '7d'
        },
        alerts: {
          warning: 50,
          critical: 30,
          enabled: true
        },
        metadata: {
          owner: 'Product Team',
          jiraTicket: 'UX-003',
          lastReviewed: '2025-10-30T11:26:19.532Z',
          importance: 'medium'
        }
      }
    ]
  }
];

// KPI Dashboard Functions
export class KPIDashboard {
  private kpis: Map<string, KPI> = new Map();

  constructor() {
    // Flatten all KPIs into a map for easy access
    kpiCategories.forEach(category => {
      category.kpis.forEach(kpi => {
        this.kpis.set(kpi.id, kpi);
      });
    });
  }

  getKPI(id: string): KPI | undefined {
    return this.kpis.get(id);
  }

  getKPIsByCategory(category: string): KPI[] {
    return Array.from(this.kpis.values()).filter(kpi => kpi.category === category);
  }

  getAllKPIs(): KPI[] {
    return Array.from(this.kpis.values());
  }

  getKPIsByImportance(importance: 'low' | 'medium' | 'high' | 'critical'): KPI[] {
    return Array.from(this.kpis.values()).filter(kpi => kpi.metadata.importance === importance);
  }

  calculateOverallScore(currentValues: Record<string, number>): {
    totalScore: number;
    categoryScores: Record<string, number>;
    status: 'excellent' | 'good' | 'warning' | 'critical';
  } {
    const categoryScores: Record<string, number> = {};
    let totalScore = 0;

    kpiCategories.forEach(category => {
      let categoryScore = 0;
      let totalWeight = 0;

      category.kpis.forEach(kpi => {
        const currentValue = currentValues[kpi.id];
        if (currentValue !== undefined) {
          const isMeetingTarget = this.evaluateTarget(kpi, currentValue);
          const score = isMeetingTarget ? 100 : Math.max(0, 100 - Math.abs(currentValue - kpi.target.value) / kpi.target.value * 100);
          categoryScore += score * (kpi.metadata.importance === 'critical' ? 2 : 1);
          totalWeight += (kpi.metadata.importance === 'critical' ? 2 : 1);
        }
      });

      if (totalWeight > 0) {
        categoryScores[category.name] = categoryScore / totalWeight;
        totalScore += (categoryScores[category.name] / 100) * category.weight;
      }
    });

    totalScore = totalScore * 100;

    let status: 'excellent' | 'good' | 'warning' | 'critical';
    if (totalScore >= 90) status = 'excellent';
    else if (totalScore >= 80) status = 'good';
    else if (totalScore >= 70) status = 'warning';
    else status = 'critical';

    return {
      totalScore,
      categoryScores,
      status
    };
  }

  private evaluateTarget(kpi: KPI, currentValue: number): boolean {
    const target = kpi.target;
    switch (target.operator) {
      case '>': return currentValue > target.value;
      case '<': return currentValue < target.value;
      case '>=': return currentValue >= target.value;
      case '<=': return currentValue <= target.value;
      case '=': return currentValue === target.value;
      default: return false;
    }
  }

  getAlerts(currentValues: Record<string, number>): Array<{
    kpiId: string;
    kpiName: string;
    severity: 'warning' | 'critical';
    currentValue: number;
    threshold: number;
    message: string;
  }> {
    const alerts: Array<{
      kpiId: string;
      kpiName: string;
      severity: 'warning' | 'critical';
      currentValue: number;
      threshold: number;
      message: string;
    }> = [];

    this.kpis.forEach(kpi => {
      const currentValue = currentValues[kpi.id];
      if (currentValue !== undefined && kpi.alerts.enabled) {
        if (currentValue >= kpi.alerts.critical) {
          alerts.push({
            kpiId: kpi.id,
            kpiName: kpi.name,
            severity: 'critical',
            currentValue,
            threshold: kpi.alerts.critical,
            message: `${kpi.name} is at critical level: ${currentValue}${kpi.unit} (threshold: ${kpi.alerts.critical}${kpi.unit})`
          });
        } else if (currentValue >= kpi.alerts.warning) {
          alerts.push({
            kpiId: kpi.id,
            kpiName: kpi.name,
            severity: 'warning',
            currentValue,
            threshold: kpi.alerts.warning,
            message: `${kpi.name} is at warning level: ${currentValue}${kpi.unit} (threshold: ${kpi.alerts.warning}${kpi.unit})`
          });
        }
      }
    });

    return alerts;
  }

  generateKPIDashboardData(currentValues: Record<string, number> = {}) {
    const overallScore = this.calculateOverallScore(currentValues);
    const alerts = this.getAlerts(currentValues);

    return {
      timestamp: new Date().toISOString(),
      overallScore,
      categories: kpiCategories.map(category => ({
        name: category.name,
        description: category.description,
        weight: category.weight,
        score: overallScore.categoryScores[category.name] || 0,
        kpis: category.kpis.map(kpi => ({
          ...kpi,
          currentValue: currentValues[kpi.id],
          isMeetingTarget: currentValues[kpi.id] !== undefined ? this.evaluateTarget(kpi, currentValues[kpi.id]) : undefined
        }))
      })),
      alerts,
      summary: {
        totalKPIs: this.kpis.size,
        criticalKPIs: this.getKPIsByImportance('critical').length,
        alertsCount: alerts.length,
        criticalAlerts: alerts.filter(a => a.severity === 'critical').length
      }
    };
  }
}

// Export singleton instance
export const kpiDashboard = new KPIDashboard();

// Utility functions
export const getKPIDashboardData = (currentValues?: Record<string, number>) => {
  return kpiDashboard.generateKPIDashboardData(currentValues);
};

export const getKPIAlerts = (currentValues: Record<string, number>) => {
  return kpiDashboard.getAlerts(currentValues);
};

export const calculateOverallKPIScore = (currentValues: Record<string, number>) => {
  return kpiDashboard.calculateOverallScore(currentValues);
};