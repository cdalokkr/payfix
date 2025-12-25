// ============================================
// Comprehensive Monitoring Setup for Next.js 16
// ============================================
// This file configures monitoring, alerting, and performance tracking

import { NextRequest, NextResponse } from 'next/server';

export interface MonitoringConfig {
  enabled: boolean;
  environment: 'development' | 'staging' | 'production';
  services: {
    sentry?: {
      dsn: string;
      tracesSampleRate: number;
      replaysOnErrorSampleRate: number;
    };
    datadog?: {
      apiKey: string;
      applicationId: string;
    };
    newRelic?: {
      licenseKey: string;
      applicationId: string;
    };
  };
  alerts: {
    errorRateThreshold: number;
    responseTimeThreshold: number;
    memoryUsageThreshold: number;
    diskUsageThreshold: number;
  };
  metrics: {
    collectPerformanceMetrics: boolean;
    collectUserMetrics: boolean;
    collectBusinessMetrics: boolean;
  };
}

export const monitoringConfig: MonitoringConfig = {
  enabled: process.env.NODE_ENV === 'production',
  environment: (process.env.NODE_ENV as any) || 'development',
  services: {
    sentry: process.env.SENTRY_DSN ? {
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),
      replaysOnErrorSampleRate: parseFloat(process.env.SENTRY_REPLAYS_SAMPLE_RATE || '1.0')
    } : undefined,
    datadog: process.env.DD_API_KEY ? {
      apiKey: process.env.DD_API_KEY,
      applicationId: process.env.DD_APPLICATION_ID || ''
    } : undefined,
    newRelic: process.env.NEW_RELIC_LICENSE_KEY ? {
      licenseKey: process.env.NEW_RELIC_LICENSE_KEY,
      applicationId: process.env.NEW_RELIC_APP_ID || ''
    } : undefined
  },
  alerts: {
    errorRateThreshold: parseFloat(process.env.ALERT_ERROR_RATE || '0.05'), // 5%
    responseTimeThreshold: parseInt(process.env.ALERT_RESPONSE_TIME || '2000'), // 2 seconds
    memoryUsageThreshold: parseFloat(process.env.ALERT_MEMORY_USAGE || '0.8'), // 80%
    diskUsageThreshold: parseFloat(process.env.ALERT_DISK_USAGE || '0.85') // 85%
  },
  metrics: {
    collectPerformanceMetrics: process.env.COLLECT_PERFORMANCE_METRICS !== 'false',
    collectUserMetrics: process.env.COLLECT_USER_METRICS !== 'false',
    collectBusinessMetrics: process.env.COLLECT_BUSINESS_METRICS !== 'false'
  }
};

// Performance Metrics Collector
export class PerformanceMetricsCollector {
  private metrics: Map<string, any[]> = new Map();

  trackMetric(name: string, value: number, tags?: Record<string, string>) {
    if (!monitoringConfig.metrics.collectPerformanceMetrics) return;

    const metric = {
      name,
      value,
      tags: tags || {},
      timestamp: Date.now()
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(metric);

    // Send to monitoring services
    this.sendToMonitoringServices(metric);
  }

  trackApiCall(endpoint: string, method: string, duration: number, statusCode: number, userId?: string) {
    this.trackMetric('api_call_duration', duration, {
      endpoint,
      method,
      status_code: statusCode.toString(),
      user_id: userId || 'anonymous'
    });

    this.trackMetric('api_call_count', 1, {
      endpoint,
      method,
      status_code: statusCode.toString()
    });
  }

  trackDatabaseQuery(table: string, operation: string, duration: number, rowsAffected?: number) {
    this.trackMetric('database_query_duration', duration, {
      table,
      operation,
      rows_affected: rowsAffected?.toString() || '0'
    });
  }

  trackUserAction(action: string, userId?: string, metadata?: Record<string, any>) {
    if (!monitoringConfig.metrics.collectUserMetrics) return;

    this.trackMetric('user_action', 1, {
      action,
      user_id: userId || 'anonymous',
      ...metadata
    });
  }

  trackBusinessMetric(name: string, value: number, metadata?: Record<string, any>) {
    if (!monitoringConfig.metrics.collectBusinessMetrics) return;

    this.trackMetric(`business_${name}`, value, metadata);
  }

  private sendToMonitoringServices(metric: any) {
    if (!monitoringConfig.enabled) return;

    // Send to DataDog
    if (monitoringConfig.services.datadog) {
      // DataDog metrics submission would go here
      console.log('📊 DataDog:', metric);
    }

    // Send to New Relic
    if (monitoringConfig.services.newRelic) {
      // New Relic metrics submission would go here
      console.log('📈 New Relic:', metric);
    }
  }

  getMetricsSummary() {
    const summary: Record<string, any> = {};

    for (const [name, metrics] of this.metrics) {
      const values = metrics.map(m => m.value);
      summary[name] = {
        count: metrics.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        latest: values[values.length - 1],
        tags: metrics[0]?.tags || {}
      };
    }

    return summary;
  }
}

// Error Tracking
export class ErrorTracker {
  trackError(error: Error, context?: {
    userId?: string;
    url?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }) {
    if (!monitoringConfig.enabled) {
      console.error('Error:', error);
      return;
    }

    const errorData = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString(),
      context: context || {}
    };

    // Send to Sentry
    if (monitoringConfig.services.sentry) {
      // Sentry error submission would go here
      console.error('🐛 Sentry Error:', errorData);
    }

    // Send to other monitoring services
    if (monitoringConfig.services.datadog) {
      console.error('📊 DataDog Error:', errorData);
    }

    // Log to console in development
    if (monitoringConfig.environment === 'development') {
      console.error('🚨 Error:', errorData);
    }
  }

  trackApiError(endpoint: string, error: Error, statusCode: number, userId?: string) {
    this.trackError(error, {
      url: endpoint,
      userId,
      metadata: {
        type: 'api_error',
        status_code: statusCode
      }
    });
  }
}

// Alert Manager
export class AlertManager {
  private alerts: Map<string, any> = new Map();

  checkThresholds(metrics: Record<string, any>) {
    const alerts: any[] = [];

    // Error rate alert
    if (metrics.api_error_rate?.avg > monitoringConfig.alerts.errorRateThreshold) {
      alerts.push({
        type: 'error_rate',
        severity: 'high',
        message: `Error rate ${metrics.api_error_rate.avg} exceeds threshold ${monitoringConfig.alerts.errorRateThreshold}`,
        value: metrics.api_error_rate.avg,
        threshold: monitoringConfig.alerts.errorRateThreshold
      });
    }

    // Response time alert
    if (metrics.api_response_time?.avg > monitoringConfig.alerts.responseTimeThreshold) {
      alerts.push({
        type: 'response_time',
        severity: 'medium',
        message: `Average response time ${metrics.api_response_time.avg}ms exceeds threshold ${monitoringConfig.alerts.responseTimeThreshold}ms`,
        value: metrics.api_response_time.avg,
        threshold: monitoringConfig.alerts.responseTimeThreshold
      });
    }

    // Memory usage alert
    if (metrics.memory_usage?.avg > monitoringConfig.alerts.memoryUsageThreshold) {
      alerts.push({
        type: 'memory_usage',
        severity: 'high',
        message: `Memory usage ${metrics.memory_usage.avg} exceeds threshold ${monitoringConfig.alerts.memoryUsageThreshold}`,
        value: metrics.memory_usage.avg,
        threshold: monitoringConfig.alerts.memoryUsageThreshold
      });
    }

    // Send alerts
    alerts.forEach(alert => this.sendAlert(alert));

    return alerts;
  }

  private sendAlert(alert: any) {
    if (!monitoringConfig.enabled) return;

    // Send to monitoring services
    if (monitoringConfig.services.datadog) {
      console.warn('🚨 DataDog Alert:', alert);
    }

    if (monitoringConfig.services.newRelic) {
      console.warn('🚨 New Relic Alert:', alert);
    }

    // Log alert
    console.warn('🚨 Alert:', alert);
  }
}

// Health Check System
export class HealthChecker {
  async performHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, any>;
    timestamp: string;
  }> {
    const checks: Record<string, any> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Database health check
    try {
      // Add your database health check logic here
      checks.database = { status: 'healthy', message: 'Database connection OK' };
    } catch (error) {
      checks.database = { status: 'unhealthy', message: error instanceof Error ? error.message : 'Database connection failed' };
      overallStatus = 'unhealthy';
    }

    // Cache health check
    try {
      // Add your cache health check logic here
      checks.cache = { status: 'healthy', message: 'Cache system OK' };
    } catch (error) {
      checks.cache = { status: 'degraded', message: error instanceof Error ? error.message : 'Cache check failed' };
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }

    // External services health check
    try {
      // Add your external services health check logic here
      checks.external_services = { status: 'healthy', message: 'External services OK' };
    } catch (error) {
      checks.external_services = { status: 'degraded', message: error instanceof Error ? error.message : 'External services check failed' };
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }

    // System resources check
    const memUsage = process.memoryUsage();
    const memPercentage = memUsage.heapUsed / memUsage.heapTotal;

    if (memPercentage > monitoringConfig.alerts.memoryUsageThreshold) {
      checks.memory = { status: 'degraded', message: `High memory usage: ${(memPercentage * 100).toFixed(1)}%` };
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    } else {
      checks.memory = { status: 'healthy', message: `Memory usage: ${(memPercentage * 100).toFixed(1)}%` };
    }

    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString()
    };
  }
}

// Middleware for monitoring
export function monitoringMiddleware(handler: any) {
  return async (request: NextRequest, context?: any) => {
    const startTime = Date.now();
    const metricsCollector = new PerformanceMetricsCollector();
    const errorTracker = new ErrorTracker();

    try {
      const response = await handler(request, context);
      const duration = Date.now() - startTime;

      // Track API call
      metricsCollector.trackApiCall(
        request.nextUrl.pathname,
        request.method,
        duration,
        response.status
      );

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Track error
      errorTracker.trackApiError(
        request.nextUrl.pathname,
        error as Error,
        500
      );

      // Track failed API call
      metricsCollector.trackApiCall(
        request.nextUrl.pathname,
        request.method,
        duration,
        500
      );

      throw error;
    }
  };
}

// Export singleton instances
export const metricsCollector = new PerformanceMetricsCollector();
export const errorTracker = new ErrorTracker();
export const alertManager = new AlertManager();
export const healthChecker = new HealthChecker();

// Utility functions
export const trackPerformance = (name: string, value: number, tags?: Record<string, string>) => {
  metricsCollector.trackMetric(name, value, tags);
};

export const trackError = (error: Error, context?: any) => {
  errorTracker.trackError(error, context);
};

export const checkHealth = () => {
  return healthChecker.performHealthCheck();
};