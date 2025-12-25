/**
 * Enhanced Performance Analyzer
 * Provides deep performance analysis, trend detection, and optimization recommendations
 */

import { performanceAnalytics } from './performance-analytics'
import { metricsCollector, type RealTimeMetrics } from './metrics-collector'

// ============================================
// PERFORMANCE ANALYSIS INTERFACES
// ============================================

export interface PerformanceTrend {
    metric: string
    direction: 'improving' | 'degrading' | 'stable'
    changePercentage: number
    confidence: number
    severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface BottleneckAnalysis {
    type: 'cpu' | 'memory' | 'network' | 'database' | 'cache' | 'event-processing'
    severity: 'low' | 'medium' | 'high' | 'critical'
    impact: string
    recommendation: string
    estimatedImprovement: number
}

export interface OptimizationSuggestion {
    id: string
    category: 'performance' | 'reliability' | 'scalability' | 'cost'
    priority: 'low' | 'medium' | 'high' | 'critical'
    title: string
    description: string
    implementation: string[]
    estimatedImpact: string
    effort: 'low' | 'medium' | 'high'
    risk: 'low' | 'medium' | 'high'
}

export interface PerformanceReport {
    timestamp: number
    overallScore: number
    trendAnalysis: PerformanceTrend[]
    bottlenecks: BottleneckAnalysis[]
    suggestions: OptimizationSuggestion[]
    keyMetrics: {
        latency: number
        throughput: number
        errorRate: number
        availability: number
        userSatisfaction: number
    }
    historicalComparison: {
        period: 'hour' | 'day' | 'week' | 'month'
        scoreChange: number
        metricChanges: Record<string, number>
    }
}

// ============================================
// ENHANCED PERFORMANCE ANALYZER
// ============================================

export class PerformanceAnalyzer {
    private static instance: PerformanceAnalyzer
    private analysisHistory: PerformanceReport[] = []
    private maxHistorySize = 100

    constructor() {
        this.initializeAnalyzer()
    }

    static getInstance(): PerformanceAnalyzer {
        if (!PerformanceAnalyzer.instance) {
            PerformanceAnalyzer.instance = new PerformanceAnalyzer()
        }
        return PerformanceAnalyzer.instance
    }

    /**
     * Initialize the performance analyzer
     */
    private initializeAnalyzer(): void {
        // Set up periodic analysis
        setInterval(() => {
            this.runPeriodicAnalysis()
        }, 300000) // Every 5 minutes
    }

    /**
     * Run comprehensive performance analysis
     */
    public analyze(): PerformanceReport {
        const timestamp = Date.now()
        const currentMetrics = metricsCollector.getCurrentMetrics()
        const analyticsSummary = performanceAnalytics.getSummary()

        if (!currentMetrics) {
            throw new Error('No metrics available for analysis')
        }

        // Perform trend analysis
        const trendAnalysis = this.performTrendAnalysis(currentMetrics)

        // Identify bottlenecks
        const bottlenecks = this.identifyBottlenecks(currentMetrics, analyticsSummary)

        // Generate optimization suggestions
        const suggestions = this.generateOptimizationSuggestions(currentMetrics, bottlenecks)

        // Calculate key metrics
        const keyMetrics = this.calculateKeyMetrics(currentMetrics, analyticsSummary)

        // Perform historical comparison
        const historicalComparison = this.performHistoricalComparison(currentMetrics)

        const report: PerformanceReport = {
            timestamp,
            overallScore: keyMetrics.userSatisfaction, // Use user satisfaction as overall score
            trendAnalysis,
            bottlenecks,
            suggestions,
            keyMetrics,
            historicalComparison
        }

        // Store report in history
        this.addToHistory(report)

        return report
    }

    /**
     * Perform trend analysis on metrics
     */
    private performTrendAnalysis(currentMetrics: RealTimeMetrics): PerformanceTrend[] {
        const history = metricsCollector.getMetricsHistory(20) // Last 20 data points
        const trends: PerformanceTrend[] = []

        if (history.length < 2) {
            return trends
        }

        // Analyze latency trend
        const latencyTrend = this.analyzeMetricTrend(
            'latency',
            history.map(h => h.latency),
            currentMetrics.latency
        )
        trends.push({
            metric: 'latency',
            ...latencyTrend
        })

        // Analyze cache hit rate trend
        const cacheTrend = this.analyzeMetricTrend(
            'cacheHitRate',
            history.map(h => h.cacheHitRate),
            currentMetrics.cacheHitRate
        )
        trends.push({
            metric: 'cacheHitRate',
            ...cacheTrend
        })

        // Analyze event processing rate trend
        const eventTrend = this.analyzeMetricTrend(
            'eventProcessingRate',
            history.map(h => h.eventProcessingRate),
            currentMetrics.eventProcessingRate
        )
        trends.push({
            metric: 'eventProcessingRate',
            ...eventTrend
        })

        // Analyze memory usage trend
        const memoryTrend = this.analyzeMetricTrend(
            'memoryUsage',
            history.map(h => h.memoryUsage),
            currentMetrics.memoryUsage
        )
        trends.push({
            metric: 'memoryUsage',
            ...memoryTrend
        })

        // Analyze overall performance trend
        const performanceTrend = this.analyzeMetricTrend(
            'overall',
            history.map(h => h.performanceScores.overall),
            currentMetrics.performanceScores.overall
        )
        trends.push({
            metric: 'overall',
            ...performanceTrend
        })

        return trends
    }

    /**
     * Analyze trend for a specific metric
     */
    private analyzeMetricTrend(
        metricName: string,
        historicalValues: number[],
        currentValue: number
    ): {
        direction: 'improving' | 'degrading' | 'stable'
        changePercentage: number
        confidence: number
        severity: 'low' | 'medium' | 'high' | 'critical'
    } {
        if (historicalValues.length < 3) {
            return {
                direction: 'stable',
                changePercentage: 0,
                confidence: 0,
                severity: 'low'
            }
        }

        // Calculate trend using linear regression
        const n = historicalValues.length
        const sumX = historicalValues.reduce((sum, _, i) => sum + i, 0)
        const sumY = historicalValues.reduce((sum, val) => sum + val, 0)
        const sumXY = historicalValues.reduce((sum, val, i) => sum + i * val, 0)
        const sumXX = historicalValues.reduce((sum, _, i) => sum + i * i, 0)

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
        const intercept = (sumY - slope * sumX) / n

        // Calculate R-squared for confidence
        const meanY = sumY / n
        const totalSumSquares = historicalValues.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0)
        const residualSumSquares = historicalValues.reduce((sum, val, i) => {
            const predicted = slope * i + intercept
            return sum + Math.pow(val - predicted, 2)
        }, 0)
        const rSquared = 1 - (residualSumSquares / totalSumSquares)

        // Calculate change percentage
        const averageHistorical = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length
        const changePercentage = ((currentValue - averageHistorical) / averageHistorical) * 100

        // Determine direction
        let direction: 'improving' | 'degrading' | 'stable'
        const significantChange = Math.abs(changePercentage) > 5 // 5% threshold

        if (!significantChange) {
            direction = 'stable'
        } else if (slope > 0) {
            direction = metricName === 'latency' || metricName === 'memoryUsage' || metricName === 'errorRate'
                ? 'degrading' : 'improving'
        } else {
            direction = metricName === 'latency' || metricName === 'memoryUsage' || metricName === 'errorRate'
                ? 'improving' : 'degrading'
        }

        // Determine severity based on change percentage and confidence
        let severity: 'low' | 'medium' | 'high' | 'critical'
        const absChange = Math.abs(changePercentage)
        const confidence = Math.max(0, Math.min(1, rSquared))

        if (absChange > 20 && confidence > 0.8) {
            severity = 'critical'
        } else if (absChange > 15 && confidence > 0.7) {
            severity = 'high'
        } else if (absChange > 10 && confidence > 0.6) {
            severity = 'medium'
        } else {
            severity = 'low'
        }

        return {
            direction,
            changePercentage: Math.round(changePercentage * 100) / 100,
            confidence: Math.round(confidence * 100) / 100,
            severity
        }
    }

    /**
     * Identify performance bottlenecks
     */
    private identifyBottlenecks(currentMetrics: RealTimeMetrics, analyticsSummary: any): BottleneckAnalysis[] {
        const bottlenecks: BottleneckAnalysis[] = []
        const { systemHealth, performanceScores } = currentMetrics

        // CPU/Memory bottlenecks
        if (systemHealth.cpuUsage > 80) {
            bottlenecks.push({
                type: 'cpu',
                severity: systemHealth.cpuUsage > 90 ? 'critical' : 'high',
                impact: `High CPU usage at ${systemHealth.cpuUsage.toFixed(1)}%`,
                recommendation: 'Consider optimizing CPU-intensive operations or scaling resources',
                estimatedImprovement: 15
            })
        }

        if (systemHealth.memoryUsage > 85) {
            bottlenecks.push({
                type: 'memory',
                severity: systemHealth.memoryUsage > 95 ? 'critical' : 'high',
                impact: `High memory usage at ${systemHealth.memoryUsage.toFixed(1)}%`,
                recommendation: 'Optimize memory usage, implement garbage collection, or increase memory limits',
                estimatedImprovement: 20
            })
        }

        // Network latency bottlenecks
        if (systemHealth.networkLatency > 500) {
            bottlenecks.push({
                type: 'network',
                severity: systemHealth.networkLatency > 1000 ? 'critical' : 'high',
                impact: `High network latency at ${systemHealth.networkLatency}ms`,
                recommendation: 'Optimize network requests, implement request caching, or upgrade network infrastructure',
                estimatedImprovement: 25
            })
        }

        // Cache bottlenecks
        if (currentMetrics.cacheHitRate < 80) {
            bottlenecks.push({
                type: 'cache',
                severity: currentMetrics.cacheHitRate < 60 ? 'critical' : 'medium',
                impact: `Low cache hit rate at ${currentMetrics.cacheHitRate.toFixed(1)}%`,
                recommendation: 'Review cache configuration, increase cache TTL, or optimize cache key strategies',
                estimatedImprovement: 18
            })
        }

        // Event processing bottlenecks
        if (currentMetrics.eventProcessingRate < 1) {
            bottlenecks.push({
                type: 'event-processing',
                severity: 'medium',
                impact: 'Low event processing rate',
                recommendation: 'Optimize event processing pipeline, implement batch processing, or scale event handlers',
                estimatedImprovement: 30
            })
        }

        // Error rate bottlenecks
        if (systemHealth.errorRate > 0.05) {
            bottlenecks.push({
                type: 'database',
                severity: systemHealth.errorRate > 0.1 ? 'critical' : 'high',
                impact: `High error rate at ${(systemHealth.errorRate * 100).toFixed(2)}%`,
                recommendation: 'Implement better error handling, add retry mechanisms, and improve system reliability',
                estimatedImprovement: 35
            })
        }

        return bottlenecks.sort((a, b) => {
            const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
            return severityOrder[b.severity] - severityOrder[a.severity]
        })
    }

    /**
     * Generate optimization suggestions
     */
    private generateOptimizationSuggestions(
        currentMetrics: RealTimeMetrics,
        bottlenecks: BottleneckAnalysis[]
    ): OptimizationSuggestion[] {
        const suggestions: OptimizationSuggestion[] = []

        // Memory optimization
        if (currentMetrics.memoryUsage > 75) {
            suggestions.push({
                id: 'memory-optimization',
                category: 'performance',
                priority: currentMetrics.memoryUsage > 90 ? 'critical' : 'high',
                title: 'Optimize Memory Usage',
                description: 'Implement memory optimization strategies to reduce heap usage and prevent memory leaks',
                implementation: [
                    'Review and optimize data structures for memory efficiency',
                    'Implement proper cleanup for event listeners and timers',
                    'Use object pooling for frequently created/destroyed objects',
                    'Optimize image and asset loading with lazy loading',
                    'Consider implementing virtual scrolling for large lists'
                ],
                estimatedImpact: '15-25% reduction in memory usage',
                effort: 'medium',
                risk: 'low'
            })
        }

        // Cache optimization
        if (currentMetrics.cacheHitRate < 85) {
            suggestions.push({
                id: 'cache-optimization',
                category: 'performance',
                priority: currentMetrics.cacheHitRate < 70 ? 'high' : 'medium',
                title: 'Improve Cache Hit Rate',
                description: 'Optimize caching strategies to increase cache effectiveness and reduce database load',
                implementation: [
                    'Review and optimize cache key generation strategy',
                    'Implement smarter cache invalidation policies',
                    'Add cache warming for frequently accessed data',
                    'Consider implementing multi-level caching',
                    'Optimize cache TTL values based on data freshness requirements'
                ],
                estimatedImpact: '20-30% improvement in cache hit rate',
                effort: 'medium',
                risk: 'low'
            })
        }

        // Network optimization
        if (currentMetrics.latency > 200) {
            suggestions.push({
                id: 'network-optimization',
                category: 'performance',
                priority: currentMetrics.latency > 500 ? 'critical' : 'high',
                title: 'Reduce Network Latency',
                description: 'Implement network optimization strategies to improve response times',
                implementation: [
                    'Implement request batching for multiple API calls',
                    'Add HTTP/2 server push for critical resources',
                    'Optimize database queries and add proper indexing',
                    'Implement connection pooling for database connections',
                    'Use CDN for static assets and global content delivery'
                ],
                estimatedImpact: '25-40% reduction in network latency',
                effort: 'high',
                risk: 'medium'
            })
        }

        // Event processing optimization
        if (currentMetrics.eventProcessingRate < 2) {
            suggestions.push({
                id: 'event-processing-optimization',
                category: 'scalability',
                priority: 'medium',
                title: 'Optimize Event Processing',
                description: 'Improve event processing pipeline for better throughput and reliability',
                implementation: [
                    'Implement event batching for high-volume scenarios',
                    'Add parallel processing for independent events',
                    'Optimize event filtering and routing logic',
                    'Implement backpressure handling for event overflow',
                    'Add monitoring and alerting for event processing delays'
                ],
                estimatedImpact: '50-100% improvement in event processing rate',
                effort: 'high',
                risk: 'medium'
            })
        }

        // Error handling improvement
        if (currentMetrics.systemHealth.errorRate > 0.02) {
            suggestions.push({
                id: 'error-handling-improvement',
                category: 'reliability',
                priority: currentMetrics.systemHealth.errorRate > 0.05 ? 'critical' : 'high',
                title: 'Improve Error Handling',
                description: 'Implement comprehensive error handling and recovery mechanisms',
                implementation: [
                    'Add retry logic with exponential backoff for failed operations',
                    'Implement circuit breaker pattern for external service calls',
                    'Add proper error boundaries and fallback mechanisms',
                    'Implement comprehensive logging and error tracking',
                    'Add health checks and automated recovery procedures'
                ],
                estimatedImpact: '60-80% reduction in error rate',
                effort: 'medium',
                risk: 'low'
            })
        }

        // Scalability improvements
        if (currentMetrics.activeUsers > 50) {
            suggestions.push({
                id: 'scalability-improvements',
                category: 'scalability',
                priority: 'medium',
                title: 'Implement Scalability Improvements',
                description: 'Prepare system for increased load and user growth',
                implementation: [
                    'Implement horizontal scaling for database connections',
                    'Add load balancing for high-traffic endpoints',
                    'Implement auto-scaling for compute resources',
                    'Add performance monitoring and alerting',
                    'Optimize database queries and implement read replicas'
                ],
                estimatedImpact: 'Support 2-5x more concurrent users',
                effort: 'high',
                risk: 'medium'
            })
        }

        return suggestions.sort((a, b) => {
            const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
            return priorityOrder[b.priority] - priorityOrder[a.priority]
        })
    }

    /**
     * Calculate key performance metrics
     */
    private calculateKeyMetrics(currentMetrics: RealTimeMetrics, analyticsSummary: any): {
        latency: number
        throughput: number
        errorRate: number
        availability: number
        userSatisfaction: number
    } {
        const { systemHealth, performanceScores, latency } = currentMetrics

        // Latency score (0-100, higher is better)
        const latencyScore = Math.max(0, 100 - (latency / 10))

        // Throughput score (based on event processing rate)
        const throughputScore = Math.min(100, currentMetrics.eventProcessingRate * 10)

        // Error rate score (0-100, higher is better)
        const errorRateScore = Math.max(0, 100 - (systemHealth.errorRate * 1000))

        // Availability score (based on connection status and error rate)
        const availabilityScore = systemHealth.errorRate < 0.01 ? 100 :
            systemHealth.errorRate < 0.05 ? 75 :
                systemHealth.errorRate < 0.1 ? 50 : 25

        // User satisfaction (weighted combination of all metrics)
        const userSatisfaction = Math.round(
            latencyScore * 0.25 +
            throughputScore * 0.25 +
            errorRateScore * 0.25 +
            availabilityScore * 0.25
        )

        return {
            latency: latencyScore,
            throughput: throughputScore,
            errorRate: errorRateScore,
            availability: availabilityScore,
            userSatisfaction
        }
    }

    /**
     * Perform historical comparison
     */
    private performHistoricalComparison(currentMetrics: RealTimeMetrics): {
        period: 'hour' | 'day' | 'week' | 'month'
        scoreChange: number
        metricChanges: Record<string, number>
    } {
        const history = metricsCollector.getMetricsHistory(100)

        if (history.length < 10) {
            return {
                period: 'day',
                scoreChange: 0,
                metricChanges: {}
            }
        }

        // Calculate current score
        const currentScore = currentMetrics.performanceScores.overall

        // Find baseline from 24 hours ago (or earliest available)
        const baselineIndex = Math.max(0, history.length - 24) // Assuming hourly data points
        const baselineScore = history[baselineIndex]?.performanceScores.overall || currentScore

        // Calculate score change
        const scoreChange = ((currentScore - baselineScore) / baselineScore) * 100

        // Calculate metric changes
        const metricChanges: Record<string, number> = {}

        if (history[baselineIndex]) {
            metricChanges.latency = ((currentMetrics.latency - history[baselineIndex].latency) / history[baselineIndex].latency) * 100
            metricChanges.cacheHitRate = currentMetrics.cacheHitRate - history[baselineIndex].cacheHitRate
            metricChanges.eventProcessingRate = ((currentMetrics.eventProcessingRate - history[baselineIndex].eventProcessingRate) / history[baselineIndex].eventProcessingRate) * 100
            metricChanges.memoryUsage = currentMetrics.memoryUsage - history[baselineIndex].memoryUsage
            metricChanges.errorRate = ((currentMetrics.systemHealth.errorRate - history[baselineIndex].systemHealth.errorRate) / history[baselineIndex].systemHealth.errorRate) * 100
        }

        return {
            period: 'day',
            scoreChange: Math.round(scoreChange * 100) / 100,
            metricChanges
        }
    }

    /**
     * Add report to history
     */
    private addToHistory(report: PerformanceReport): void {
        this.analysisHistory.push(report)

        // Keep only recent reports
        if (this.analysisHistory.length > this.maxHistorySize) {
            this.analysisHistory = this.analysisHistory.slice(-this.maxHistorySize)
        }
    }

    /**
     * Get analysis history
     */
    public getAnalysisHistory(): PerformanceReport[] {
        return [...this.analysisHistory]
    }

    /**
     * Get latest analysis report
     */
    public getLatestReport(): PerformanceReport | null {
        return this.analysisHistory.length > 0 ? this.analysisHistory[this.analysisHistory.length - 1] : null
    }

    /**
     * Run periodic analysis
     */
    private runPeriodicAnalysis(): void {
        try {
            const report = this.analyze()
            console.log('[PERFORMANCE-ANALYZER] Periodic analysis completed:', {
                score: report.overallScore,
                bottlenecks: report.bottlenecks.length,
                suggestions: report.suggestions.length
            })
        } catch (error) {
            console.error('[PERFORMANCE-ANALYZER] Periodic analysis failed:', error)
        }
    }

    /**
     * Export analysis report
     */
    public exportReport(format: 'json' | 'csv' = 'json'): string {
        const report = this.getLatestReport()
        if (!report) {
            throw new Error('No analysis report available')
        }

        if (format === 'json') {
            return JSON.stringify({
                report,
                history: this.analysisHistory,
                exportedAt: new Date().toISOString()
            }, null, 2)
        }

        // Simple CSV export for key metrics
        const csv = [
            'Metric,Current Value,Trend,Change %,Severity',
            `Overall Score,${report.overallScore},${report.trendAnalysis.find(t => t.metric === 'overall')?.direction || 'N/A'},${report.trendAnalysis.find(t => t.metric === 'overall')?.changePercentage || 0}%,${report.trendAnalysis.find(t => t.metric === 'overall')?.severity || 'N/A'}`,
            `Latency Score,${report.keyMetrics.latency},${report.trendAnalysis.find(t => t.metric === 'latency')?.direction || 'N/A'},${report.trendAnalysis.find(t => t.metric === 'latency')?.changePercentage || 0}%,${report.trendAnalysis.find(t => t.metric === 'latency')?.severity || 'N/A'}`,
            `Throughput Score,${report.keyMetrics.throughput},${report.trendAnalysis.find(t => t.metric === 'eventProcessingRate')?.direction || 'N/A'},${report.trendAnalysis.find(t => t.metric === 'eventProcessingRate')?.changePercentage || 0}%,${report.trendAnalysis.find(t => t.metric === 'eventProcessingRate')?.severity || 'N/A'}`,
            `Error Rate Score,${report.keyMetrics.errorRate},${report.trendAnalysis.find(t => t.metric === 'errorRate')?.direction || 'N/A'},${report.trendAnalysis.find(t => t.metric === 'errorRate')?.changePercentage || 0}%,${report.trendAnalysis.find(t => t.metric === 'errorRate')?.severity || 'N/A'}`
        ].join('\n')

        return csv
    }

    /**
     * Clean up resources
     */
    public cleanup(): void {
        this.analysisHistory = []
    }
}

// Export singleton instance
export const performanceAnalyzer = PerformanceAnalyzer.getInstance()