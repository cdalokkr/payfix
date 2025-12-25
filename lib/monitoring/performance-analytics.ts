/**
 * Performance Analytics System
 * Integrates performance tracking with analytics services and automated testing
 */

import { webVitalsMonitor, WebVitalRecord, CustomMetric, PERFORMANCE_THRESHOLDS } from './web-vitals';

// Analytics configuration
export interface AnalyticsConfig {
  serviceProvider: 'google-analytics' | 'mixpanel' | 'custom' | 'none';
  reportingEndpoint?: string;
  batchSize: number;
  flushInterval: number; // milliseconds
  enableAutomatedReporting: boolean;
  performanceBudgets: PerformanceBudgets;
  regressionDetection: RegressionConfig;
}

// Performance budget thresholds
export interface PerformanceBudgets {
  LCP: number;
  FID: number;
  FCP: number;
  CLS: number;
  TTFB: number;
  INP: number;
  totalPageWeight: number;
  scriptSize: number;
  cssSize: number;
  imageSize: number;
  requestCount: number;
}

// Regression detection configuration
export interface RegressionConfig {
  enabled: boolean;
  thresholdPercentage: number; // % regression to trigger alert
  historicalDataPoints: number;
  confidenceLevel: number; // 0-1
}

// Performance metrics aggregation
export interface AggregatedMetrics {
  timestamp: number;
  period: 'hour' | 'day' | 'week' | 'month';
  metrics: {
    average: Record<string, number>;
    median: Record<string, number>;
    percentiles: {
      p50: Record<string, number>;
      p75: Record<string, number>;
      p90: Record<string, number>;
      p95: Record<string, number>;
      p99: Record<string, number>;
    };
    counts: Record<string, { good: number; needsImprovement: number; poor: number }>;
    trend: Record<string, 'improving' | 'stable' | 'regressing'>;
  };
  performanceScore: number;
  issues: PerformanceIssue[];
}

// Performance issue detected
export interface PerformanceIssue {
  id: string;
  type: 'budget-exceeded' | 'regression' | 'threshold-breach' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  currentValue: number;
  threshold: number;
  description: string;
  recommendations: string[];
  timestamp: number;
  resolved: boolean;
}

// Automated test results
export interface PerformanceTestResult {
  testId: string;
  timestamp: number;
  url: string;
  userAgent: string;
  results: {
    webVitals: Record<string, { value: number; rating: string; pass: boolean }>;
    customMetrics: Record<string, { value: number; target: number; pass: boolean }>;
    budgets: Record<string, { current: number; budget: number; pass: boolean }>;
    overallScore: number;
    overallPass: boolean;
  };
  screenshots?: string[];
  metrics: WebVitalRecord[];
  customMetrics: CustomMetric[];
}

// Analytics data export format
export interface AnalyticsExport {
  version: string;
  timestamp: number;
  environment: string;
  aggregatedMetrics: AggregatedMetrics[];
  testResults: PerformanceTestResult[];
  issues: PerformanceIssue[];
  summary: {
    totalTests: number;
    totalIssues: number;
    averageScore: number;
    topIssues: string[];
  };
}

// Performance analytics class
export class PerformanceAnalytics {
  private config: AnalyticsConfig;
  private buffer: WebVitalRecord[] = [];
  private customMetricsBuffer: CustomMetric[] = [];
  private batchMetrics: WebVitalRecord[] = [];
  private batchCustomMetrics: CustomMetric[] = [];
  private flushTimer?: NodeJS.Timeout;
  private historicalData: AggregatedMetrics[] = [];
  private currentIssues: PerformanceIssue[] = [];
  private testResults: PerformanceTestResult[] = [];

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = {
      serviceProvider: 'none',
      batchSize: 50,
      flushInterval: 30000, // 30 seconds
      enableAutomatedReporting: true,
      performanceBudgets: {
        LCP: 2500,
        FID: 100,
        FCP: 1800,
        CLS: 0.1,
        TTFB: 800,
        INP: 200,
        totalPageWeight: 1600, // KB
        scriptSize: 170, // KB
        cssSize: 80, // KB
        imageSize: 1000, // KB
        requestCount: 50,
      },
      regressionDetection: {
        enabled: true,
        thresholdPercentage: 10, // 10% regression
        historicalDataPoints: 10,
        confidenceLevel: 0.8,
      },
      ...config,
    };

    this.initializeAnalytics();
  }

  /**
   * Initialize analytics system
   */
  private initializeAnalytics(): void {
    // Connect to Web Vitals monitor
    webVitalsMonitor.initialize((metric) => {
      this.processMetric(metric);
    });

    // Start automated reporting
    if (this.config.enableAutomatedReporting) {
      this.startAutomatedReporting();
    }

    // Start regression detection
    if (this.config.regressionDetection.enabled) {
      this.startRegressionDetection();
    }

    console.log('Performance Analytics initialized');
  }

  /**
   * Process incoming Web Vital metrics
   */
  private processMetric(metric: WebVitalRecord): void {
    this.buffer.push(metric);
    this.batchMetrics.push(metric);

    // Check performance budgets
    this.checkPerformanceBudgets(metric);

    // Process batch if size exceeded
    if (this.batchMetrics.length >= this.config.batchSize) {
      this.flushBatch();
    }
  }

  /**
   * Process custom metrics
   */
  public processCustomMetric(metric: CustomMetric): void {
    this.customMetricsBuffer.push(metric);
    this.batchCustomMetrics.push(metric);

    // Check budget for custom metrics
    this.checkCustomMetricBudgets(metric);

    if (this.batchCustomMetrics.length >= this.config.batchSize) {
      this.flushBatch();
    }
  }

  /**
   * Check performance budgets against current metrics
   */
  private checkPerformanceBudgets(metric: WebVitalRecord): void {
    const budget = this.config.performanceBudgets[metric.metric as keyof typeof this.config.performanceBudgets];
    
    if (budget && metric.value > budget) {
      const issue: PerformanceIssue = {
        id: `budget-${metric.metric}-${Date.now()}`,
        type: 'budget-exceeded',
        severity: metric.value > budget * 1.5 ? 'critical' : 'high',
        metric: metric.metric,
        currentValue: metric.value,
        threshold: budget,
        description: `${metric.metric} value ${metric.value}ms exceeds budget of ${budget}ms`,
        recommendations: this.getBudgetRecommendations(metric.metric, metric.value, budget),
        timestamp: metric.timestamp,
        resolved: false,
      };

      this.currentIssues.push(issue);
      this.handleIssue(issue);
    }
  }

  /**
   * Check custom metric budgets
   */
  private checkCustomMetricBudgets(metric: CustomMetric): void {
    // Check for script size, CSS size, etc.
    if (metric.name === 'resource_timing' && metric.metadata?.transferSize) {
      const sizeInKB = metric.metadata.transferSize / 1024;
      
      if (metric.metadata.name?.includes('.js') && sizeInKB > this.config.performanceBudgets.scriptSize) {
        this.createIssue('budget-exceeded', 'scriptSize', sizeInKB, this.config.performanceBudgets.scriptSize, 
          'JavaScript bundle size exceeds budget');
      }
      
      if (metric.metadata.name?.includes('.css') && sizeInKB > this.config.performanceBudgets.cssSize) {
        this.createIssue('budget-exceeded', 'cssSize', sizeInKB, this.config.performanceBudgets.cssSize, 
          'CSS bundle size exceeds budget');
      }
    }
  }

  /**
   * Create performance issue
   */
  private createIssue(
    type: PerformanceIssue['type'],
    metric: string,
    currentValue: number,
    threshold: number,
    description: string
  ): void {
    const issue: PerformanceIssue = {
      id: `${type}-${metric}-${Date.now()}`,
      type,
      severity: currentValue > threshold * 1.5 ? 'critical' : 'high',
      metric,
      currentValue,
      threshold,
      description,
      recommendations: this.getBudgetRecommendations(metric, currentValue, threshold),
      timestamp: Date.now(),
      resolved: false,
    };

    this.currentIssues.push(issue);
    this.handleIssue(issue);
  }

  /**
   * Get budget recommendations
   */
  private getBudgetRecommendations(metric: string, current: number, budget: number): string[] {
    const recommendations: string[] = [];

    switch (metric) {
      case 'LCP':
        if (current > budget * 1.5) {
          recommendations.push('Optimize largest content element loading');
          recommendations.push('Use image optimization and proper sizing');
          recommendations.push('Implement resource hints (preload, prefetch)');
        }
        break;
      case 'FID':
        recommendations.push('Reduce JavaScript execution time');
        recommendations.push('Use code splitting and lazy loading');
        recommendations.push('Optimize event handlers');
        break;
      case 'CLS':
        recommendations.push('Set explicit dimensions for images and videos');
        recommendations.push('Reserve space for dynamic content');
        recommendations.push('Avoid inserting content above existing content');
        break;
      case 'TTFB':
        recommendations.push('Optimize server response time');
        recommendations.push('Use CDN for static assets');
        recommendations.push('Implement proper caching strategies');
        break;
      default:
        recommendations.push('Review performance monitoring dashboard for detailed insights');
    }

    return recommendations;
  }

  /**
   * Handle performance issue
   */
  private handleIssue(issue: PerformanceIssue): void {
    // Log to console for immediate visibility
    console.warn(`Performance Issue [${issue.severity.toUpperCase()}]: ${issue.description}`);

    // Send to analytics service
    this.sendToAnalytics(issue);

    // Trigger alerts if critical
    if (issue.severity === 'critical') {
      this.triggerCriticalAlert(issue);
    }
  }

  /**
   * Send data to analytics service
   */
  private async sendToAnalytics(data: any): Promise<void> {
    if (this.config.serviceProvider === 'none') {
      return;
    }

    try {
      switch (this.config.serviceProvider) {
        case 'google-analytics':
          await this.sendToGoogleAnalytics(data);
          break;
        case 'mixpanel':
          await this.sendToMixpanel(data);
          break;
        case 'custom':
          if (this.config.reportingEndpoint) {
            await this.sendToCustomEndpoint(data);
          }
          break;
      }
    } catch (error) {
      console.error('Failed to send analytics data:', error);
    }
  }

  /**
   * Send to Google Analytics (GA4)
   */
  private async sendToGoogleAnalytics(data: any): Promise<void> {
    if (typeof (window as any).gtag !== 'function') {
      console.warn('Google Analytics not available');
      return;
    }

    (window as any).gtag('event', 'performance_issue', {
      event_category: 'performance',
      event_label: data.metric,
      value: data.currentValue,
      custom_parameters: {
        issue_type: data.type,
        severity: data.severity,
        threshold: data.threshold,
      },
    });
  }

  /**
   * Send to Mixpanel
   */
  private async sendToMixpanel(data: any): Promise<void> {
    if (typeof (window as any).mixpanel !== 'object') {
      console.warn('Mixpanel not available');
      return;
    }

    (window as any).mixpanel.track('Performance Issue', {
      metric: data.metric,
      currentValue: data.currentValue,
      threshold: data.threshold,
      issueType: data.type,
      severity: data.severity,
    });
  }

  /**
   * Send to custom endpoint
   */
  private async sendToCustomEndpoint(data: any): Promise<void> {
    if (!this.config.reportingEndpoint) return;

    await fetch(this.config.reportingEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'performance_analytics',
        timestamp: Date.now(),
        data,
      }),
    });
  }

  /**
   * Trigger critical alert
   */
  private triggerCriticalAlert(issue: PerformanceIssue): void {
    // Implementation for critical alerts (email, Slack, etc.)
    if (this.config.reportingEndpoint) {
      fetch(this.config.reportingEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'critical_performance_alert',
          issue,
          timestamp: Date.now(),
        }),
      }).catch(console.error);
    }
  }

  /**
   * Start automated reporting
   */
  private startAutomatedReporting(): void {
    this.flushTimer = setInterval(() => {
      this.flushBatch();
      this.generatePeriodicReport();
    }, this.config.flushInterval);
  }

  /**
   * Generate periodic performance report
   */
  private generatePeriodicReport(): void {
    const now = Date.now();
    const periodStart = now - this.config.flushInterval;
    
    const periodMetrics = this.buffer.filter(m => m.timestamp >= periodStart);
    
    if (periodMetrics.length === 0) return;

    const aggregated = this.aggregateMetrics(periodMetrics, 'hour');
    this.historicalData.push(aggregated);

    // Keep only recent data to manage memory
    if (this.historicalData.length > 168) { // Keep 1 week of hourly data
      this.historicalData = this.historicalData.slice(-168);
    }

    this.sendReport(aggregated);
  }

  /**
   * Aggregate metrics for reporting
   */
  private aggregateMetrics(metrics: WebVitalRecord[], period: 'hour' | 'day' | 'week' | 'month'): AggregatedMetrics {
    const grouped = this.groupMetricsByName(metrics);
    const aggregated: AggregatedMetrics = {
      timestamp: Date.now(),
      period,
      metrics: {
        average: {},
        median: {},
        percentiles: {
          p50: {},
          p75: {},
          p90: {},
          p95: {},
          p99: {},
        },
        counts: {},
        trend: {},
      },
      performanceScore: 0,
      issues: [],
    };

    Object.entries(grouped).forEach(([metricName, metricValues]) => {
      const values = metricValues.map(m => m.value).sort((a, b) => a - b);
      
      // Calculate statistics
      aggregated.metrics.average[metricName] = this.calculateAverage(values);
      aggregated.metrics.median[metricName] = this.calculatePercentile(values, 50);
      aggregated.metrics.percentiles.p50[metricName] = this.calculatePercentile(values, 50);
      aggregated.metrics.percentiles.p75[metricName] = this.calculatePercentile(values, 75);
      aggregated.metrics.percentiles.p90[metricName] = this.calculatePercentile(values, 90);
      aggregated.metrics.percentiles.p95[metricName] = this.calculatePercentile(values, 95);
      aggregated.metrics.percentiles.p99[metricName] = this.calculatePercentile(values, 99);

      // Count ratings
      const counts = { good: 0, needsImprovement: 0, poor: 0 };
      metricValues.forEach(m => {
        counts[m.rating as keyof typeof counts] = (counts[m.rating as keyof typeof counts] || 0) + 1;
      });
      aggregated.metrics.counts[metricName] = counts;

      // Calculate trend
      aggregated.metrics.trend[metricName] = this.calculateTrend(metricName, values[values.length - 1]);
    });

    // Calculate overall performance score
    aggregated.performanceScore = this.calculateOverallScore(aggregated.metrics.average);
    
    // Include relevant issues
    aggregated.issues = this.currentIssues.filter(issue => 
      issue.timestamp >= Date.now() - (period === 'hour' ? 3600000 : period === 'day' ? 86400000 : 0)
    );

    return aggregated;
  }

  /**
   * Group metrics by name
   */
  private groupMetricsByName(metrics: WebVitalRecord[]): Record<string, WebVitalRecord[]> {
    return metrics.reduce((groups, metric) => {
      if (!groups[metric.metric]) {
        groups[metric.metric] = [];
      }
      groups[metric.metric].push(metric);
      return groups;
    }, {} as Record<string, WebVitalRecord[]>);
  }

  /**
   * Calculate average
   */
  private calculateAverage(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const index = (percentile / 100) * (values.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return values[lower] * (1 - weight) + values[upper] * weight;
  }

  /**
   * Calculate trend for metric
   */
  private calculateTrend(metricName: string, currentValue: number): 'improving' | 'stable' | 'regressing' {
    const historicalValues = this.historicalData
      .slice(-5) // Last 5 periods
      .map(period => period.metrics.average[metricName])
      .filter(val => val !== undefined);

    if (historicalValues.length < 2) return 'stable';

    const recentTrend = historicalValues[historicalValues.length - 1] - historicalValues[0];
    const threshold = this.config.performanceBudgets[metricName as keyof typeof this.config.performanceBudgets] * 0.05; // 5% change

    if (recentTrend > threshold) return 'regressing';
    if (recentTrend < -threshold) return 'improving';
    return 'stable';
  }

  /**
   * Calculate overall performance score
   */
  private calculateOverallScore(averages: Record<string, number>): number {
    const weights = {
      LCP: 0.25,
      FID: 0.25,
      FCP: 0.15,
      CLS: 0.15,
      TTFB: 0.1,
      INP: 0.1,
    };

    let totalScore = 0;
    let totalWeight = 0;

    Object.entries(averages).forEach(([metric, value]) => {
      const weight = weights[metric as keyof typeof weights] || 0;
      const threshold = PERFORMANCE_THRESHOLDS[metric as keyof typeof PERFORMANCE_THRESHOLDS];
      if (threshold) {
        const score = value <= threshold.good ? 100 : 
                     value <= threshold.poor ? 70 : 30;
        totalScore += score * weight;
        totalWeight += weight;
      }
    });

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  /**
   * Start regression detection
   */
  private startRegressionDetection(): void {
    setInterval(() => {
      this.detectRegressions();
    }, 300000); // Check every 5 minutes
  }

  /**
   * Detect performance regressions
   */
  private detectRegressions(): void {
    if (this.historicalData.length < this.config.regressionDetection.historicalDataPoints) {
      return;
    }

    const recentData = this.historicalData.slice(-this.config.regressionDetection.historicalDataPoints);
    const baseline = this.calculateBaseline(recentData);

    Object.entries(baseline).forEach(([metric, baselineValue]) => {
      const currentValue = this.historicalData[this.historicalData.length - 1].metrics.average[metric];
      
      if (currentValue !== undefined && baselineValue !== undefined) {
        const regressionPercent = ((currentValue - baselineValue) / baselineValue) * 100;
        
        if (regressionPercent > this.config.regressionDetection.thresholdPercentage) {
          this.createIssue('regression', metric, currentValue, baselineValue,
            `${metric} regression detected: ${regressionPercent.toFixed(1)}% increase from baseline`);
        }
      }
    });
  }

  /**
   * Calculate baseline from historical data
   */
  private calculateBaseline(data: AggregatedMetrics[]): Record<string, number> {
    const baseline: Record<string, number> = {};
    
    data.forEach(period => {
      Object.entries(period.metrics.average).forEach(([metric, value]) => {
        if (!baseline[metric]) {
          baseline[metric] = 0;
        }
        baseline[metric] += value;
      });
    });

    // Average the values
    Object.keys(baseline).forEach(metric => {
      baseline[metric] = baseline[metric] / data.length;
    });

    return baseline;
  }

  /**
   * Flush batch data
   */
  private flushBatch(): void {
    if (this.batchMetrics.length === 0 && this.batchCustomMetrics.length === 0) {
      return;
    }

    // Process batch data
    const batchData = {
      webVitals: [...this.batchMetrics],
      customMetrics: [...this.batchCustomMetrics],
      timestamp: Date.now(),
    };

    // Clear batches
    this.batchMetrics = [];
    this.batchCustomMetrics = [];

    // Send to analytics
    this.sendToAnalytics(batchData);
  }

  /**
   * Send report
   */
  private async sendReport(aggregated: AggregatedMetrics): Promise<void> {
    const report = {
      type: 'performance_report',
      timestamp: Date.now(),
      aggregated,
      issues: this.currentIssues.filter(issue => !issue.resolved),
    };

    await this.sendToAnalytics(report);
  }

  /**
   * Run automated performance test
   */
  public async runPerformanceTest(url: string, options?: {
    userAgent?: string;
    connection?: string;
    device?: string;
  }): Promise<PerformanceTestResult> {
    const testId = `perf-test-${Date.now()}`;
    const timestamp = Date.now();

    try {
      // Get current metrics
      const metrics = webVitalsMonitor.getMetrics();
      const customMetrics = webVitalsMonitor.getCustomMetrics();

      // Create test result
      const result: PerformanceTestResult = {
        testId,
        timestamp,
        url,
        userAgent: options?.userAgent || navigator.userAgent,
        results: {
          webVitals: {},
          customMetrics: {},
          budgets: {},
          overallScore: 0,
          overallPass: true,
        },
        metrics,
        customMetrics,
      };

      // Test Web Vitals against thresholds
      Object.entries(metrics).forEach(([metricName, metricRecord]) => {
        if (metricRecord) {
          const pass = metricRecord.rating !== 'poor';
          result.results.webVitals[metricName] = {
            value: metricRecord.value,
            rating: metricRecord.rating,
            pass,
          };
          if (!pass) result.results.overallPass = false;
        }
      });

      // Test custom metrics against targets
      customMetrics.forEach(metric => {
        const target = this.getCustomMetricTarget(metric.name);
        if (target !== undefined) {
          const pass = metric.value <= target;
          result.results.customMetrics[metric.name] = {
            value: metric.value,
            target,
            pass,
          };
          if (!pass) result.results.overallPass = false;
        }
      });

      // Test budgets
      Object.entries(this.config.performanceBudgets).forEach(([budgetName, budgetValue]) => {
        const current = this.getCurrentBudgetValue(budgetName);
        if (current !== undefined) {
          const pass = current <= budgetValue;
          result.results.budgets[budgetName] = {
            current,
            budget: budgetValue,
            pass,
          };
          if (!pass) result.results.overallPass = false;
        }
      });

      // Calculate overall score
      result.results.overallScore = this.calculateOverallScore(
        Object.fromEntries(
          Object.entries(result.results.webVitals).map(([key, val]) => [key, val.value])
        )
      );

      this.testResults.push(result);
      
      // Keep only recent test results
      if (this.testResults.length > 1000) {
        this.testResults = this.testResults.slice(-1000);
      }

      return result;
    } catch (error) {
      console.error('Performance test failed:', error);
      throw error;
    }
  }

  /**
   * Get target value for custom metric
   */
  private getCustomMetricTarget(metricName: string): number | undefined {
    const targets: Record<string, number> = {
      time_to_interactive: 3000,
      js_execution_time: 200,
      route_change_duration: 100,
    };
    return targets[metricName];
  }

  /**
   * Get current budget value
   */
  private getCurrentBudgetValue(budgetName: string): number | undefined {
    // This would be calculated from actual metrics
    // For now, return a placeholder
    const currentValues: Record<string, number> = {
      totalPageWeight: 1200,
      scriptSize: 150,
      cssSize: 75,
      imageSize: 800,
      requestCount: 45,
    };
    return currentValues[budgetName];
  }

  /**
   * Export analytics data
   */
  public exportData(format: 'json' | 'csv' = 'json'): AnalyticsExport {
    const exportData: AnalyticsExport = {
      version: '1.0.0',
      timestamp: Date.now(),
      environment: process.env.NODE_ENV || 'development',
      aggregatedMetrics: this.historicalData,
      testResults: this.testResults,
      issues: this.currentIssues,
      summary: {
        totalTests: this.testResults.length,
        totalIssues: this.currentIssues.filter(i => !i.resolved).length,
        averageScore: this.calculateExportAverageScore(),
        topIssues: this.getTopIssues(),
      },
    };

    if (format === 'csv') {
      return this.convertToCSV(exportData);
    }

    return exportData;
  }

  /**
   * Calculate export average score
   */
  private calculateExportAverageScore(): number {
    if (this.historicalData.length === 0) return 0;
    const total = this.historicalData.reduce((sum, data) => sum + data.performanceScore, 0);
    return Math.round(total / this.historicalData.length);
  }

  /**
   * Get top issues
   */
  private getTopIssues(): string[] {
    const issueCounts = this.currentIssues.reduce((counts, issue) => {
      counts[issue.metric] = (counts[issue.metric] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return Object.entries(issueCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([metric, count]) => `${metric}: ${count} occurrences`);
  }

  /**
   * Convert to CSV format
   */
  private convertToCSV(data: AnalyticsExport): AnalyticsExport {
    // Simplified CSV conversion - in practice, this would be more sophisticated
    return {
      ...data,
      aggregatedMetrics: data.aggregatedMetrics, // Would convert to CSV format
    };
  }

  /**
   * Get current analytics summary
   */
  public getSummary(): {
    totalMetrics: number;
    totalIssues: number;
    performanceScore: number;
    activeIssues: PerformanceIssue[];
    recentTests: number;
  } {
    return {
      totalMetrics: this.buffer.length,
      totalIssues: this.currentIssues.filter(i => !i.resolved).length,
      performanceScore: this.historicalData.length > 0 
        ? this.historicalData[this.historicalData.length - 1].performanceScore 
        : 0,
      activeIssues: this.currentIssues.filter(i => !i.resolved),
      recentTests: this.testResults.filter(t => 
        t.timestamp > Date.now() - 86400000 // Last 24 hours
      ).length,
    };
  }

  /**
   * Resolve issue
   */
  public resolveIssue(issueId: string): void {
    const issue = this.currentIssues.find(i => i.id === issueId);
    if (issue) {
      issue.resolved = true;
      console.log(`Performance issue resolved: ${issue.description}`);
    }
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    webVitalsMonitor.cleanup();
  }
}

// Singleton instance
export const performanceAnalytics = new PerformanceAnalytics();

// Export utility functions
export const createPerformanceTest = async (url: string, options?: any): Promise<PerformanceTestResult> => {
  return performanceAnalytics.runPerformanceTest(url, options);
};

export const exportPerformanceData = (format: 'json' | 'csv' = 'json'): AnalyticsExport => {
  return performanceAnalytics.exportData(format);
};

export const getPerformanceSummary = () => {
  return performanceAnalytics.getSummary();
};