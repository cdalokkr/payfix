/**
 * Comprehensive Web Vitals Monitoring System
 * Tracks Core Web Vitals and custom performance metrics
 */

// Web Vitals types and polyfills (since web-vitals package may not be installed)
interface WebVitalMetric {
  name: string;
  value: number;
  delta: number;
  id: string;
}

declare global {
  interface Window {
    webVitals?: {
      onCLS: (callback: (metric: WebVitalMetric) => void, options?: any) => void;
      onFID: (callback: (metric: WebVitalMetric) => void, options?: any) => void;
      onLCP: (callback: (metric: WebVitalMetric) => void, options?: any) => void;
      onFCP: (callback: (metric: WebVitalMetric) => void, options?: any) => void;
      onTTFB: (callback: (metric: WebVitalMetric) => void, options?: any) => void;
      onINP: (callback: (metric: WebVitalMetric) => void, options?: any) => void;
    };
  }
}

// Fallback implementations for web-vitals functions
const onCLS = (callback: (metric: WebVitalMetric) => void, options?: any) => {
  // Polyfill implementation using Performance Observer
  if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
    let clsValue = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value || 0;
        }
      }
    });
    observer.observe({ entryTypes: ['layout-shift'] });
    
    setTimeout(() => {
      callback({
        name: 'CLS',
        value: clsValue,
        delta: clsValue,
        id: `cls-${Date.now()}`
      });
    }, options?.timeout || 3000);
  }
};

const onFID = (callback: (metric: WebVitalMetric) => void, options?: any) => {
  // Polyfill implementation
  if (typeof window !== 'undefined') {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const fidEntry = entry as any; // Cast to access processingStart
        const processingStart = fidEntry.processingStart || entry.startTime;
        callback({
          name: 'FID',
          value: processingStart - entry.startTime,
          delta: processingStart - entry.startTime,
          id: `fid-${Date.now()}`
        });
      }
    });
    observer.observe({ entryTypes: ['first-input'] });
  }
};

const onLCP = (callback: (metric: WebVitalMetric) => void, options?: any) => {
  // Polyfill implementation
  if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        callback({
          name: 'LCP',
          value: lastEntry.startTime,
          delta: lastEntry.startTime,
          id: `lcp-${Date.now()}`
        });
      }
    });
    observer.observe({ entryTypes: ['largest-contentful-paint'] });
  }
};

const onFCP = (callback: (metric: WebVitalMetric) => void, options?: any) => {
  // Polyfill implementation
  if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          callback({
            name: 'FCP',
            value: entry.startTime,
            delta: entry.startTime,
            id: `fcp-${Date.now()}`
          });
        }
      }
    });
    observer.observe({ entryTypes: ['paint'] });
  }
};

const onTTFB = (callback: (metric: WebVitalMetric) => void, options?: any) => {
  // Polyfill implementation
  if (typeof window !== 'undefined') {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      callback({
        name: 'TTFB',
        value: navigation.responseStart - navigation.requestStart,
        delta: navigation.responseStart - navigation.requestStart,
        id: `ttfb-${Date.now()}`
      });
    }
  }
};

const onINP = (callback: (metric: WebVitalMetric) => void, options?: any) => {
  // Polyfill implementation using FID as fallback
  onFID(callback, options);
};

// Performance thresholds for Core Web Vitals
export interface WebVitalsThresholds {
  LCP: { good: number; poor: number };
  FID: { good: number; poor: number };
  FCP: { good: number; poor: number };
  CLS: { good: number; poor: number };
  TTFB: { good: number; poor: number };
  INP: { good: number; poor: number };
}

export const PERFORMANCE_THRESHOLDS: WebVitalsThresholds = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  FCP: { good: 1800, poor: 3000 },
  CLS: { good: 0.1, poor: 0.25 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 },
};

// Web Vitals data structure
export interface WebVitalRecord {
  metric: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
  url: string;
  userAgent: string;
  connectionType?: string;
  deviceMemory?: number;
  customData?: Record<string, any>;
}

// Performance observer data
export interface PerformanceEntryData {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  size?: number;
  initiatorType?: string;
  transferSize?: number;
  encodedBodySize?: number;
  decodedBodySize?: number;
}

// Custom performance metrics
export interface CustomMetric {
  name: string;
  value: number;
  timestamp: number;
  context?: string;
  metadata?: Record<string, any>;
}

// Performance monitoring configuration
export interface MonitoringConfig {
  enableRealTimeMonitoring: boolean;
  enableCustomMetrics: boolean;
  sampleRate: number;
  alertThresholds: Partial<WebVitalsThresholds>;
  reportingEndpoint?: string;
  bufferSize: number;
}

// Performance monitoring class
export class WebVitalsMonitor {
  private config: MonitoringConfig;
  private buffer: WebVitalRecord[] = [];
  private customMetrics: CustomMetric[] = [];
  private observers: PerformanceObserver[] = [];
  private isInitialized = false;
  private realTimeCallback?: (metric: WebVitalRecord) => void;

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      enableRealTimeMonitoring: true,
      enableCustomMetrics: true,
      sampleRate: 1.0,
      alertThresholds: {},
      bufferSize: 100,
      ...config,
    };
  }

  /**
   * Initialize Web Vitals monitoring
   */
  public async initialize(
    realTimeCallback?: (metric: WebVitalRecord) => void
  ): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.realTimeCallback = realTimeCallback;

    // Initialize Core Web Vitals tracking
    this.initializeCoreWebVitals();

    // Initialize performance observers
    this.initializePerformanceObservers();

    // Initialize custom metrics
    if (this.config.enableCustomMetrics) {
      this.initializeCustomMetrics();
    }

    this.isInitialized = true;
    console.log('Web Vitals monitoring initialized');
  }

  /**
   * Initialize Core Web Vitals tracking
   */
  private initializeCoreWebVitals(): void {
    // Largest Contentful Paint (LCP)
    onLCP((metric: WebVitalMetric) => {
      this.recordMetric({
        metric: 'LCP',
        value: metric.value,
        rating: this.getRating('LCP', metric.value),
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        connectionType: (navigator as any).connection?.effectiveType,
        deviceMemory: (navigator as any).deviceMemory,
      });
    }, { reportAllChanges: true });

    // First Input Delay (FID)
    onFID((metric: WebVitalMetric) => {
      this.recordMetric({
        metric: 'FID',
        value: metric.value,
        rating: this.getRating('FID', metric.value),
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        connectionType: (navigator as any).connection?.effectiveType,
        deviceMemory: (navigator as any).deviceMemory,
      });
    });

    // First Contentful Paint (FCP)
    onFCP((metric: WebVitalMetric) => {
      this.recordMetric({
        metric: 'FCP',
        value: metric.value,
        rating: this.getRating('FCP', metric.value),
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        connectionType: (navigator as any).connection?.effectiveType,
        deviceMemory: (navigator as any).deviceMemory,
      });
    });

    // Cumulative Layout Shift (CLS)
    onCLS((metric: WebVitalMetric) => {
      this.recordMetric({
        metric: 'CLS',
        value: metric.value,
        rating: this.getRating('CLS', metric.value),
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        connectionType: (navigator as any).connection?.effectiveType,
        deviceMemory: (navigator as any).deviceMemory,
      });
    }, { reportAllChanges: true });

    // Time to First Byte (TTFB)
    onTTFB((metric: WebVitalMetric) => {
      this.recordMetric({
        metric: 'TTFB',
        value: metric.value,
        rating: this.getRating('TTFB', metric.value),
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        connectionType: (navigator as any).connection?.effectiveType,
        deviceMemory: (navigator as any).deviceMemory,
      });
    });

    // Interaction to Next Paint (INP)
    onINP((metric: WebVitalMetric) => {
      this.recordMetric({
        metric: 'INP',
        value: metric.value,
        rating: this.getRating('INP', metric.value),
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        connectionType: (navigator as any).connection?.effectiveType,
        deviceMemory: (navigator as any).deviceMemory,
      });
    }, { reportAllChanges: true });
  }

  /**
   * Initialize performance observers for detailed metrics
   */
  private initializePerformanceObservers(): void {
    if (!('PerformanceObserver' in window)) {
      return;
    }

    // Resource timing observer
    const resourceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.processResourceTiming(entry as PerformanceResourceTiming);
      }
    });
    resourceObserver.observe({ entryTypes: ['resource'] });
    this.observers.push(resourceObserver);

    // Navigation timing observer
    const navigationObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.processNavigationTiming(entry as PerformanceNavigationTiming);
      }
    });
    navigationObserver.observe({ entryTypes: ['navigation'] });
    this.observers.push(navigationObserver);

    // Paint timing observer
    const paintObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.processPaintTiming(entry);
      }
    });
    paintObserver.observe({ entryTypes: ['paint'] });
    this.observers.push(paintObserver);

    // Largest Contentful Paint observer
    const lcpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.processLargestContentfulPaint(entry as any);
      }
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    this.observers.push(lcpObserver);

    // First input observer
    const firstInputObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.processFirstInput(entry as any);
      }
    });
    firstInputObserver.observe({ entryTypes: ['first-input'] });
    this.observers.push(firstInputObserver);

    // Layout shift observer
    const layoutShiftObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.processLayoutShift(entry as any);
      }
    });
    layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
    this.observers.push(layoutShiftObserver);
  }

  /**
   * Initialize custom metrics tracking
   */
  private initializeCustomMetrics(): void {
    // Track route changes
    if (typeof window !== 'undefined') {
      // Track time to interactive
      this.trackTimeToInteractive();
      
      // Track route change performance
      this.trackRouteChangePerformance();
      
      // Track JavaScript execution time
      this.trackJSExecutionTime();
    }
  }

  /**
   * Process resource timing entries
   */
  private processResourceTiming(entry: PerformanceResourceTiming): void {
    const duration = entry.responseEnd - entry.startTime;
    
    // Only track significant resources
    if (duration > 100) {
      this.recordCustomMetric({
        name: 'resource_timing',
        value: duration,
        timestamp: Date.now(),
        metadata: {
          name: entry.name,
          initiatorType: entry.initiatorType,
          transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize,
        },
      });
    }
  }

  /**
   * Process navigation timing entries
   */
  private processNavigationTiming(entry: PerformanceNavigationTiming): void {
    const timingMetrics = {
      dns: entry.domainLookupEnd - entry.domainLookupStart,
      tcp: entry.connectEnd - entry.connectStart,
      tls: entry.connectEnd - entry.secureConnectionStart,
      request: entry.responseStart - entry.requestStart,
      response: entry.responseEnd - entry.responseStart,
      dom: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
      load: entry.loadEventEnd - entry.loadEventStart,
    };

    Object.entries(timingMetrics).forEach(([name, value]) => {
      if (value > 0) {
        this.recordCustomMetric({
          name: `navigation_${name}`,
          value,
          timestamp: Date.now(),
        });
      }
    });
  }

  /**
   * Process paint timing entries
   */
  private processPaintTiming(entry: PerformanceEntry): void {
    this.recordCustomMetric({
      name: `paint_${entry.name}`,
      value: entry.startTime,
      timestamp: Date.now(),
    });
  }

  /**
   * Process largest contentful paint entries
   */
  private processLargestContentfulPaint(entry: any): void {
    this.recordCustomMetric({
      name: 'largest_contentful_paint_detailed',
      value: entry.startTime,
      timestamp: Date.now(),
      metadata: {
        renderTime: entry.renderTime,
        loadTime: entry.loadTime,
        size: entry.size,
        element: entry.element?.tagName,
      },
    });
  }

  /**
   * Process first input entries
   */
  private processFirstInput(entry: any): void {
    this.recordCustomMetric({
      name: 'first_input_detailed',
      value: entry.processingStart - entry.startTime,
      timestamp: Date.now(),
      metadata: {
        name: entry.name,
        type: entry.type,
        target: entry.target?.tagName,
      },
    });
  }

  /**
   * Process layout shift entries
   */
  private processLayoutShift(entry: any): void {
    if (!entry.hadRecentInput) {
      this.recordCustomMetric({
        name: 'layout_shift',
        value: entry.value,
        timestamp: Date.now(),
        metadata: {
          sources: entry.sources?.length || 0,
        },
      });
    }
  }

  /**
   * Track time to interactive
   */
  private trackTimeToInteractive(): void {
    const checkTTI = () => {
      if (document.readyState === 'complete') {
        // Simple TTI approximation
        setTimeout(() => {
          this.recordCustomMetric({
            name: 'time_to_interactive',
            value: performance.now(),
            timestamp: Date.now(),
          });
        }, 0);
      } else {
        requestIdleCallback(checkTTI);
      }
    };

    if (document.readyState === 'complete') {
      checkTTI();
    } else {
      window.addEventListener('load', checkTTI);
    }
  }

  /**
   * Track route change performance
   */
  private trackRouteChangePerformance(): void {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    const trackNavigation = () => {
      this.recordCustomMetric({
        name: 'route_change_duration',
        value: performance.now(),
        timestamp: Date.now(),
        context: 'navigation',
      });
    };

    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      trackNavigation();
      return result;
    };

    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      trackNavigation();
      return result;
    };

    window.addEventListener('popstate', trackNavigation);
  }

  /**
   * Track JavaScript execution time
   */
  private trackJSExecutionTime(): void {
    const startTime = performance.now();
    
    // Track main thread blocking time
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        const jsExecutionTime = performance.now() - startTime;
        this.recordCustomMetric({
          name: 'js_execution_time',
          value: jsExecutionTime,
          timestamp: Date.now(),
        });
      });
    }
  }

  /**
   * Get performance rating based on thresholds
   */
  private getRating(metric: keyof WebVitalsThresholds, value: number): 'good' | 'needs-improvement' | 'poor' {
    const threshold = PERFORMANCE_THRESHOLDS[metric];
    if (value <= threshold.good) {
      return 'good';
    } else if (value <= threshold.poor) {
      return 'needs-improvement';
    } else {
      return 'poor';
    }
  }

  /**
   * Record a Web Vital metric
   */
  private recordMetric(metric: WebVitalRecord): void {
    // Apply sampling rate
    if (Math.random() > this.config.sampleRate) {
      return;
    }

    this.buffer.push(metric);
    
    // Maintain buffer size
    if (this.buffer.length > this.config.bufferSize) {
      this.buffer = this.buffer.slice(-this.config.bufferSize);
    }

    // Trigger real-time callback
    if (this.realTimeCallback && this.config.enableRealTimeMonitoring) {
      this.realTimeCallback(metric);
    }

    // Check alert thresholds
    this.checkAlertThresholds(metric);
  }

  /**
   * Record a custom metric
   */
  public recordCustomMetric(metric: CustomMetric): void {
    this.customMetrics.push(metric);
    
    // Maintain buffer size for custom metrics
    if (this.customMetrics.length > this.config.bufferSize) {
      this.customMetrics = this.customMetrics.slice(-this.config.bufferSize);
    }
  }

  /**
   * Check alert thresholds
   */
  private checkAlertThresholds(metric: WebVitalRecord): void {
    const alertThreshold = this.config.alertThresholds[metric.metric as keyof WebVitalsThresholds];
    
    if (alertThreshold && metric.value > alertThreshold.poor) {
      console.warn(`Performance alert: ${metric.metric} value ${metric.value} exceeds threshold`);
      
      // Here you could send alerts to monitoring services
      this.sendAlert(metric);
    }
  }

  /**
   * Send performance alert
   */
  private sendAlert(metric: WebVitalRecord): void {
    if (this.config.reportingEndpoint) {
      fetch(this.config.reportingEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'performance_alert',
          metric: metric.metric,
          value: metric.value,
          rating: metric.rating,
          timestamp: metric.timestamp,
          url: metric.url,
        }),
      }).catch(console.error);
    }
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): WebVitalRecord[] {
    return [...this.buffer];
  }

  /**
   * Get custom metrics
   */
  public getCustomMetrics(): CustomMetric[] {
    return [...this.customMetrics];
  }

  /**
   * Get performance summary
   */
  public getSummary(): {
    averageMetrics: Record<string, number>;
    latestMetrics: Record<string, WebVitalRecord>;
    performanceScore: number;
    issues: string[];
  } {
    const summary = {
      averageMetrics: {} as Record<string, number>,
      latestMetrics: {} as Record<string, WebVitalRecord>,
      performanceScore: 0,
      issues: [] as string[],
    };

    // Calculate averages and latest values
    const metricGroups = this.buffer.reduce((groups, metric) => {
      if (!groups[metric.metric]) {
        groups[metric.metric] = [];
      }
      groups[metric.metric].push(metric);
      return groups;
    }, {} as Record<string, WebVitalRecord[]>);

    Object.entries(metricGroups).forEach(([metricName, metrics]) => {
      // Average value
      const avgValue = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
      summary.averageMetrics[metricName] = avgValue;

      // Latest value
      const latest = metrics[metrics.length - 1];
      summary.latestMetrics[metricName] = latest;

      // Check for issues
      if (latest.rating === 'poor') {
        summary.issues.push(`${metricName} is poor: ${latest.value}`);
      }
    });

    // Calculate performance score (0-100)
    const scores: number[] = Object.entries(summary.averageMetrics).map(([metric, value]) => {
      const rating = this.getRating(metric as keyof WebVitalsThresholds, value);
      switch (rating) {
        case 'good': return 100;
        case 'needs-improvement': return 70;
        case 'poor': return 30;
        default: return 0;
      }
    });
    
    summary.performanceScore = scores.length > 0
      ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
      : 0;

    return summary;
  }

  /**
   * Clear all metrics
   */
  public clear(): void {
    this.buffer = [];
    this.customMetrics = [];
  }

  /**
   * Clean up observers and cleanup
   */
  public cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.isInitialized = false;
  }
}

// Singleton instance
export const webVitalsMonitor = new WebVitalsMonitor();

// Export utility functions
export const getPerformanceRating = (metric: keyof WebVitalsThresholds, value: number): 'good' | 'needs-improvement' | 'poor' => {
  const threshold = PERFORMANCE_THRESHOLDS[metric];
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
};

export const formatMetricValue = (metric: string, value: number): string => {
  const unit = ['CLS'].includes(metric) ? '' : 'ms';
  return `${Math.round(value * 100) / 100}${unit}`;
};

export const getMetricColor = (rating: 'good' | 'needs-improvement' | 'poor'): string => {
  switch (rating) {
    case 'good': return '#22c55e';
    case 'needs-improvement': return '#f59e0b';
    case 'poor': return '#ef4444';
    default: return '#6b7280';
  }
};