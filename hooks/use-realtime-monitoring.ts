/**
 * Real-Time Monitoring Hook
 * Provides live monitoring data for dashboard components
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
    metricsCollector,
    type RealTimeMetrics
} from '@/lib/monitoring/metrics-collector'
import {
    systemHealthMonitor,
    type SystemHealthStatus,
    type HealthAlert
} from '@/lib/monitoring/system-health'
import {
    performanceAnalyzer,
    type PerformanceReport
} from '@/lib/monitoring/performance-analyzer'
import { performanceAnalytics } from '@/lib/monitoring/performance-analytics'

// ============================================
// MONITORING HOOK INTERFACES
// ============================================

export interface MonitoringData {
    metrics: RealTimeMetrics | null
    healthStatus: SystemHealthStatus
    performanceReport: PerformanceReport | null
    alerts: HealthAlert[]
    isLoading: boolean
    isConnected: boolean
    lastUpdate: Date | null
    errors: string[]
}

export interface MonitoringConfig {
    refreshInterval: number
    enableAutoRefresh: boolean
    enableAlerts: boolean
    enablePerformanceAnalysis: boolean
    enableHealthChecks: boolean
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_CONFIG: MonitoringConfig = {
    refreshInterval: 1000, // 1 second
    enableAutoRefresh: true,
    enableAlerts: true,
    enablePerformanceAnalysis: true,
    enableHealthChecks: true
}

// ============================================
// REAL-TIME MONITORING HOOK
// ============================================

/**
 * Main hook for real-time system monitoring
 * 
 * @param config - Configuration for monitoring behavior
 * @returns Comprehensive monitoring data and controls
 */
export function useRealTimeMonitoring(config: Partial<MonitoringConfig> = {}) {
    const finalConfig = { ...DEFAULT_CONFIG, ...config }

    // State
    const [monitoringData, setMonitoringData] = useState<MonitoringData>({
        metrics: null,
        healthStatus: {
            overall: 'unknown',
            components: [],
            alerts: [],
            uptime: 0,
            lastCheck: Date.now(),
            checkInterval: 30000
        },
        performanceReport: null,
        alerts: [],
        isLoading: true,
        isConnected: false,
        lastUpdate: null,
        errors: []
    })

    // Refs
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const metricsListenerRef = useRef<((metrics: RealTimeMetrics) => void) | null>(null)
    const healthListenerRef = useRef<((status: SystemHealthStatus) => void) | null>(null)

    // Error handling
    const addError = useCallback((error: string) => {
        setMonitoringData(prev => ({
            ...prev,
            errors: [...prev.errors.slice(-9), error] // Keep last 10 errors
        }))
    }, [])

    const clearErrors = useCallback(() => {
        setMonitoringData(prev => ({
            ...prev,
            errors: []
        }))
    }, [])

    // Update metrics
    const updateMetrics = useCallback((metrics: RealTimeMetrics) => {
        setMonitoringData(prev => ({
            ...prev,
            metrics,
            lastUpdate: new Date(),
            isLoading: false,
            isConnected: metrics.connectionStatus === 'connected'
        }))
    }, [])

    // Update health status
    const updateHealthStatus = useCallback((status: SystemHealthStatus) => {
        setMonitoringData(prev => ({
            ...prev,
            healthStatus: status,
            alerts: status.alerts
        }))
    }, [])

    // Performance analysis
    const runPerformanceAnalysis = useCallback(async (): Promise<PerformanceReport | null> => {
        try {
            return performanceAnalyzer.analyze()
        } catch (error) {
            addError(`Performance analysis failed: ${error}`)
            return null
        }
    }, [addError])

    // Manual refresh
    const refresh = useCallback(async () => {
        setMonitoringData(prev => ({ ...prev, isLoading: true }))

        try {
            // Update metrics
            const latestMetrics = metricsCollector.getLatestMetrics()
            if (latestMetrics) {
                updateMetrics(latestMetrics)
            }

            // Update health status
            const healthStatus = systemHealthMonitor.getSystemHealthStatus()
            updateHealthStatus(healthStatus)

            // Run performance analysis if enabled
            let performanceReport: any = null
            if (finalConfig.enablePerformanceAnalysis) {
                performanceReport = await runPerformanceAnalysis()
            }

            setMonitoringData(prev => ({
                ...prev,
                performanceReport,
                isLoading: false
            }))

        } catch (error) {
            addError(`Refresh failed: ${error}`)
            setMonitoringData(prev => ({ ...prev, isLoading: false }))
        }
    }, [finalConfig.enablePerformanceAnalysis, updateMetrics, updateHealthStatus, runPerformanceAnalysis, addError])

    // Alert management
    const acknowledgeAlert = useCallback((alertId: string) => {
        systemHealthMonitor.acknowledgeAlert(alertId)
        // Force refresh to update UI
        setTimeout(refresh, 100)
    }, [refresh])

    const resolveAlert = useCallback((alertId: string) => {
        systemHealthMonitor.resolveAlert(alertId)
        // Force refresh to update UI
        setTimeout(refresh, 100)
    }, [refresh])

    // Recovery actions
    const executeRecoveryAction = useCallback(async (actionId: string): Promise<boolean> => {
        try {
            return await systemHealthMonitor.executeRecoveryAction(actionId)
        } catch (error) {
            addError(`Recovery action failed: ${error}`)
            return false
        }
    }, [addError])

    // Export data
    const exportMetrics = useCallback((format: 'json' | 'csv' = 'json'): string => {
        try {
            return metricsCollector.exportMetrics(format)
        } catch (error) {
            addError(`Export failed: ${error}`)
            return ''
        }
    }, [addError])

    const exportHealthReport = useCallback((): string => {
        try {
            return systemHealthMonitor.exportHealthReport()
        } catch (error) {
            addError(`Health report export failed: ${error}`)
            return ''
        }
    }, [addError])

    // Initialize monitoring
    useEffect(() => {
        // Set up metrics listener
        metricsListenerRef.current = (metrics: RealTimeMetrics) => {
            updateMetrics(metrics)
        }
        metricsCollector.addListener(metricsListenerRef.current)

        // Set up health listener
        healthListenerRef.current = (status: SystemHealthStatus) => {
            updateHealthStatus(status)
        }
        systemHealthMonitor.addListener(healthListenerRef.current)

        // Initial data load
        refresh()

        // Set up auto-refresh
        if (finalConfig.enableAutoRefresh) {
            intervalRef.current = setInterval(refresh, finalConfig.refreshInterval)
        }

        return () => {
            // Cleanup
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }

            if (metricsListenerRef.current) {
                metricsCollector.removeListener(metricsListenerRef.current)
                metricsListenerRef.current = null
            }

            if (healthListenerRef.current) {
                systemHealthMonitor.removeListener(healthListenerRef.current)
                healthListenerRef.current = null
            }
        }
    }, [finalConfig, refresh, updateMetrics, updateHealthStatus])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [])

    return {
        // Data
        ...monitoringData,

        // Controls
        refresh,

        // Alert management
        acknowledgeAlert,
        resolveAlert,

        // Recovery
        executeRecoveryAction,

        // Export
        exportMetrics,
        exportHealthReport,

        // Utility
        clearErrors
    }
}

// ============================================
// SPECIALIZED HOOKS
// ============================================

/**
 * Hook for performance-focused monitoring
 */
export function usePerformanceMonitoring() {
    const [performanceData, setPerformanceData] = useState<{
        report: PerformanceReport | null
        isAnalyzing: boolean
        lastAnalysis: Date | null
        errors: string[]
    }>({
        report: null,
        isAnalyzing: false,
        lastAnalysis: null,
        errors: []
    })

    const runAnalysis = useCallback(async () => {
        setPerformanceData(prev => ({ ...prev, isAnalyzing: true, errors: [] }))

        try {
            const report = performanceAnalyzer.analyze()
            setPerformanceData(prev => ({
                ...prev,
                report,
                isAnalyzing: false,
                lastAnalysis: new Date()
            }))
        } catch (error) {
            setPerformanceData(prev => ({
                ...prev,
                isAnalyzing: false,
                errors: [...prev.errors.slice(-4), String(error)]
            }))
        }
    }, [])

    const exportReport = useCallback((format: 'json' | 'csv' = 'json'): string => {
        try {
            return performanceAnalyzer.exportReport(format)
        } catch (error) {
            setPerformanceData(prev => ({
                ...prev,
                errors: [...prev.errors.slice(-4), `Export failed: ${error}`]
            }))
            return ''
        }
    }, [])

    return {
        ...performanceData,
        runAnalysis,
        exportReport,
        clearErrors: () => setPerformanceData(prev => ({ ...prev, errors: [] }))
    }
}

/**
 * Hook for health-focused monitoring
 */
export function useHealthMonitoring() {
    const [healthData, setHealthData] = useState<{
        status: SystemHealthStatus | null
        isChecking: boolean
        lastCheck: Date | null
        errors: string[]
    }>({
        status: null,
        isChecking: false,
        lastCheck: null,
        errors: []
    })

    const checkHealth = useCallback(() => {
        setHealthData(prev => ({ ...prev, isChecking: true, errors: [] }))

        try {
            const status = systemHealthMonitor.getSystemHealthStatus()
            setHealthData(prev => ({
                ...prev,
                status,
                isChecking: false,
                lastCheck: new Date()
            }))
        } catch (error) {
            setHealthData(prev => ({
                ...prev,
                isChecking: false,
                errors: [...prev.errors.slice(-4), String(error)]
            }))
        }
    }, [])

    const getRecoveryActions = useCallback(() => {
        try {
            return systemHealthMonitor.getRecoveryActions()
        } catch (error) {
            setHealthData(prev => ({
                ...prev,
                errors: [...prev.errors.slice(-4), `Failed to get recovery actions: ${error}`]
            }))
            return []
        }
    }, [])

    return {
        ...healthData,
        checkHealth,
        getRecoveryActions,
        clearErrors: () => setHealthData(prev => ({ ...prev, errors: [] }))
    }
}

/**
 * Hook for alerts-focused monitoring
 */
export function useAlertMonitoring() {
    const [alertData, setAlertData] = useState<{
        alerts: HealthAlert[]
        activeAlerts: HealthAlert[]
        criticalAlerts: HealthAlert[]
        isLoading: boolean
        errors: string[]
    }>({
        alerts: [],
        activeAlerts: [],
        criticalAlerts: [],
        isLoading: false,
        errors: []
    })

    const loadAlerts = useCallback(() => {
        setAlertData(prev => ({ ...prev, isLoading: true, errors: [] }))

        try {
            const alerts = systemHealthMonitor.getAllAlerts()
            const activeAlerts = alerts.filter(alert => !alert.resolved)
            const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical')

            setAlertData(prev => ({
                ...prev,
                alerts,
                activeAlerts,
                criticalAlerts,
                isLoading: false
            }))
        } catch (error) {
            setAlertData(prev => ({
                ...prev,
                isLoading: false,
                errors: [...prev.errors.slice(-4), String(error)]
            }))
        }
    }, [])

    const acknowledgeAlert = useCallback((alertId: string) => {
        try {
            systemHealthMonitor.acknowledgeAlert(alertId)
            loadAlerts() // Refresh alerts
        } catch (error) {
            setAlertData(prev => ({
                ...prev,
                errors: [...prev.errors.slice(-4), `Failed to acknowledge alert: ${error}`]
            }))
        }
    }, [loadAlerts])

    const resolveAlert = useCallback((alertId: string) => {
        try {
            systemHealthMonitor.resolveAlert(alertId)
            loadAlerts() // Refresh alerts
        } catch (error) {
            setAlertData(prev => ({
                ...prev,
                errors: [...prev.errors.slice(-4), `Failed to resolve alert: ${error}`]
            }))
        }
    }, [loadAlerts])

    // Auto-refresh alerts every 5 seconds
    useEffect(() => {
        loadAlerts()
        const interval = setInterval(loadAlerts, 5000)
        return () => clearInterval(interval)
    }, [loadAlerts])

    return {
        ...alertData,
        acknowledgeAlert,
        resolveAlert,
        loadAlerts,
        clearErrors: () => setAlertData(prev => ({ ...prev, errors: [] }))
    }
}

// ============================================
// UTILITY HOOKS
// ============================================

/**
 * Hook for connection status monitoring
 */
export function useConnectionStatus() {
    const [connectionStatus, setConnectionStatus] = useState<{
        status: 'connected' | 'disconnected' | 'connecting' | 'error'
        latency: number
        lastConnected: Date | null
        errors: string[]
    }>({
        status: 'disconnected',
        latency: 0,
        lastConnected: null,
        errors: []
    })

    useEffect(() => {
        const checkConnection = () => {
            try {
                const metrics = metricsCollector.getCurrentMetrics()
                if (metrics) {
                    setConnectionStatus(prev => ({
                        ...prev,
                        status: metrics.connectionStatus === 'connected' ? 'connected' : 'disconnected',
                        latency: metrics.latency,
                        lastConnected: new Date()
                    }))
                }
            } catch (error) {
                setConnectionStatus(prev => ({
                    ...prev,
                    status: 'error',
                    errors: [...prev.errors.slice(-4), String(error)]
                }))
            }
        }

        checkConnection()
        const interval = setInterval(checkConnection, 2000)
        return () => clearInterval(interval)
    }, [])

    return connectionStatus
}

/**
 * Hook for system resource monitoring
 */
export function useResourceMonitoring() {
    const [resources, setResources] = useState<{
        cpu: number
        memory: number
        networkLatency: number
        diskUsage?: number
        isLoading: boolean
        errors: string[]
    }>({
        cpu: 0,
        memory: 0,
        networkLatency: 0,
        isLoading: false,
        errors: []
    })

    const updateResources = useCallback(() => {
        setResources(prev => ({ ...prev, isLoading: true, errors: [] }))

        try {
            const metrics = metricsCollector.getCurrentMetrics()
            if (metrics) {
                setResources(prev => ({
                    ...prev,
                    cpu: metrics.systemHealth.cpuUsage,
                    memory: metrics.systemHealth.memoryUsage,
                    networkLatency: metrics.systemHealth.networkLatency,
                    isLoading: false
                }))
            }
        } catch (error) {
            setResources(prev => ({
                ...prev,
                isLoading: false,
                errors: [...prev.errors.slice(-4), String(error)]
            }))
        }
    }, [])

    useEffect(() => {
        updateResources()
        const interval = setInterval(updateResources, 3000) // Update every 3 seconds
        return () => clearInterval(interval)
    }, [updateResources])

    return resources
}