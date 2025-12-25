/**
 * Debugging Tools Suite
 * Comprehensive debugging interface for real-time system diagnostics
 */

'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
    Bug,
    Play,
    Pause,
    Square,
    RefreshCw,
    Download,
    Trash2,
    Search,
    Filter,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Clock,
    Database,
    Network,
    Zap,
    Activity,
    Code,
    Terminal,
    Eye,
    Settings,
    TrendingUp,
    FileText,
    AlertCircle,
    Info,
    X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getEventBroadcaster, type ChannelHealth } from '@/lib/events/event-broadcaster'
import { metricsCollector } from '@/lib/monitoring/metrics-collector'
import { performanceAnalytics } from '@/lib/monitoring/performance-analytics'
import { getCacheStats, clearCacheByTier } from '@/hooks/use-realtime-dashboard-data'

// ============================================
// DEBUG LOG ENTRY INTERFACE
// ============================================

interface DebugLogEntry {
    id: string
    timestamp: number
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
    category: 'event' | 'cache' | 'websocket' | 'performance' | 'system' | 'auth'
    message: string
    data?: any
    stackTrace?: string
    duration?: number
    source: string
}

// ============================================
// EVENT FLOW DEBUGGER
// ============================================

interface EventDebuggerProps {
    onEventCapture?: (event: any) => void
}

function EventDebugger({ onEventCapture }: EventDebuggerProps) {
    const [events, setEvents] = useState<DebugLogEntry[]>([])
    const [isCapturing, setIsCapturing] = useState(false)
    const [filter, setFilter] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string>('all')
    const eventBufferRef = useRef<DebugLogEntry[]>([])

    useEffect(() => {
        if (isCapturing) {
            // Mock event capture (in real implementation, this would hook into actual event system)
            const mockEvents: DebugLogEntry[] = [
                {
                    id: '1',
                    timestamp: Date.now() - 1000,
                    level: 'info',
                    category: 'event',
                    message: 'User created event received',
                    data: { userId: '123', email: 'user@example.com' },
                    source: 'event-broadcaster'
                },
                {
                    id: '2',
                    timestamp: Date.now() - 2000,
                    level: 'debug',
                    category: 'cache',
                    message: 'Cache hit for user profile',
                    data: { tier: 'critical', responseTime: 45 },
                    source: 'cache-manager',
                    duration: 45
                }
            ]

            eventBufferRef.current = [...eventBufferRef.current, ...mockEvents]
            setEvents([...eventBufferRef.current])
        }
    }, [isCapturing])

    const clearEvents = () => {
        eventBufferRef.current = []
        setEvents([])
    }

    const exportEvents = () => {
        const data = JSON.stringify(events, null, 2)
        const blob = new Blob([data], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `debug-events-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const filteredEvents = events.filter(event => {
        const matchesFilter = !filter || event.message.toLowerCase().includes(filter.toLowerCase())
        const matchesCategory = selectedCategory === 'all' || event.category === selectedCategory
        return matchesFilter && matchesCategory
    })

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'fatal': return 'bg-red-900 text-red-100'
            case 'error': return 'bg-red-600 text-red-100'
            case 'warn': return 'bg-yellow-600 text-yellow-100'
            case 'info': return 'bg-blue-600 text-blue-100'
            case 'debug': return 'bg-gray-600 text-gray-100'
            default: return 'bg-gray-600 text-gray-100'
        }
    }

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <Button
                        onClick={() => setIsCapturing(!isCapturing)}
                        variant={isCapturing ? "destructive" : "default"}
                        size="sm"
                    >
                        {isCapturing ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                        {isCapturing ? 'Stop Capture' : 'Start Capture'}
                    </Button>
                    <Button onClick={clearEvents} variant="outline" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear
                    </Button>
                    <Button onClick={exportEvents} variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                </div>
                <div className="flex items-center space-x-2">
                    <Input
                        placeholder="Search events..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="w-64"
                    />
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="px-3 py-1 border rounded-md"
                    >
                        <option value="all">All Categories</option>
                        <option value="event">Events</option>
                        <option value="cache">Cache</option>
                        <option value="websocket">WebSocket</option>
                        <option value="performance">Performance</option>
                        <option value="system">System</option>
                        <option value="auth">Auth</option>
                    </select>
                </div>
            </div>

            {/* Event List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredEvents.map(event => (
                    <Card key={event.id} className="p-4">
                        <div className="flex items-start justify-between">
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center space-x-2">
                                    <Badge className={getLevelColor(event.level)}>
                                        {event.level.toUpperCase()}
                                    </Badge>
                                    <Badge variant="outline">
                                        {event.category}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground">
                                        {new Date(event.timestamp).toLocaleTimeString()}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        {event.source}
                                    </span>
                                </div>
                                <p className="text-sm font-medium">{event.message}</p>
                                {event.data && (
                                    <details className="text-sm">
                                        <summary className="cursor-pointer text-muted-foreground">
                                            View Data ({Object.keys(event.data).length} keys)
                                        </summary>
                                        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                                            {JSON.stringify(event.data, null, 2)}
                                        </pre>
                                    </details>
                                )}
                                {event.duration && (
                                    <span className="text-xs text-muted-foreground">
                                        Duration: {event.duration}ms
                                    </span>
                                )}
                            </div>
                        </div>
                    </Card>
                ))}

                {filteredEvents.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                        {isCapturing ? 'No events captured yet...' : 'Click "Start Capture" to begin monitoring events'}
                    </div>
                )}
            </div>
        </div>
    )
}

// ============================================
// WEBSOCKET CONNECTION MONITOR
// ============================================

function WebSocketMonitor() {
    const [connections, setConnections] = useState<ChannelHealth[]>([])
    const [isMonitoring, setIsMonitoring] = useState(false)

    useEffect(() => {
        if (isMonitoring) {
            const broadcaster = getEventBroadcaster()
            const interval = setInterval(() => {
                const health = broadcaster.getAllChannelsHealth()
                setConnections(health)
            }, 1000)

            return () => clearInterval(interval)
        }
    }, [isMonitoring])

    const getStatusIcon = (status: ChannelHealth['status']) => {
        switch (status) {
            case 'connected': return <CheckCircle className="h-4 w-4 text-green-500" />
            case 'disconnected': return <XCircle className="h-4 w-4 text-red-500" />
            case 'reconnecting': return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
            case 'error': return <AlertTriangle className="h-4 w-4 text-red-600" />
            default: return <AlertCircle className="h-4 w-4 text-gray-500" />
        }
    }

    const getStatusColor = (status: ChannelHealth['status']) => {
        switch (status) {
            case 'connected': return 'border-green-200 bg-green-50'
            case 'disconnected': return 'border-red-200 bg-red-50'
            case 'reconnecting': return 'border-yellow-200 bg-yellow-50'
            case 'error': return 'border-red-200 bg-red-50'
            default: return 'border-gray-200 bg-gray-50'
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">WebSocket Connections</h3>
                <Button
                    onClick={() => setIsMonitoring(!isMonitoring)}
                    variant={isMonitoring ? "destructive" : "default"}
                    size="sm"
                >
                    {isMonitoring ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
                </Button>
            </div>

            <div className="grid gap-4">
                {connections.map(connection => (
                    <Card key={connection.channelName} className={getStatusColor(connection.status)}>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    {getStatusIcon(connection.status)}
                                    <div>
                                        <h4 className="font-medium">{connection.channelName}</h4>
                                        <p className="text-sm text-muted-foreground">
                                            Status: {connection.status} •
                                            Reconnects: {connection.reconnectAttempts} •
                                            Errors: {connection.errorCount}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-muted-foreground">
                                        Last Activity: {new Date(connection.lastActivity).toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {connections.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                    {isMonitoring ? 'No connections found...' : 'Click "Start Monitoring" to view WebSocket connections'}
                </div>
            )}
        </div>
    )
}

// ============================================
// CACHE DEBUGGER
// ============================================

function CacheDebugger() {
    const [cacheStats, setCacheStats] = useState<any>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)

    const refreshStats = useCallback(async () => {
        setIsRefreshing(true)
        try {
            const stats = getCacheStats()
            setCacheStats(stats)
        } finally {
            setIsRefreshing(false)
        }
    }, [])

    useEffect(() => {
        refreshStats()
        const interval = setInterval(refreshStats, 5000) // Refresh every 5 seconds
        return () => clearInterval(interval)
    }, [refreshStats])

    const clearCache = (tier?: string) => {
        clearCacheByTier(tier as any)
        refreshStats()
    }

    const exportCacheStats = () => {
        const data = JSON.stringify(cacheStats, null, 2)
        const blob = new Blob([data], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `cache-stats-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    if (!cacheStats) {
        return <div className="text-center py-8">Loading cache statistics...</div>
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Cache Performance</h3>
                <div className="flex items-center space-x-2">
                    <Button onClick={refreshStats} variant="outline" size="sm" disabled={isRefreshing}>
                        <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
                        Refresh
                    </Button>
                    <Button onClick={() => clearCache()} variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All
                    </Button>
                    <Button onClick={exportCacheStats} variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(cacheStats.globalCache || {}).map(([tier, stats]: [string, any]) => (
                    <Card key={tier}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium capitalize">
                                {tier.replace(/([A-Z])/g, ' $1')} Tier
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Size</span>
                                <span className="text-sm font-medium">{stats.size}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Hits</span>
                                <span className="text-sm font-medium">{stats.hits}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Misses</span>
                                <span className="text-sm font-medium">{stats.misses}</span>
                            </div>
                            <Button
                                onClick={() => clearCache(tier)}
                                variant="outline"
                                size="sm"
                                className="w-full mt-2"
                            >
                                Clear Tier
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Event Filter Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Recent Events</span>
                            <span className="text-sm font-medium">{cacheStats.eventFilter?.recentEventCount || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Batch Queue</span>
                            <span className="text-sm font-medium">{cacheStats.eventFilter?.batchQueueSize || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Event Counts</span>
                            <span className="text-sm font-medium">
                                {Object.keys(cacheStats.eventFilter?.eventCounts || {}).length}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

// ============================================
// PERFORMANCE ANALYZER
// ============================================

function PerformanceAnalyzer() {
    const [performanceData, setPerformanceData] = useState<any>(null)
    const [isAnalyzing, setIsAnalyzing] = useState(false)

    const runAnalysis = useCallback(async () => {
        setIsAnalyzing(true)
        try {
            // Get performance summary from analytics
            const summary = performanceAnalytics.getSummary()
            setPerformanceData(summary)
        } finally {
            setIsAnalyzing(false)
        }
    }, [])

    useEffect(() => {
        runAnalysis()
    }, [runAnalysis])

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-green-600'
        if (score >= 75) return 'text-blue-600'
        if (score >= 60) return 'text-yellow-600'
        return 'text-red-600'
    }

    const getScoreBadge = (score: number) => {
        if (score >= 90) return { label: 'Excellent', color: 'bg-green-100 text-green-800' }
        if (score >= 75) return { label: 'Good', color: 'bg-blue-100 text-blue-800' }
        if (score >= 60) return { label: 'Fair', color: 'bg-yellow-100 text-yellow-800' }
        return { label: 'Poor', color: 'bg-red-100 text-red-800' }
    }

    if (!performanceData) {
        return <div className="text-center py-8">Loading performance data...</div>
    }

    const scoreBadge = getScoreBadge(performanceData.performanceScore)

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Performance Analysis</h3>
                <Button onClick={runAnalysis} variant="outline" size="sm" disabled={isAnalyzing}>
                    <RefreshCw className={cn("h-4 w-4 mr-2", isAnalyzing && "animate-spin")} />
                    Re-analyze
                </Button>
            </div>

            {/* Overall Score */}
            <Card>
                <CardContent className="p-6">
                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-bold">Performance Score</h2>
                        <div className={cn("text-6xl font-bold", getScoreColor(performanceData.performanceScore))}>
                            {performanceData.performanceScore}
                        </div>
                        <Badge className={scoreBadge.color}>
                            {scoreBadge.label}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Detailed Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Metrics Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Total Metrics</span>
                            <span className="text-sm font-medium">{performanceData.totalMetrics}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Active Issues</span>
                            <span className="text-sm font-medium">{performanceData.activeIssues.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Recent Tests</span>
                            <span className="text-sm font-medium">{performanceData.recentTests}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Performance Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {performanceData.activeIssues.map((issue: any, index: number) => (
                            <Alert key={index} variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription className="text-xs">
                                    {issue}
                                </AlertDescription>
                            </Alert>
                        ))}
                        {performanceData.activeIssues.length === 0 && (
                            <div className="text-sm text-muted-foreground text-center py-4">
                                No performance issues detected
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Recommendations */}
            {performanceData.activeIssues.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Optimization Recommendations</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {performanceData.activeIssues.map((issue: string, index: number) => (
                            <div key={index} className="flex items-start space-x-2">
                                <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                <div className="text-sm">
                                    {issue.includes('latency') && 'Consider optimizing database queries and implementing better caching strategies.'}
                                    {issue.includes('cache') && 'Review cache configuration and consider increasing cache TTL for frequently accessed data.'}
                                    {issue.includes('error') && 'Investigate error patterns and implement better error handling and retry mechanisms.'}
                                    {issue.includes('rate') && 'Monitor system load and consider scaling resources if sustained high traffic is expected.'}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

// ============================================
// DEBUG CONSOLE
// ============================================

function DebugConsole() {
    const [logs, setLogs] = useState<DebugLogEntry[]>([])
    const [input, setInput] = useState('')
    const [isRecording, setIsRecording] = useState(false)

    const addLog = useCallback((level: DebugLogEntry['level'], category: DebugLogEntry['category'], message: string, data?: any) => {
        const log: DebugLogEntry = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
            level,
            category,
            message,
            data,
            source: 'debug-console'
        }
        setLogs(prev => [log, ...prev.slice(0, 99)]) // Keep last 100 logs
    }, [])

    const handleCommand = () => {
        if (!input.trim()) return

        // Parse simple commands
        if (input === 'clear') {
            setLogs([])
        } else if (input === 'stats') {
            addLog('info', 'system', 'System statistics requested', {
                memory: (performance as any).memory?.usedJSHeapSize || 'N/A',
                timestamp: Date.now()
            })
        } else if (input.startsWith('log ')) {
            const message = input.substring(4)
            addLog('info', 'system', message)
        } else {
            addLog('warn', 'system', `Unknown command: ${input}`)
        }

        setInput('')
    }

    // Mock log capture
    useEffect(() => {
        if (isRecording) {
            const interval = setInterval(() => {
                const mockLogs = [
                    { level: 'info' as const, category: 'performance' as const, message: 'Page load completed', data: { duration: 1200 } },
                    { level: 'debug' as const, category: 'cache' as const, message: 'Cache miss for key: user_123', data: { tier: 'detailed' } },
                    { level: 'warn' as const, category: 'websocket' as const, message: 'Connection retry attempt', data: { attempts: 2 } }
                ]
                const randomLog = mockLogs[Math.floor(Math.random() * mockLogs.length)]
                addLog(randomLog.level, randomLog.category, randomLog.message, randomLog.data)
            }, 2000)

            return () => clearInterval(interval)
        }
    }, [isRecording, addLog])

    const exportLogs = () => {
        const data = JSON.stringify(logs, null, 2)
        const blob = new Blob([data], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `debug-logs-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const clearLogs = () => setLogs([])

    return (
        <div className="space-y-4 h-full flex flex-col">
            {/* Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <Button
                        onClick={() => setIsRecording(!isRecording)}
                        variant={isRecording ? "destructive" : "default"}
                        size="sm"
                    >
                        <Activity className="h-4 w-4 mr-2" />
                        {isRecording ? 'Stop Recording' : 'Start Recording'}
                    </Button>
                    <Button onClick={clearLogs} variant="outline" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear
                    </Button>
                    <Button onClick={exportLogs} variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                </div>
                <span className="text-sm text-muted-foreground">
                    {logs.length} log entries
                </span>
            </div>

            {/* Command Input */}
            <div className="flex items-center space-x-2">
                <Input
                    placeholder="Enter command (clear, stats, log <message>)..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCommand()}
                />
                <Button onClick={handleCommand}>
                    <Terminal className="h-4 w-4 mr-2" />
                    Execute
                </Button>
            </div>

            {/* Logs Display */}
            <div className="flex-1 overflow-y-auto space-y-2 border rounded p-4 bg-muted/30">
                {logs.map(log => (
                    <div key={log.id} className="text-sm">
                        <div className="flex items-center space-x-2 mb-1">
                            <Badge className={cn(
                                "text-xs",
                                log.level === 'fatal' && 'bg-red-900 text-red-100',
                                log.level === 'error' && 'bg-red-600 text-red-100',
                                log.level === 'warn' && 'bg-yellow-600 text-yellow-100',
                                log.level === 'info' && 'bg-blue-600 text-blue-100',
                                log.level === 'debug' && 'bg-gray-600 text-gray-100'
                            )}>
                                {log.level}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                                {log.category}
                            </Badge>
                            <span className="text-muted-foreground">
                                {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                        </div>
                        <div className="ml-2">
                            <span className="font-mono">{log.message}</span>
                            {log.data && (
                                <details className="mt-1">
                                    <summary className="cursor-pointer text-muted-foreground text-xs">
                                        Data
                                    </summary>
                                    <pre className="mt-1 p-2 bg-background rounded text-xs">
                                        {JSON.stringify(log.data, null, 2)}
                                    </pre>
                                </details>
                            )}
                        </div>
                    </div>
                ))}

                {logs.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                        <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No logs recorded yet. Start recording to capture debug information.</p>
                    </div>
                )}
            </div>
        </div>
    )
}

// ============================================
// MAIN DEBUG TOOLS INTERFACE
// ============================================

export function DebugTools() {
    const [activeTab, setActiveTab] = useState('events')

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Debug Tools</h1>
                    <p className="text-muted-foreground">
                        Comprehensive debugging and diagnostics for the real-time system
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="bg-blue-100 text-blue-800">
                        <Bug className="h-3 w-3 mr-1" />
                        Debug Mode
                    </Badge>
                </div>
            </div>

            {/* Debug Tools Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="events">Event Flow</TabsTrigger>
                    <TabsTrigger value="websocket">WebSocket</TabsTrigger>
                    <TabsTrigger value="cache">Cache</TabsTrigger>
                    <TabsTrigger value="performance">Performance</TabsTrigger>
                    <TabsTrigger value="console">Debug Console</TabsTrigger>
                </TabsList>

                <TabsContent value="events" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                                <Activity className="h-5 w-5" />
                                <span>Event Flow Debugger</span>
                            </CardTitle>
                            <CardDescription>
                                Monitor and debug real-time event processing, filtering, and broadcasting
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <EventDebugger />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="websocket" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                                <Network className="h-5 w-5" />
                                <span>WebSocket Connection Monitor</span>
                            </CardTitle>
                            <CardDescription>
                                Monitor WebSocket connections, health status, and reconnection attempts
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <WebSocketMonitor />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="cache" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                                <Database className="h-5 w-5" />
                                <span>Cache Debugger</span>
                            </CardTitle>
                            <CardDescription>
                                Monitor cache performance, hit rates, and clear cache tiers
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <CacheDebugger />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="performance" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                                <Zap className="h-5 w-5" />
                                <span>Performance Analyzer</span>
                            </CardTitle>
                            <CardDescription>
                                Analyze system performance metrics and get optimization recommendations
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <PerformanceAnalyzer />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="console" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                                <Terminal className="h-5 w-5" />
                                <span>Debug Console</span>
                            </CardTitle>
                            <CardDescription>
                                Interactive debug console for testing and system diagnostics
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="h-96">
                            <DebugConsole />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}