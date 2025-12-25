/**
 * Real-Time Performance Dashboard
 * Live system health monitoring with real-time metrics visualization
 */

'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LinearProgress } from '@/components/ui/progress-indicators'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Activity,
    Zap,
    Database,
    Network,
    Clock,
    AlertTriangle,
    CheckCircle,
    XCircle,
    TrendingUp,
    TrendingDown,
    Server,
    Users,
    Cpu,
    HardDrive,
    RefreshCw,
    Download,
    Eye,
    Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    metricsCollector,
    type RealTimeMetrics,
    type SystemHealthMetrics,
    type PerformanceScores
} from '@/lib/monitoring/metrics-collector'
import { performanceAnalytics } from '@/lib/monitoring/performance-analytics'

// ============================================
// METRICS DISPLAY COMPONENTS
// ============================================

interface MetricCardProps {
    title: string
    value: number | string
    unit?: string
    status: 'good' | 'warning' | 'error' | 'neutral'
    icon: React.ReactNode
    description?: string
    trend?: 'up' | 'down' | 'stable'
    change?: number
}

function MetricCard({ title, value, unit, status, icon, description, trend, change }: MetricCardProps) {
    const statusColors = {
        good: 'bg-green-500/10 text-green-500 border-green-500/20',
        warning: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        error: 'bg-red-500/10 text-red-500 border-red-500/20',
        neutral: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    }

    const statusIcons = {
        good: <CheckCircle className="h-4 w-4" />,
        warning: <AlertTriangle className="h-4 w-4" />,
        error: <XCircle className="h-4 w-4" />,
        neutral: <Activity className="h-4 w-4" />
    }

    const trendIcons = {
        up: <TrendingUp className="h-3 w-3 text-green-500" />,
        down: <TrendingDown className="h-3 w-3 text-red-500" />,
        stable: <Activity className="h-3 w-3 text-gray-500" />
    }

    return (
        <Card className={cn(
            "transition-all duration-200 hover:shadow-md",
            statusColors[status]
        )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <div className="flex items-center space-x-2">
                    {icon}
                    {statusIcons[status]}
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">
                    {value}{unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
                </div>
                {description && (
                    <p className="text-xs text-muted-foreground mt-1">{description}</p>
                )}
                {change !== undefined && (
                    <div className="flex items-center mt-2 space-x-1">
                        {trend && trendIcons[trend]}
                        <span className={cn(
                            "text-xs font-medium",
                            change > 0 ? "text-green-600" : change < 0 ? "text-red-600" : "text-gray-600"
                        )}>
                            {change > 0 ? '+' : ''}{change}%
                        </span>
                        <span className="text-xs text-muted-foreground">vs last hour</span>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

// ============================================
// CHART COMPONENT
// ============================================

interface SimpleChartProps {
    data: Array<{ x: number; y: number }>
    height?: number
    color?: string
    title?: string
}

function SimpleChart({ data, height = 100, color = "#3b82f6", title }: SimpleChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                No data available
            </div>
        )
    }

    const maxValue = Math.max(...data.map(d => d.y))
    const minValue = Math.min(...data.map(d => d.y))
    const range = maxValue - minValue || 1

    const points = data.map(point => ({
        x: (point.x / data[data.length - 1].x) * 100,
        y: 100 - ((point.y - minValue) / range) * 100
    }))

    const pathData = points.reduce((path, point, index) => {
        return `${path}${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
    }, '')

    return (
        <div className="space-y-2">
            {title && <h4 className="text-sm font-medium">{title}</h4>}
            <svg
                width="100%"
                height={height}
                viewBox="0 0 100 100"
                className="overflow-visible"
            >
                <path
                    d={pathData}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                />
                {points.map((point, index) => (
                    <circle
                        key={index}
                        cx={point.x}
                        cy={point.y}
                        r="1.5"
                        fill={color}
                    />
                ))}
            </svg>
        </div>
    )
}

// ============================================
// ALERT COMPONENT
// ============================================

interface AlertItem {
    id: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    title: string
    message: string
    timestamp: number
    resolved: boolean
}

function AlertItemComponent({ alert }: { alert: AlertItem }) {
    const severityColors = {
        low: 'bg-blue-50 border-blue-200 text-blue-800',
        medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        high: 'bg-orange-50 border-orange-200 text-orange-800',
        critical: 'bg-red-50 border-red-200 text-red-800'
    }

    const severityIcons = {
        low: <AlertTriangle className="h-4 w-4" />,
        medium: <AlertTriangle className="h-4 w-4" />,
        high: <XCircle className="h-4 w-4" />,
        critical: <XCircle className="h-4 w-4" />
    }

    return (
        <Alert className={cn("transition-all", severityColors[alert.severity])}>
            <div className="flex items-start space-x-3">
                {severityIcons[alert.severity]}
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">{alert.title}</h4>
                        <span className="text-xs opacity-70">
                            {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                    </div>
                    <AlertDescription className="mt-1">
                        {alert.message}
                    </AlertDescription>
                </div>
            </div>
        </Alert>
    )
}

// ============================================
// MAIN REAL-TIME DASHBOARD
// ============================================

export function RealTimeDashboard() {
    const [metrics, setMetrics] = useState<RealTimeMetrics | null>(null)
    const [historyData, setHistoryData] = useState<RealTimeMetrics[]>([])
    const [alerts, setAlerts] = useState<AlertItem[]>([])
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
    const [performanceIssues, setPerformanceIssues] = useState<string[]>([])

    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    // Update metrics from collector
    const updateMetrics = useCallback((newMetrics: RealTimeMetrics) => {
        setMetrics(newMetrics)
        setLastUpdate(new Date())

        // Add to history (keep last 100 points)
        setHistoryData(prev => {
            const updated = [...prev, newMetrics]
            return updated.slice(-100)
        })

        // Check for performance issues
        const issues: string[] = []
        if (newMetrics.systemHealth.networkLatency > 500) {
            issues.push(`High latency: ${newMetrics.systemHealth.networkLatency}ms`)
        }
        if (newMetrics.cacheHitRate < 80) {
            issues.push(`Low cache hit rate: ${newMetrics.cacheHitRate.toFixed(1)}%`)
        }
        if (newMetrics.systemHealth.errorRate > 0.05) {
            issues.push(`High error rate: ${(newMetrics.systemHealth.errorRate * 100).toFixed(2)}%`)
        }
        if (newMetrics.eventProcessingRate < 1) {
            issues.push('Low event processing rate')
        }

        setPerformanceIssues(issues)

        // Add new alerts for critical issues
        if (newMetrics.systemHealth.errorRate > 0.1) {
            const newAlert: AlertItem = {
                id: `error-${Date.now()}`,
                severity: 'critical',
                title: 'Critical Error Rate',
                message: `Error rate has exceeded 10%: ${(newMetrics.systemHealth.errorRate * 100).toFixed(2)}%`,
                timestamp: Date.now(),
                resolved: false
            }
            setAlerts(prev => [newAlert, ...prev.slice(0, 9)]) // Keep last 10 alerts
        }
    }, [])

    // Set up metrics collection
    useEffect(() => {
        const collector = metricsCollector

        const handleMetrics = (newMetrics: RealTimeMetrics) => {
            updateMetrics(newMetrics)
        }

        // Add listener
        collector.addListener(handleMetrics)

        // Get initial metrics
        const currentMetrics = collector.getCurrentMetrics()
        if (currentMetrics) {
            updateMetrics(currentMetrics)
        }

        // Set up auto-refresh
        if (autoRefresh) {
            intervalRef.current = setInterval(() => {
                const latest = collector.getLatestMetrics()
                if (latest) {
                    updateMetrics(latest)
                }
            }, 1000) // Update every second
        }

        return () => {
            collector.removeListener(handleMetrics)
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [autoRefresh, updateMetrics])

    // Manual refresh function
    const handleRefresh = useCallback(() => {
        const latest = metricsCollector.getLatestMetrics()
        if (latest) {
            updateMetrics(latest)
        }
    }, [updateMetrics])

    // Export data
    const handleExport = useCallback(() => {
        const data = metricsCollector.exportMetrics('json')
        const blob = new Blob([data], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `metrics-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }, [])

    // Get system status
    const getSystemStatus = useCallback(() => {
        if (!metrics) return 'unknown'

        const { systemHealth, performanceScores } = metrics

        if (performanceScores.overall >= 90) return 'excellent'
        if (performanceScores.overall >= 75) return 'good'
        if (performanceScores.overall >= 50) return 'warning'
        return 'critical'
    }, [metrics])

    // Get status badge
    const StatusBadge = () => {
        const status = getSystemStatus()
        const statusConfig = {
            excellent: { label: 'Excellent', color: 'bg-green-100 text-green-800' },
            good: { label: 'Good', color: 'bg-blue-100 text-blue-800' },
            warning: { label: 'Warning', color: 'bg-yellow-100 text-yellow-800' },
            critical: { label: 'Critical', color: 'bg-red-100 text-red-800' },
            unknown: { label: 'Unknown', color: 'bg-gray-100 text-gray-800' }
        }

        const config = statusConfig[status]
        return (
            <Badge variant="outline" className={cn("font-medium", config.color)}>
                {config.label}
            </Badge>
        )
    }

    // Prepare chart data
    const latencyChartData = historyData.slice(-20).map((m, i) => ({
        x: i,
        y: m.latency
    }))

    const performanceChartData = historyData.slice(-20).map((m, i) => ({
        x: i,
        y: m.performanceScores.overall
    }))

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Real-Time Monitoring</h1>
                    <p className="text-muted-foreground">
                        Live system health and performance metrics
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <StatusBadge />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAutoRefresh(!autoRefresh)}
                    >
                        <RefreshCw className={cn("h-4 w-4 mr-2", autoRefresh && "animate-spin")} />
                        {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleRefresh}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Performance Alerts */}
            {performanceIssues.length > 0 && (
                <div className="space-y-2">
                    {performanceIssues.map((issue, index) => (
                        <Alert key={index} variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>{issue}</AlertDescription>
                        </Alert>
                    ))}
                </div>
            )}

            {/* Performance Overview Cards */}
            {metrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        title="Overall Performance"
                        value={metrics.performanceScores.overall}
                        unit="/100"
                        status={
                            metrics.performanceScores.overall >= 90 ? 'good' :
                                metrics.performanceScores.overall >= 75 ? 'warning' : 'error'
                        }
                        icon={<Zap className="h-4 w-4" />}
                        description="System performance score"
                    />

                    <MetricCard
                        title="Latency"
                        value={metrics.latency}
                        unit="ms"
                        status={
                            metrics.latency < 100 ? 'good' :
                                metrics.latency < 300 ? 'warning' : 'error'
                        }
                        icon={<Clock className="h-4 w-4" />}
                        description="Average response time"
                    />

                    <MetricCard
                        title="Cache Hit Rate"
                        value={metrics.cacheHitRate.toFixed(1)}
                        unit="%"
                        status={
                            metrics.cacheHitRate >= 90 ? 'good' :
                                metrics.cacheHitRate >= 75 ? 'warning' : 'error'
                        }
                        icon={<Database className="h-4 w-4" />}
                        description="Cache effectiveness"
                    />

                    <MetricCard
                        title="Active Users"
                        value={metrics.activeUsers}
                        status="neutral"
                        icon={<Users className="h-4 w-4" />}
                        description="Currently connected users"
                    />
                </div>
            )}

            {/* Detailed Metrics Tabs */}
            <Tabs defaultValue="system" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="system">System Health</TabsTrigger>
                    <TabsTrigger value="performance">Performance</TabsTrigger>
                    <TabsTrigger value="cache">Cache</TabsTrigger>
                    <TabsTrigger value="events">Event Flow</TabsTrigger>
                    <TabsTrigger value="alerts">Alerts</TabsTrigger>
                </TabsList>

                {/* System Health Tab */}
                <TabsContent value="system" className="space-y-4">
                    {metrics && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                                    <Cpu className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{metrics.systemHealth.cpuUsage.toFixed(1)}%</div>
                                    <LinearProgress value={metrics.systemHealth.cpuUsage} className="mt-2" />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{metrics.memoryUsage}%</div>
                                    <LinearProgress value={metrics.memoryUsage} className="mt-2" />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Network Latency</CardTitle>
                                    <Network className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{metrics.latency}ms</div>
                                    <SimpleChart
                                        data={latencyChartData}
                                        title="Latency Trend"
                                        color="#ef4444"
                                        height={60}
                                    />
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </TabsContent>

                {/* Performance Tab */}
                <TabsContent value="performance" className="space-y-4">
                    {metrics && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Performance Trends</CardTitle>
                                    <CardDescription>Overall system performance over time</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <SimpleChart
                                        data={performanceChartData}
                                        color="#3b82f6"
                                        height={200}
                                    />
                                </CardContent>
                            </Card>

                            <div className="space-y-4">
                                <MetricCard
                                    title="Latency Score"
                                    value={metrics.performanceScores.latency}
                                    unit="/100"
                                    status={
                                        metrics.performanceScores.latency >= 90 ? 'good' :
                                            metrics.performanceScores.latency >= 75 ? 'warning' : 'error'
                                    }
                                    icon={<Clock className="h-4 w-4" />}
                                />

                                <MetricCard
                                    title="Throughput Score"
                                    value={metrics.performanceScores.throughput}
                                    unit="/100"
                                    status={
                                        metrics.performanceScores.throughput >= 90 ? 'good' :
                                            metrics.performanceScores.throughput >= 75 ? 'warning' : 'error'
                                    }
                                    icon={<Activity className="h-4 w-4" />}
                                />

                                <MetricCard
                                    title="Reliability Score"
                                    value={metrics.performanceScores.reliability}
                                    unit="/100"
                                    status={
                                        metrics.performanceScores.reliability >= 90 ? 'good' :
                                            metrics.performanceScores.reliability >= 75 ? 'warning' : 'error'
                                    }
                                    icon={<Server className="h-4 w-4" />}
                                />
                            </div>
                        </div>
                    )}
                </TabsContent>

                {/* Cache Tab */}
                <TabsContent value="cache" className="space-y-4">
                    {metrics && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">Ultra-Critical Tier</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm">Hit Rate</span>
                                        <span className="text-sm font-medium">
                                            {metrics.systemHealth.cacheHitRate.toFixed(1)}%
                                        </span>
                                    </div>
                                    <LinearProgress value={metrics.systemHealth.cacheHitRate} />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">Critical Tier</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm">Hit Rate</span>
                                        <span className="text-sm font-medium">
                                            {(metrics.systemHealth.cacheHitRate * 0.9).toFixed(1)}%
                                        </span>
                                    </div>
                                    <LinearProgress value={metrics.systemHealth.cacheHitRate * 0.9} />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">Secondary Tier</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm">Hit Rate</span>
                                        <span className="text-sm font-medium">
                                            {(metrics.systemHealth.cacheHitRate * 0.85).toFixed(1)}%
                                        </span>
                                    </div>
                                    <LinearProgress value={metrics.systemHealth.cacheHitRate * 0.85} />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">Detailed Tier</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm">Hit Rate</span>
                                        <span className="text-sm font-medium">
                                            {(metrics.systemHealth.cacheHitRate * 0.8).toFixed(1)}%
                                        </span>
                                    </div>
                                    <LinearProgress value={metrics.systemHealth.cacheHitRate * 0.8} />
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </TabsContent>

                {/* Event Flow Tab */}
                <TabsContent value="events" className="space-y-4">
                    {metrics && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <MetricCard
                                title="Events/Second"
                                value={metrics.eventProcessingRate.toFixed(1)}
                                status="neutral"
                                icon={<Activity className="h-4 w-4" />}
                                description="Current event processing rate"
                            />

                            <MetricCard
                                title="Events Processed"
                                value={metricsCollector.getPerformanceSummary().throughput}
                                status="neutral"
                                icon={<Database className="h-4 w-4" />}
                                description="Total events processed today"
                            />

                            <MetricCard
                                title="Error Rate"
                                value={(metrics.systemHealth.errorRate * 100).toFixed(2)}
                                unit="%"
                                status={
                                    metrics.systemHealth.errorRate < 0.01 ? 'good' :
                                        metrics.systemHealth.errorRate < 0.05 ? 'warning' : 'error'
                                }
                                icon={<XCircle className="h-4 w-4" />}
                                description="Event processing error rate"
                            />
                        </div>
                    )}
                </TabsContent>

                {/* Alerts Tab */}
                <TabsContent value="alerts" className="space-y-4">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium">System Alerts</h3>
                            <span className="text-sm text-muted-foreground">
                                {alerts.length} active alerts
                            </span>
                        </div>

                        {alerts.length === 0 ? (
                            <Card>
                                <CardContent className="flex items-center justify-center py-8">
                                    <div className="text-center space-y-2">
                                        <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
                                        <p className="text-sm text-muted-foreground">No active alerts</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-2">
                                {alerts.map(alert => (
                                    <AlertItemComponent key={alert.id} alert={alert} />
                                ))}
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Footer Info */}
            <div className="text-center text-sm text-muted-foreground">
                Last updated: {lastUpdate.toLocaleTimeString()} •
                Data refresh: {autoRefresh ? '1s' : 'manual'} •
                {historyData.length} data points collected
            </div>
        </div>
    )
}