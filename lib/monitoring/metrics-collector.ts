/**
 * Real-Time Metrics Collection System
 * Collects performance metrics, system health data, and real-time event statistics
 */

import { webVitalsMonitor } from './web-vitals'
import { performanceAnalytics } from './performance-analytics'

// ============================================
// METRICS COLLECTION INTERFACES
// ============================================

export interface RealTimeMetrics {
    timestamp: number
    connectionStatus: 'connected' | 'disconnected' | 'reconnecting' | 'error'
    latency: number
    eventProcessingRate: number
    cacheHitRate: number
    memoryUsage: number
    activeUsers: number
    systemHealth: SystemHealthMetrics
    performanceScores: PerformanceScores
}

export interface SystemHealthMetrics {
    cpuUsage: number
    memoryUsage: number
    networkLatency: number
    errorRate: number
    uptime: number
    databaseConnections: number
    cacheHitRate: number
    eventProcessingRate: number
}

export interface PerformanceScores {
    overall: number
    latency: number
    throughput: number
    reliability: number
    userExperience: number
}

export interface EventFlowMetrics {
    eventsPerSecond: number
    eventsProcessed: number
    eventsFailed: number
    averageProcessingTime: number
    queueDepth: number
    processingLatency: number
}

export interface CacheMetrics {
    hitRate: number
    missRate: number
    averageResponseTime: number
    tierPerformance: {
        ultraCritical: CacheTierMetrics
        critical: CacheTierMetrics
        secondary: CacheTierMetrics
        detailed: CacheTierMetrics
    }
}

export interface CacheTierMetrics {
    hitRate: number
    averageResponseTime: number
    entries: number
    hits: number
    misses: number
}

// ============================================
// REAL-TIME METRICS COLLECTOR
// ============================================

export class MetricsCollector {
    private static instance: MetricsCollector
    private metricsBuffer: RealTimeMetrics[] = []
    private eventMetrics: EventFlowMetrics = {
        eventsPerSecond: 0,
        eventsProcessed: 0,
        eventsFailed: 0,
        averageProcessingTime: 0,
        queueDepth: 0,
        processingLatency: 0
    }
    private cacheMetrics: CacheMetrics = {
        hitRate: 0,
        missRate: 0,
        averageResponseTime: 0,
        tierPerformance: {
            ultraCritical: { hitRate: 0, averageResponseTime: 0, entries: 0, hits: 0, misses: 0 },
            critical: { hitRate: 0, averageResponseTime: 0, entries: 0, hits: 0, misses: 0 },
            secondary: { hitRate: 0, averageResponseTime: 0, entries: 0, hits: 0, misses: 0 },
            detailed: { hitRate: 0, averageResponseTime: 0, entries: 0, hits: 0, misses: 0 }
        }
    }
    private eventCounter = 0
    private eventTimestamps: number[] = []
    private processingTimes: number[] = []
    private maxBufferSize = 1000
    private collectionInterval?: NodeJS.Timeout
    private listeners: ((metrics: RealTimeMetrics) => void)[] = []

    constructor() {
        this.startMetricsCollection()
    }

    static getInstance(): MetricsCollector {
        if (!MetricsCollector.instance) {
            MetricsCollector.instance = new MetricsCollector()
        }
        return MetricsCollector.instance
    }

    /**
     * Start metrics collection with specified interval
     */
    private startMetricsCollection(intervalMs: number = 1000): void {
        this.collectionInterval = setInterval(() => {
            this.collectAndStoreMetrics()
        }, intervalMs)
    }

    /**
     * Collect real-time metrics from all systems
     */
    private async collectAndStoreMetrics(): Promise<void> {
        const timestamp = Date.now()

        try {
            // Collect Web Vitals metrics
            const webVitalsMetrics = webVitalsMonitor.getMetrics()

            // Collect performance analytics data
            const performanceData = performanceAnalytics.getSummary()

            // Collect system health metrics
            const systemHealth = await this.collectSystemHealthMetrics()

            // Collect cache metrics
            const cacheData = this.collectCacheMetrics()

            // Collect event flow metrics
            const eventData = this.collectEventFlowMetrics()

            // Calculate performance scores
            const performanceScores = this.calculatePerformanceScores(systemHealth, cacheData, eventData)

            const metrics: RealTimeMetrics = {
                timestamp,
                connectionStatus: this.getConnectionStatus(),
                latency: systemHealth.networkLatency,
                eventProcessingRate: eventData.eventsPerSecond,
                cacheHitRate: cacheData.hitRate,
                memoryUsage: systemHealth.memoryUsage,
                activeUsers: systemHealth.databaseConnections,
                systemHealth,
                performanceScores
            }

            this.addMetric(metrics)
            this.notifyListeners(metrics)
        } catch (error) {
            console.error('Error collecting metrics:', error)
        }
    }

    /**
     * Collect system health metrics
     */
    private async collectSystemHealthMetrics(): Promise<SystemHealthMetrics> {
        const memoryUsage = await this.getMemoryUsage()
        const networkLatency = await this.getNetworkLatency()
        const errorRate = this.calculateErrorRate()
        const uptime = this.getSystemUptime()

        return {
            cpuUsage: this.getCpuUsage(),
            memoryUsage,
            networkLatency,
            errorRate,
            uptime,
            databaseConnections: this.getDatabaseConnections(),
            cacheHitRate: this.cacheMetrics.hitRate,
            eventProcessingRate: this.eventMetrics.eventsPerSecond
        }
    }

    /**
     * Collect cache performance metrics
     */
    private collectCacheMetrics(): CacheMetrics {
        // This would integrate with actual cache system
        return {
            ...this.cacheMetrics,
            tierPerformance: { ...this.cacheMetrics.tierPerformance }
        }
    }

    /**
     * Collect event flow metrics
     */
    private collectEventFlowMetrics(): EventFlowMetrics {
        return { ...this.eventMetrics }
    }

    /**
     * Calculate performance scores based on collected metrics
     */
    private calculatePerformanceScores(
        systemHealth: SystemHealthMetrics,
        cacheMetrics: CacheMetrics,
        eventMetrics: EventFlowMetrics
    ): PerformanceScores {
        // Latency score (inverse of latency)
        const latencyScore = Math.max(0, 100 - (systemHealth.networkLatency / 10))

        // Throughput score (based on event processing rate)
        const throughputScore = Math.min(100, eventMetrics.eventsPerSecond * 2)

        // Reliability score (inverse of error rate)
        const reliabilityScore = Math.max(0, 100 - (systemHealth.errorRate * 100))

        // User experience score (combination of other scores)
        const userExperienceScore = (latencyScore + throughputScore + reliabilityScore) / 3

        // Overall score (weighted average)
        const overall = (latencyScore * 0.3 + throughputScore * 0.3 + reliabilityScore * 0.2 + userExperienceScore * 0.2)

        return {
            overall: Math.round(overall),
            latency: Math.round(latencyScore),
            throughput: Math.round(throughputScore),
            reliability: Math.round(reliabilityScore),
            userExperience: Math.round(userExperienceScore)
        }
    }

    /**
     * Get current connection status
     */
    private getConnectionStatus(): 'connected' | 'disconnected' | 'reconnecting' | 'error' {
        // This would check actual WebSocket/Supabase connection status
        const lastActivity = Date.now() - (this.eventTimestamps[this.eventTimestamps.length - 1] || 0)

        if (lastActivity > 30000) {
            return 'disconnected'
        }

        return 'connected'
    }

    /**
     * Get memory usage statistics
     */
    private async getMemoryUsage(): Promise<number> {
        if ('memory' in performance) {
            const memInfo = (performance as any).memory
            return Math.round((memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100)
        }
        return 0
    }

    /**
     * Get network latency
     */
    private async getNetworkLatency(): Promise<number> {
        try {
            const start = performance.now()
            await fetch('/api/health', { method: 'HEAD', cache: 'no-cache' })
            return Math.round(performance.now() - start)
        } catch {
            return 1000 // Default high latency on error
        }
    }

    /**
     * Calculate error rate
     */
    private calculateErrorRate(): number {
        const recentEvents = this.eventTimestamps.filter(t => Date.now() - t < 60000)
        const recentErrors = this.eventTimestamps.filter(t => Date.now() - t < 60000).length
        return recentEvents.length > 0 ? recentErrors / recentEvents.length : 0
    }

    /**
     * Get system uptime
     */
    private getSystemUptime(): number {
        // This would track actual system start time
        return Date.now() - (this as any).startTime || 0
    }

    /**
     * Get CPU usage (placeholder implementation)
     */
    private getCpuUsage(): number {
        // In a real implementation, this would use performance.now() and calculate
        return Math.random() * 20 + 10 // 10-30% for demo
    }

    /**
     * Get database connection count
     */
    private getDatabaseConnections(): number {
        // This would query actual database connection count
        return Math.floor(Math.random() * 10) + 5 // 5-15 connections for demo
    }

    /**
     * Record event processing
     */
    public recordEvent(eventType: string, processingTime: number, success: boolean): void {
        this.eventCounter++
        this.eventTimestamps.push(Date.now())

        if (success) {
            this.eventMetrics.eventsProcessed++
            this.processingTimes.push(processingTime)

            // Keep only recent processing times (last 100)
            if (this.processingTimes.length > 100) {
                this.processingTimes = this.processingTimes.slice(-100)
            }

            // Calculate average processing time
            this.eventMetrics.averageProcessingTime = this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length

            // Calculate events per second
            const recentEvents = this.eventTimestamps.filter(t => Date.now() - t < 1000)
            this.eventMetrics.eventsPerSecond = recentEvents.length
        } else {
            this.eventMetrics.eventsFailed++
        }

        // Clean up old timestamps
        this.eventTimestamps = this.eventTimestamps.filter(t => Date.now() - t < 60000)
    }

    /**
     * Record cache access
     */
    public recordCacheAccess(tier: keyof CacheMetrics['tierPerformance'], hit: boolean, responseTime: number): void {
        const tierMetrics = this.cacheMetrics.tierPerformance[tier]

        if (hit) {
            tierMetrics.hits++
        } else {
            tierMetrics.misses++
        }

        tierMetrics.entries++

        // Calculate hit rate
        const total = tierMetrics.hits + tierMetrics.misses
        tierMetrics.hitRate = total > 0 ? (tierMetrics.hits / total) * 100 : 0

        // Update average response time
        tierMetrics.averageResponseTime = (tierMetrics.averageResponseTime + responseTime) / 2

        // Calculate overall cache hit rate
        const totalHits = Object.values(this.cacheMetrics.tierPerformance).reduce((sum, tier) => sum + tier.hits, 0)
        const totalAccesses = Object.values(this.cacheMetrics.tierPerformance).reduce((sum, tier) => sum + tier.hits + tier.misses, 0)
        this.cacheMetrics.hitRate = totalAccesses > 0 ? (totalHits / totalAccesses) * 100 : 0

        this.cacheMetrics.averageResponseTime = responseTime
    }

    /**
     * Add metric to buffer
     */
    private addMetric(metrics: RealTimeMetrics): void {
        this.metricsBuffer.push(metrics)

        // Keep buffer size limited
        if (this.metricsBuffer.length > this.maxBufferSize) {
            this.metricsBuffer = this.metricsBuffer.slice(-this.maxBufferSize)
        }
    }

    /**
     * Get current metrics
     */
    public getCurrentMetrics(): RealTimeMetrics | null {
        return this.metricsBuffer.length > 0 ? this.metricsBuffer[this.metricsBuffer.length - 1] : null
    }

    /**
     * Get metrics history
     */
    public getMetricsHistory(limit: number = 100): RealTimeMetrics[] {
        return this.metricsBuffer.slice(-limit)
    }

    /**
     * Get real-time metrics snapshot (simplified implementation)
     */
    public getLatestMetrics(): RealTimeMetrics | null {
        return this.metricsBuffer.length > 0 ? this.metricsBuffer[this.metricsBuffer.length - 1] : null
    }

    /**
     * Add metric listener
     */
    public addListener(listener: (metrics: RealTimeMetrics) => void): void {
        this.listeners.push(listener)
    }

    /**
     * Remove metric listener
     */
    public removeListener(listener: (metrics: RealTimeMetrics) => void): void {
        this.listeners = this.listeners.filter(l => l !== listener)
    }

    /**
     * Notify all listeners of new metrics
     */
    private notifyListeners(metrics: RealTimeMetrics): void {
        this.listeners.forEach(listener => {
            try {
                listener(metrics)
            } catch (error) {
                console.error('Error in metrics listener:', error)
            }
        })
    }

    /**
     * Get performance summary
     */
    public getPerformanceSummary(): {
        overall: number
        latency: number
        throughput: number
        reliability: number
        issues: string[]
    } {
        const current = this.getCurrentMetrics()

        if (!current) {
            return {
                overall: 0,
                latency: 0,
                throughput: 0,
                reliability: 0,
                issues: ['No metrics available']
            }
        }

        const issues: string[] = []

        // Check for performance issues
        if (current.systemHealth.networkLatency > 500) {
            issues.push('High network latency detected')
        }

        if (current.systemHealth.errorRate > 0.05) {
            issues.push('High error rate detected')
        }

        if (current.cacheHitRate < 80) {
            issues.push('Low cache hit rate detected')
        }

        if (current.eventProcessingRate < 1) {
            issues.push('Low event processing rate')
        }

        return {
            overall: current.performanceScores.overall,
            latency: current.performanceScores.latency,
            throughput: current.performanceScores.throughput,
            reliability: current.performanceScores.reliability,
            issues
        }
    }

    /**
     * Export metrics data
     */
    public exportMetrics(format: 'json' | 'csv' = 'json'): string {
        const data = this.getMetricsHistory()

        if (format === 'json') {
            return JSON.stringify({
                metrics: data,
                summary: this.getPerformanceSummary(),
                exportedAt: new Date().toISOString()
            }, null, 2)
        }

        // Simple CSV export
        const headers = ['timestamp', 'latency', 'cacheHitRate', 'eventProcessingRate', 'memoryUsage', 'overallScore']
        const rows = data.map(m => [
            new Date(m.timestamp).toISOString(),
            m.latency,
            m.cacheHitRate,
            m.eventProcessingRate,
            m.memoryUsage,
            m.performanceScores.overall
        ])

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    }

    /**
     * Clean up resources
     */
    public cleanup(): void {
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval)
            this.collectionInterval = undefined
        }
        this.listeners = []
    }
}

// Export singleton instance
export const metricsCollector = MetricsCollector.getInstance()