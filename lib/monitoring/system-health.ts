/**
 * System Health Monitoring and Alerting
 * Provides comprehensive system health tracking, alerting, and auto-recovery diagnostics
 */

import { metricsCollector } from './metrics-collector'
import { performanceAnalyzer } from './performance-analyzer'
import { getEventBroadcaster } from '@/lib/events/event-broadcaster'

// ============================================
// HEALTH MONITORING INTERFACES
// ============================================

export interface HealthAlert {
    id: string
    severity: 'info' | 'warning' | 'error' | 'critical'
    category: 'performance' | 'availability' | 'security' | 'resource' | 'application'
    title: string
    message: string
    timestamp: number
    acknowledged: boolean
    resolved: boolean
    source: string
    metadata?: Record<string, any>
    recommendedAction?: string
}

export interface HealthThreshold {
    metric: string
    warningThreshold: number
    criticalThreshold: number
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
    duration: number // in seconds
}

export interface SystemHealthStatus {
    overall: 'healthy' | 'degraded' | 'critical' | 'unknown'
    components: ComponentHealth[]
    alerts: HealthAlert[]
    uptime: number
    lastCheck: number
    checkInterval: number
}

export interface ComponentHealth {
    name: string
    status: 'healthy' | 'degraded' | 'critical' | 'offline'
    health: number // 0-100
    lastCheck: number
    responseTime?: number
    errorRate?: number
    details?: string
    dependencies?: string[]
}

export interface RecoveryAction {
    id: string
    name: string
    description: string
    automation: 'manual' | 'semi-automated' | 'automated'
    prerequisites: string[]
    steps: string[]
    estimatedDuration: number
    risk: 'low' | 'medium' | 'high'
    successRate: number
}

// ============================================
// SYSTEM HEALTH MONITOR
// ============================================

export class SystemHealthMonitor {
    private static instance: SystemHealthMonitor
    private alerts: HealthAlert[] = []
    private thresholds: Map<string, HealthThreshold> = new Map()
    private checkInterval: NodeJS.Timeout | null = null
    private listeners: ((status: SystemHealthStatus) => void)[] = []
    private alertHistory: HealthAlert[] = []
    private maxAlertsHistory = 1000
    private recoveryActions: Map<string, RecoveryAction> = new Map()

    constructor() {
        this.initializeDefaultThresholds()
        this.initializeRecoveryActions()
        this.startHealthChecks()
    }

    static getInstance(): SystemHealthMonitor {
        if (!SystemHealthMonitor.instance) {
            SystemHealthMonitor.instance = new SystemHealthMonitor()
        }
        return SystemHealthMonitor.instance
    }

    /**
     * Initialize default health thresholds
     */
    private initializeDefaultThresholds(): void {
        const defaultThresholds: HealthThreshold[] = [
            {
                metric: 'latency',
                warningThreshold: 300,
                criticalThreshold: 1000,
                operator: 'gt',
                duration: 60
            },
            {
                metric: 'cacheHitRate',
                warningThreshold: 80,
                criticalThreshold: 60,
                operator: 'lt',
                duration: 120
            },
            {
                metric: 'memoryUsage',
                warningThreshold: 80,
                criticalThreshold: 95,
                operator: 'gt',
                duration: 30
            },
            {
                metric: 'errorRate',
                warningThreshold: 0.02,
                criticalThreshold: 0.05,
                operator: 'gt',
                duration: 30
            },
            {
                metric: 'eventProcessingRate',
                warningThreshold: 1,
                criticalThreshold: 0.5,
                operator: 'lt',
                duration: 60
            },
            {
                metric: 'cpuUsage',
                warningThreshold: 80,
                criticalThreshold: 95,
                operator: 'gt',
                duration: 120
            }
        ]

        defaultThresholds.forEach(threshold => {
            this.thresholds.set(threshold.metric, threshold)
        })
    }

    /**
     * Initialize recovery actions
     */
    private initializeRecoveryActions(): void {
        const actions: RecoveryAction[] = [
            {
                id: 'clear-cache',
                name: 'Clear System Cache',
                description: 'Clear all cache tiers to resolve memory pressure or stale data issues',
                automation: 'semi-automated',
                prerequisites: ['User confirmation required'],
                steps: [
                    'Clear ultra-critical cache tier',
                    'Clear critical cache tier',
                    'Clear secondary cache tier',
                    'Clear detailed cache tier',
                    'Restart cache warm-up process'
                ],
                estimatedDuration: 30,
                risk: 'low',
                successRate: 95
            },
            {
                id: 'restart-event-processing',
                name: 'Restart Event Processing',
                description: 'Restart event processing pipeline to resolve processing bottlenecks',
                automation: 'automated',
                prerequisites: ['System health monitoring active'],
                steps: [
                    'Pause event processing',
                    'Clear event queues',
                    'Reset event processing counters',
                    'Restart event processors',
                    'Verify event flow recovery'
                ],
                estimatedDuration: 15,
                risk: 'low',
                successRate: 90
            },
            {
                id: 'restart-websocket-connections',
                name: 'Restart WebSocket Connections',
                description: 'Restart WebSocket connections to resolve connectivity issues',
                automation: 'automated',
                prerequisites: ['Connection health monitoring active'],
                steps: [
                    'Disconnect all WebSocket channels',
                    'Clear connection state',
                    'Re-establish connections',
                    'Verify connection health',
                    'Update connection metrics'
                ],
                estimatedDuration: 10,
                risk: 'low',
                successRate: 98
            },
            {
                id: 'restart-system',
                name: 'System Restart',
                description: 'Full system restart to resolve critical issues',
                automation: 'manual',
                prerequisites: ['Administrator approval required', 'Maintenance window scheduled'],
                steps: [
                    'Notify all users of maintenance',
                    'Gracefully shutdown services',
                    'Restart application servers',
                    'Restart database connections',
                    'Verify all services are healthy',
                    'Notify users of system restoration'
                ],
                estimatedDuration: 300,
                risk: 'high',
                successRate: 100
            }
        ]

        actions.forEach(action => {
            this.recoveryActions.set(action.id, action)
        })
    }

    /**
     * Start health monitoring checks
     */
    private startHealthChecks(intervalMs: number = 30000): void {
        this.checkInterval = setInterval(() => {
            this.performHealthCheck()
        }, intervalMs)

        // Run initial check
        this.performHealthCheck()
    }

    /**
     * Perform comprehensive health check
     */
    private performHealthCheck(): void {
        try {
            const currentMetrics = metricsCollector.getCurrentMetrics()

            if (!currentMetrics) {
                this.createAlert({
                    severity: 'error',
                    category: 'availability',
                    title: 'No Metrics Available',
                    message: 'System metrics are not being collected',
                    source: 'system-health-monitor'
                })
                return
            }

            // Check all thresholds
            this.checkThresholds(currentMetrics)

            // Check component health
            const components = this.checkComponentHealth(currentMetrics)

            // Determine overall health status
            const overall = this.calculateOverallHealth(components)

            // Create health status object
            const status: SystemHealthStatus = {
                overall,
                components,
                alerts: this.getActiveAlerts(),
                uptime: this.getSystemUptime(),
                lastCheck: Date.now(),
                checkInterval: 30000
            }

            // Notify listeners
            this.notifyListeners(status)

            // Auto-recovery diagnostics
            this.performAutoRecovery(status)

        } catch (error) {
            console.error('[SYSTEM-HEALTH] Health check failed:', error)
            this.createAlert({
                severity: 'critical',
                category: 'availability',
                title: 'Health Check Failure',
                message: `Health check failed: ${error}`,
                source: 'system-health-monitor'
            })
        }
    }

    /**
     * Check metric thresholds
     */
    private checkThresholds(metrics: any): void {
        this.thresholds.forEach((threshold, metricName) => {
            const value = this.getMetricValue(metrics, metricName)

            if (value === undefined || value === null) return

            const isBreached = this.evaluateThreshold(value, threshold)
            const severity = this.calculateSeverity(value, threshold)

            if (isBreached) {
                this.createAlert({
                    severity,
                    category: 'performance',
                    title: `${metricName} Threshold Breach`,
                    message: `${metricName} is ${value} (threshold: ${threshold.warningThreshold})`,
                    source: 'threshold-monitor',
                    metadata: {
                        metric: metricName,
                        value,
                        threshold,
                        breachTime: Date.now()
                    },
                    recommendedAction: this.getRecommendedAction(metricName, severity)
                })
            }
        })
    }

    /**
     * Get metric value from metrics object
     */
    private getMetricValue(metrics: any, metricName: string): number | undefined {
        switch (metricName) {
            case 'latency': return metrics.latency
            case 'cacheHitRate': return metrics.cacheHitRate
            case 'memoryUsage': return metrics.memoryUsage
            case 'errorRate': return metrics.systemHealth.errorRate
            case 'eventProcessingRate': return metrics.eventProcessingRate
            case 'cpuUsage': return metrics.systemHealth.cpuUsage
            default: return undefined
        }
    }

    /**
     * Evaluate threshold condition
     */
    private evaluateThreshold(value: number, threshold: HealthThreshold): boolean {
        switch (threshold.operator) {
            case 'gt': return value > threshold.warningThreshold
            case 'gte': return value >= threshold.warningThreshold
            case 'lt': return value < threshold.warningThreshold
            case 'lte': return value <= threshold.warningThreshold
            case 'eq': return value === threshold.warningThreshold
            default: return false
        }
    }

    /**
     * Calculate alert severity based on threshold
     */
    private calculateSeverity(value: number, threshold: HealthThreshold): HealthAlert['severity'] {
        const { warningThreshold, criticalThreshold } = threshold

        switch (threshold.operator) {
            case 'gt':
            case 'gte':
                if (value >= criticalThreshold) return 'critical'
                if (value >= warningThreshold) return 'error'
                break
            case 'lt':
            case 'lte':
                if (value <= criticalThreshold) return 'critical'
                if (value <= warningThreshold) return 'error'
                break
            case 'eq':
                if (value === criticalThreshold) return 'critical'
                if (value === warningThreshold) return 'warning'
                break
        }

        return 'info'
    }

    /**
     * Check health of individual components
     */
    private checkComponentHealth(metrics: any): ComponentHealth[] {
        const components: ComponentHealth[] = []

        // Database Health
        components.push({
            name: 'Database',
            status: this.getComponentStatus(metrics.systemHealth.errorRate, 0.01, 0.05),
            health: this.calculateComponentHealth(metrics.systemHealth.errorRate, 0.01, 0.05),
            lastCheck: Date.now(),
            responseTime: metrics.latency,
            errorRate: metrics.systemHealth.errorRate,
            details: `Error rate: ${(metrics.systemHealth.errorRate * 100).toFixed(2)}%`
        })

        // Cache System Health
        components.push({
            name: 'Cache System',
            status: this.getComponentStatus(100 - metrics.cacheHitRate, 20, 40),
            health: metrics.cacheHitRate,
            lastCheck: Date.now(),
            responseTime: 10, // Cache response time
            details: `Hit rate: ${metrics.cacheHitRate.toFixed(1)}%`
        })

        // WebSocket Connections Health
        const broadcaster = getEventBroadcaster()
        const channelHealth = broadcaster.getAllChannelsHealth()
        const connectionHealth = channelHealth.length > 0 ?
            (channelHealth.filter(ch => ch.status === 'connected').length / channelHealth.length) * 100 : 0

        components.push({
            name: 'WebSocket Connections',
            status: this.getComponentStatus(100 - connectionHealth, 20, 50),
            health: connectionHealth,
            lastCheck: Date.now(),
            details: `${channelHealth.filter(ch => ch.status === 'connected').length}/${channelHealth.length} channels connected`
        })

        // Event Processing Health
        components.push({
            name: 'Event Processing',
            status: metrics.eventProcessingRate >= 1 ? 'healthy' : (metrics.eventProcessingRate >= 0.5 ? 'degraded' : 'critical'),
            health: Math.min(100, metrics.eventProcessingRate * 100),
            lastCheck: Date.now(),
            details: `${metrics.eventProcessingRate.toFixed(1)} events/sec`
        })

        // Memory Health
        components.push({
            name: 'Memory',
            status: this.getComponentStatus(metrics.memoryUsage, 80, 95),
            health: 100 - metrics.memoryUsage,
            lastCheck: Date.now(),
            details: `${metrics.memoryUsage.toFixed(1)}% used`
        })

        return components
    }

    /**
     * Get component status from health score
     */
    private getComponentStatus(negativeMetric: number, warningThreshold: number, criticalThreshold: number): ComponentHealth['status'] {
        if (negativeMetric >= criticalThreshold) return 'critical'
        if (negativeMetric >= warningThreshold) return 'degraded'
        return 'healthy'
    }

    /**
     * Calculate component health score
     */
    private calculateComponentHealth(metricValue: number, goodThreshold: number, poorThreshold: number): number {
        if (metricValue >= goodThreshold) return 100
        if (metricValue <= poorThreshold) return 0

        // Linear interpolation between poor and good thresholds
        return ((metricValue - poorThreshold) / (goodThreshold - poorThreshold)) * 100
    }

    /**
     * Calculate overall system health
     */
    private calculateOverallHealth(components: ComponentHealth[]): SystemHealthStatus['overall'] {
        const criticalComponents = components.filter(c => c.status === 'critical').length
        const degradedComponents = components.filter(c => c.status === 'degraded').length

        if (criticalComponents > 0) return 'critical'
        if (degradedComponents >= components.length * 0.5) return 'critical'
        if (degradedComponents > 0) return 'degraded'
        return 'healthy'
    }

    /**
     * Create health alert
     */
    private createAlert(alertData: Omit<HealthAlert, 'id' | 'timestamp' | 'acknowledged' | 'resolved'>): void {
        const alert: HealthAlert = {
            id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            acknowledged: false,
            resolved: false,
            ...alertData
        }

        this.alerts.push(alert)
        this.alertHistory.push(alert)

        // Keep alert history size manageable
        if (this.alertHistory.length > this.maxAlertsHistory) {
            this.alertHistory = this.alertHistory.slice(-this.maxAlertsHistory)
        }

        // Log alert
        const logLevel = alert.severity === 'critical' ? 'error' :
            alert.severity === 'error' ? 'warn' : 'info'

        console.log(`[SYSTEM-HEALTH] [${logLevel.toUpperCase()}] ${alert.title}: ${alert.message}`)
    }

    /**
     * Get recommended action for metric
     */
    private getRecommendedAction(metricName: string, severity: HealthAlert['severity']): string {
        switch (metricName) {
            case 'latency':
                return 'Consider optimizing database queries and implementing caching strategies'
            case 'cacheHitRate':
                return 'Review cache configuration and increase cache TTL for frequently accessed data'
            case 'memoryUsage':
                return 'Optimize memory usage and consider increasing available memory'
            case 'errorRate':
                return 'Investigate error patterns and implement better error handling'
            case 'eventProcessingRate':
                return 'Optimize event processing pipeline and consider scaling resources'
            case 'cpuUsage':
                return 'Review CPU-intensive operations and consider optimizing algorithms'
            default:
                return 'Monitor the metric and investigate if the issue persists'
        }
    }

    /**
     * Perform auto-recovery diagnostics
     */
    private performAutoRecovery(status: SystemHealthStatus): void {
        if (status.overall === 'healthy') return

        // Check if we can automatically resolve issues
        if (status.overall === 'degraded') {
            const criticalAlerts = status.alerts.filter(a => a.severity === 'critical' && !a.acknowledged)

            for (const alert of criticalAlerts) {
                if (alert.recommendedAction?.includes('clear cache')) {
                    this.attemptAutoRecovery('clear-cache')
                } else if (alert.recommendedAction?.includes('restart')) {
                    this.attemptAutoRecovery('restart-event-processing')
                }
            }
        }
    }

    /**
     * Attempt automatic recovery
     */
    private attemptAutoRecovery(actionId: string): void {
        const action = this.recoveryActions.get(actionId)
        if (!action) return

        if (action.automation === 'automated') {
            console.log(`[SYSTEM-HEALTH] Attempting automatic recovery: ${action.name}`)

            // Simulate recovery action
            setTimeout(() => {
                this.createAlert({
                    severity: 'info',
                    category: 'availability',
                    title: 'Auto-Recovery Executed',
                    message: `${action.name} completed successfully`,
                    source: 'auto-recovery'
                })

                // Run another health check to verify recovery
                setTimeout(() => this.performHealthCheck(), 5000)
            }, action.estimatedDuration * 1000)
        }
    }

    /**
     * Get active alerts
     */
    private getActiveAlerts(): HealthAlert[] {
        return this.alerts.filter(alert => !alert.resolved)
    }

    /**
     * Get system uptime
     */
    private getSystemUptime(): number {
        // This would track actual system start time
        return Date.now() - (this as any).startTime || 0
    }

    /**
     * Notify all listeners of health status
     */
    private notifyListeners(status: SystemHealthStatus): void {
        this.listeners.forEach(listener => {
            try {
                listener(status)
            } catch (error) {
                console.error('[SYSTEM-HEALTH] Error notifying listener:', error)
            }
        })
    }

    /**
     * Public methods for external use
     */

    /**
     * Get current system health status
     */
    public getSystemHealthStatus(): SystemHealthStatus {
        const currentMetrics = metricsCollector.getCurrentMetrics()
        if (!currentMetrics) {
            return {
                overall: 'unknown',
                components: [],
                alerts: this.getActiveAlerts(),
                uptime: this.getSystemUptime(),
                lastCheck: Date.now(),
                checkInterval: 30000
            }
        }

        const components = this.checkComponentHealth(currentMetrics)
        const overall = this.calculateOverallHealth(components)

        return {
            overall,
            components,
            alerts: this.getActiveAlerts(),
            uptime: this.getSystemUptime(),
            lastCheck: Date.now(),
            checkInterval: 30000
        }
    }

    /**
     * Get all alerts (active and resolved)
     */
    public getAllAlerts(): HealthAlert[] {
        return [...this.alertHistory]
    }

    /**
     * Acknowledge an alert
     */
    public acknowledgeAlert(alertId: string): void {
        const alert = this.alerts.find(a => a.id === alertId)
        if (alert) {
            alert.acknowledged = true
        }
    }

    /**
     * Resolve an alert
     */
    public resolveAlert(alertId: string): void {
        const alert = this.alerts.find(a => a.id === alertId)
        if (alert) {
            alert.resolved = true
            alert.acknowledged = true
        }
    }

    /**
     * Add health status listener
     */
    public addListener(listener: (status: SystemHealthStatus) => void): void {
        this.listeners.push(listener)
    }

    /**
     * Remove health status listener
     */
    public removeListener(listener: (status: SystemHealthStatus) => void): void {
        this.listeners = this.listeners.filter(l => l !== listener)
    }

    /**
     * Execute recovery action
     */
    public executeRecoveryAction(actionId: string): Promise<boolean> {
        const action = this.recoveryActions.get(actionId)
        if (!action) {
            return Promise.reject(new Error(`Recovery action ${actionId} not found`))
        }

        return new Promise((resolve) => {
            this.createAlert({
                severity: 'info',
                category: 'availability',
                title: 'Recovery Action Started',
                message: `Executing: ${action.name}`,
                source: 'recovery-system'
            })

            // Simulate action execution
            setTimeout(() => {
                const success = Math.random() > 0.1 // 90% success rate

                this.createAlert({
                    severity: success ? 'info' : 'error',
                    category: 'availability',
                    title: success ? 'Recovery Action Completed' : 'Recovery Action Failed',
                    message: `${action.name} ${success ? 'completed successfully' : 'failed'}`,
                    source: 'recovery-system'
                })

                if (success) {
                    // Run health check to verify recovery
                    setTimeout(() => this.performHealthCheck(), 5000)
                }

                resolve(success)
            }, action.estimatedDuration * 1000)
        })
    }

    /**
     * Get available recovery actions
     */
    public getRecoveryActions(): RecoveryAction[] {
        return Array.from(this.recoveryActions.values())
    }

    /**
     * Set custom threshold
     */
    public setThreshold(threshold: HealthThreshold): void {
        this.thresholds.set(threshold.metric, threshold)
    }

    /**
     * Remove threshold
     */
    public removeThreshold(metricName: string): void {
        this.thresholds.delete(metricName)
    }

    /**
     * Export health report
     */
    public exportHealthReport(): string {
        const status = this.getSystemHealthStatus()
        const report = {
            timestamp: Date.now(),
            status,
            alerts: this.getAllAlerts(),
            recoveryActions: this.getRecoveryActions(),
            thresholds: Array.from(this.thresholds.values())
        }

        return JSON.stringify(report, null, 2)
    }

    /**
     * Clean up resources
     */
    public cleanup(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval)
            this.checkInterval = null
        }
        this.listeners = []
        this.alerts = []
        this.alertHistory = []
    }
}

// Export singleton instance
export const systemHealthMonitor = SystemHealthMonitor.getInstance()