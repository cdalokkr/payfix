'use client';

/**
 * Performance Dashboard Component
 * Real-time performance monitoring and visualization interface
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  webVitalsMonitor, 
  WebVitalRecord, 
  getPerformanceRating, 
  formatMetricValue, 
  getMetricColor,
  PERFORMANCE_THRESHOLDS
} from '@/lib/monitoring/web-vitals';
import { 
  performanceAnalytics, 
  PerformanceTestResult, 
  PerformanceIssue,
  getPerformanceSummary 
} from '@/lib/monitoring/performance-analytics';

// Performance dashboard props
export interface PerformanceDashboardProps {
  realTimeMode?: boolean;
  showControls?: boolean;
  showExport?: boolean;
  autoRefreshInterval?: number; // milliseconds
  enableTesting?: boolean;
}

// Real-time metric data
interface RealTimeMetric {
  timestamp: number;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

// Performance trend data
interface TrendData {
  metric: string;
  data: RealTimeMetric[];
  current: number;
  average: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

// Performance dashboard component
export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  realTimeMode = true,
  showControls = true,
  showExport = true,
  autoRefreshInterval = 5000,
  enableTesting = true,
}) => {
  // State management
  const [metrics, setMetrics] = useState<WebVitalRecord[]>([]);
  const [issues, setIssues] = useState<PerformanceIssue[]>([]);
  const [testResults, setTestResults] = useState<PerformanceTestResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'hour' | 'day' | 'week'>('hour');
  const [refreshKey, setRefreshKey] = useState(0);

  // Real-time metrics tracking
  const [realTimeMetrics, setRealTimeMetrics] = useState<Record<string, RealTimeMetric[]>>({});

  // Fetch and update data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get current metrics from monitoring system
      const currentMetrics = webVitalsMonitor.getMetrics();
      const analyticsSummary = getPerformanceSummary();
      
      setMetrics(currentMetrics);
      setIssues(analyticsSummary.activeIssues);
      
      // Update real-time metrics
      if (realTimeMode) {
        updateRealTimeMetrics(currentMetrics);
      }
      
    } catch (error) {
      console.error('Failed to fetch performance data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [realTimeMode]);

  // Update real-time metrics
  const updateRealTimeMetrics = useCallback((currentMetrics: WebVitalRecord[]) => {
    setRealTimeMetrics(prev => {
      const updated = { ...prev };
      
      currentMetrics.forEach(metric => {
        if (!updated[metric.metric]) {
          updated[metric.metric] = [];
        }
        
        // Add new data point
        const newDataPoint: RealTimeMetric = {
          timestamp: metric.timestamp,
          value: metric.value,
          rating: metric.rating,
        };
        
        updated[metric.metric] = [
          ...updated[metric.metric].slice(-49), // Keep last 50 points
          newDataPoint
        ];
      });
      
      return updated;
    });
  }, []);

  // Run performance test
  const runPerformanceTest = useCallback(async () => {
    if (!enableTesting) return;
    
    setIsTesting(true);
    try {
      const result = await performanceAnalytics.runPerformanceTest(window.location.href);
      setTestResults(prev => [result, ...prev.slice(0, 9)]); // Keep last 10 results
    } catch (error) {
      console.error('Performance test failed:', error);
    } finally {
      setIsTesting(false);
    }
  }, [enableTesting]);

  // Export performance data
  const exportData = useCallback(() => {
    try {
      const exportData = performanceAnalytics.exportData('json');
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  }, []);

  // Memoized trend calculations
  const trendData = useMemo((): TrendData[] => {
    return Object.entries(realTimeMetrics).map(([metric, dataPoints]) => {
      const values = dataPoints.map(point => point.value);
      const current = values[values.length - 1] || 0;
      const average = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
      const rating = getPerformanceRating(metric as keyof typeof PERFORMANCE_THRESHOLDS, current);
      
      return {
        metric,
        data: dataPoints,
        current,
        average,
        rating,
      };
    });
  }, [realTimeMetrics]);

  // Performance score calculation
  const overallScore = useMemo(() => {
    if (metrics.length === 0) return 0;
    
    const latestByMetric = metrics.reduce((acc, metric) => {
      if (!acc[metric.metric] || metric.timestamp > acc[metric.metric].timestamp) {
        acc[metric.metric] = metric;
      }
      return acc;
    }, {} as Record<string, WebVitalRecord>);
    
    const scores = Object.values(latestByMetric).map(metric => {
      switch (metric.rating) {
        case 'good': return 100;
        case 'needs-improvement': return 70;
        case 'poor': return 30;
        default: return 0;
      }
    });
    
    return Math.round(scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length);
  }, [metrics]);

  // Effects
  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  useEffect(() => {
    if (autoRefreshInterval > 0) {
      const interval = setInterval(() => {
        setRefreshKey(prev => prev + 1);
      }, autoRefreshInterval);
      
      return () => clearInterval(interval);
    }
  }, [autoRefreshInterval]);

  // Loading state
  if (isLoading && metrics.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Performance Dashboard</CardTitle>
            <CardDescription>Loading performance metrics...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">Performance Dashboard</CardTitle>
              <CardDescription>
                Real-time performance monitoring and analytics
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {showControls && (
                <>
                  <Button 
                    onClick={() => setRefreshKey(prev => prev + 1)}
                    variant="outline"
                    size="sm"
                  >
                    Refresh
                  </Button>
                  {enableTesting && (
                    <Button 
                      onClick={runPerformanceTest}
                      disabled={isTesting}
                      size="sm"
                    >
                      {isTesting ? 'Testing...' : 'Run Test'}
                    </Button>
                  )}
                  {showExport && (
                    <Button onClick={exportData} variant="outline" size="sm">
                      Export
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Performance Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{overallScore}</div>
              <p className="text-sm text-muted-foreground">Overall Score</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${overallScore}%`,
                    backgroundColor: getMetricColor(
                      overallScore >= 90 ? 'good' : overallScore >= 50 ? 'needs-improvement' : 'poor'
                    )
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{metrics.length}</div>
              <p className="text-sm text-muted-foreground">Total Metrics</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">
                {issues.filter(i => !i.resolved).length}
              </div>
              <p className="text-sm text-muted-foreground">Active Issues</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{testResults.length}</div>
              <p className="text-sm text-muted-foreground">Test Results</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as any)}>
        <TabsList>
          <TabsTrigger value="hour">Last Hour</TabsTrigger>
          <TabsTrigger value="day">Today</TabsTrigger>
          <TabsTrigger value="week">This Week</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedPeriod} className="space-y-6">
          {/* Web Vitals Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Core Web Vitals</CardTitle>
              <CardDescription>
                Key performance metrics for user experience
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trendData.map((trend) => (
                  <div key={trend.metric} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">{trend.metric}</h4>
                      <Badge variant={
                        trend.rating === 'good' ? 'default' : 
                        trend.rating === 'needs-improvement' ? 'secondary' : 'destructive'
                      }>
                        {trend.rating}
                      </Badge>
                    </div>
                    <div className="text-2xl font-bold">
                      {formatMetricValue(trend.metric, trend.current)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Avg: {formatMetricValue(trend.metric, trend.average)}
                    </div>
                    {trend.data.length > 1 && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, (trend.current / (PERFORMANCE_THRESHOLDS[trend.metric as keyof typeof PERFORMANCE_THRESHOLDS]?.poor || trend.current)) * 100)}%`,
                            backgroundColor: getMetricColor(trend.rating),
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Real-time Charts */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>
                Real-time performance metric visualization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trendData.length > 0 ? (
                <div className="space-y-4">
                  {trendData.map((trend) => (
                    <div key={trend.metric} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{trend.metric}</span>
                        <span className="text-sm text-muted-foreground">
                          Current: {formatMetricValue(trend.metric, trend.current)}
                        </span>
                      </div>
                      <div className="relative">
                        <svg width="100%" height="60" className="overflow-visible">
                          <polyline
                            fill="none"
                            stroke={getMetricColor(trend.rating)}
                            strokeWidth="2"
                            points={trend.data.map((point, index) => {
                              const x = (index / (trend.data.length - 1)) * 100;
                              const maxValue = PERFORMANCE_THRESHOLDS[trend.metric as keyof typeof PERFORMANCE_THRESHOLDS]?.poor || trend.current;
                              const y = 100 - (point.value / maxValue) * 100;
                              return `${x},${y}`;
                            }).join(' ')}
                          />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No trend data available. Start interacting with the page to generate metrics.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Issues and Alerts */}
          {issues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Performance Issues</CardTitle>
                <CardDescription>
                  Active performance issues requiring attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {issues.slice(0, 10).map((issue) => (
                    <Alert key={issue.id} variant={issue.severity === 'critical' ? 'destructive' : 'default'}>
                      <AlertTitle>
                        <div className="flex justify-between items-center">
                          <span>{issue.type.replace('-', ' ').toUpperCase()}</span>
                          <Badge variant={issue.severity === 'critical' ? 'destructive' : 'secondary'}>
                            {issue.severity}
                          </Badge>
                        </div>
                      </AlertTitle>
                      <AlertDescription>
                        <div className="mt-2 space-y-1">
                          <p>{issue.description}</p>
                          <p className="text-sm text-muted-foreground">
                            Current: {issue.currentValue} | Threshold: {issue.threshold}
                          </p>
                          {issue.recommendations.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm font-medium">Recommendations:</p>
                              <ul className="text-sm text-muted-foreground ml-4">
                                {issue.recommendations.slice(0, 3).map((rec, index) => (
                                  <li key={index}>• {rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Test Results */}
          {testResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Performance Tests</CardTitle>
                <CardDescription>
                  Recent automated performance test results
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {testResults.slice(0, 5).map((result) => (
                    <div key={result.testId} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium">Test #{result.testId}</h4>
                          <p className="text-sm text-muted-foreground">
                            {new Date(result.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant={result.results.overallPass ? 'default' : 'destructive'}>
                          {result.results.overallPass ? 'PASS' : 'FAIL'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        {Object.entries(result.results.webVitals).map(([metric, data]) => (
                          <div key={metric}>
                            <span className="font-medium">{metric}:</span>
                            <span className="ml-1">{data.value.toFixed(1)}</span>
                            <Badge variant="outline" className="ml-1 text-xs">
                              {data.rating}
                            </Badge>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-sm">
                        <span className="font-medium">Score: {result.results.overallScore}/100</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PerformanceDashboard;