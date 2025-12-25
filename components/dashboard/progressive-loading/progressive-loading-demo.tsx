'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
// import { Progress } from '@/components/ui/progress'
import { 
  Activity, 
  BarChart3, 
  Users, 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  Wifi, 
  WifiOff,
  Zap,
  TrendingUp,
  Server,
  Database,
  Globe
} from 'lucide-react'

// Import our progressive loading components
import { 
  ProgressiveChart,
  ProgressiveActivityFeed, 
  ProgressiveUserTable 
} from './index'
import { loadingStateManager } from '@/lib/progressive-loading/loading-state-manager'
import { criticalPathLoader } from '@/lib/progressive-loading/critical-path-loader'
import { responsiveDataLoader } from '@/lib/progressive-loading/responsive-data-loader'
import { errorRecoverySystem } from '@/lib/progressive-loading/error-recovery-system'

interface DemoData {
  chartData: Array<{ x: string; y: number; label?: string }>
  activities: Array<{
    id: string
    type: string
    title: string
    description: string
    timestamp: Date
    user?: { name: string }
    severity: string
  }>
  users: Array<{
    id: string
    name: string
    email: string
    role: string
    status: string
    lastActive: Date
    joinDate: Date
  }>
}

export function ProgressiveLoadingDemo() {
  const [loadingState, setLoadingState] = useState<any>(null)
  const [systemStatus, setSystemStatus] = useState<any>(null)
  const [performanceMetrics, setPerformanceMetrics] = useState<any>({})
  const [isDemoRunning, setIsDemoRunning] = useState(false)

  // Subscribe to loading state updates
  useEffect(() => {
    const unsubscribe = loadingStateManager.subscribe((state) => {
      setLoadingState(state)
    })

    // Initial state
    setLoadingState(loadingStateManager.getCurrentState())

    return unsubscribe
  }, [])

  // Run performance test
  const runPerformanceTest = async () => {
    setIsDemoRunning(true)
    loadingStateManager.startLoading()

    // Register critical path items
    criticalPathLoader.registerItems([
      {
        id: 'user-stats',
        name: 'User Statistics',
        priority: 'critical',
        dependencies: [],
        loader: async () => {
          await new Promise(resolve => setTimeout(resolve, 800))
          return { totalUsers: 1234, activeUsers: 856 }
        }
      },
      {
        id: 'chart-data',
        name: 'Chart Data',
        priority: 'critical',
        dependencies: ['user-stats'],
        loader: async () => {
          await new Promise(resolve => setTimeout(resolve, 600))
          return Array.from({ length: 50 }, (_, i) => ({
            x: `Day ${i + 1}`,
            y: Math.floor(Math.random() * 100) + 50,
            label: `Value for day ${i + 1}`
          }))
        }
      },
      {
        id: 'activity-feed',
        name: 'Activity Feed',
        priority: 'important',
        dependencies: [],
        loader: async () => {
          await new Promise(resolve => setTimeout(resolve, 1200))
          return Array.from({ length: 25 }, (_, i) => ({
            id: `activity-${i}`,
            type: 'user_action',
            title: `Activity ${i + 1}`,
            description: 'User performed an action',
            timestamp: new Date(Date.now() - i * 60000),
            user: { name: `User ${i + 1}` },
            severity: i % 5 === 0 ? 'high' : 'medium'
          }))
        }
      },
      {
        id: 'user-table',
        name: 'User Table',
        priority: 'normal',
        dependencies: [],
        loader: async () => {
          await new Promise(resolve => setTimeout(resolve, 1500))
          return Array.from({ length: 100 }, (_, i) => ({
            id: `user-${i}`,
            name: `User ${i + 1}`,
            email: `user${i + 1}@example.com`,
            role: i % 4 === 0 ? 'admin' : 'user',
            status: i % 6 === 0 ? 'inactive' : 'active',
            lastActive: new Date(Date.now() - i * 3600000),
            joinDate: new Date(Date.now() - i * 86400000)
          }))
        }
      }
    ])

    try {
      await criticalPathLoader.execute()
      loadingStateManager.completeLoading()
    } catch (error) {
      console.error('Demo execution failed:', error)
    } finally {
      setIsDemoRunning(false)
    }
  }

  // Get system status
  useEffect(() => {
    const updateSystemStatus = () => {
      setSystemStatus({
        online: navigator.onLine,
        deviceCapabilities: responsiveDataLoader.getDeviceCapabilities(),
        networkInfo: responsiveDataLoader.getNetworkInfo(),
        errorRecovery: errorRecoverySystem.getState(),
        criticalPath: criticalPathLoader.getState()
      })
    }

    updateSystemStatus()
    const interval = setInterval(updateSystemStatus, 2000)
    return () => clearInterval(interval)
  }, [])

  // Mock data generators
  const generateMockChartData = (count: number = 30) => 
    Array.from({ length: count }, (_, i) => ({
      x: `Point ${i + 1}`,
      y: Math.floor(Math.random() * 100) + 20,
      label: `Data point ${i + 1}`
    }))

  const generateMockActivities = (count: number = 20) =>
    Array.from({ length: count }, (_, i) => ({
      id: `activity-${i}`,
      type: (i % 4 === 0 ? 'system_event' : 'user_action') as 'user_action' | 'system_event' | 'data_change' | 'error' | 'success' | 'info',
      title: `Activity ${i + 1}`,
      description: `This is a ${i % 3 === 0 ? 'system' : 'user'} activity`,
      timestamp: new Date(Date.now() - i * 300000),
      user: {
        id: `user-${i + 1}`,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        avatar: undefined
      },
      severity: (i % 5 === 0 ? 'high' : 'medium') as 'low' | 'medium' | 'high' | 'critical',
      category: i % 3 === 0 ? 'security' : i % 2 === 0 ? 'performance' : 'general',
      read: i % 3 === 0
    }))

  const generateMockUsers = (count: number = 50) =>
    Array.from({ length: count }, (_, i) => ({
      id: `user-${i}`,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      role: (i % 4 === 0 ? 'admin' : i % 3 === 0 ? 'moderator' : 'user') as 'user' | 'admin' | 'moderator' | 'guest',
      status: (i % 6 === 0 ? 'inactive' : 'active') as 'active' | 'inactive' | 'pending' | 'suspended',
      lastActive: new Date(Date.now() - i * 1800000),
      joinDate: new Date(Date.now() - i * 86400000)
    }))

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Progressive Loading System Demo</h1>
        <p className="text-xl text-muted-foreground">
          Experience the power of intelligent, progressive data loading
        </p>
        <div className="flex justify-center space-x-4">
          <Button 
            onClick={runPerformanceTest} 
            disabled={isDemoRunning}
            size="lg"
            className="bg-primary"
          >
            {isDemoRunning ? (
              <>
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                Running Demo...
              </>
            ) : (
              <>
                <Zap className="h-5 w-5 mr-2" />
                Run Performance Test
              </>
            )}
          </Button>
        </div>
      </div>

      {/* System Status Overview */}
      {systemStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Server className="h-5 w-5" />
              <span>System Status</span>
              {systemStatus.online ? (
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <Wifi className="h-3 w-3 mr-1" />
                  Online
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Offline
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Device Capabilities</h4>
                {systemStatus.deviceCapabilities && (
                  <div className="text-sm space-y-1">
                    <div>Screen: {systemStatus.deviceCapabilities.screenSize}</div>
                    <div>Memory: {systemStatus.deviceCapabilities.memory}</div>
                    <div>Cores: {systemStatus.deviceCapabilities.cores}</div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Network</h4>
                {systemStatus.networkInfo && (
                  <div className="text-sm space-y-1">
                    <div>Type: {systemStatus.networkInfo.effectiveType}</div>
                    <div>Downlink: {systemStatus.networkInfo.downlink} Mbps</div>
                    <div>Save Data: {systemStatus.networkInfo.saveData ? 'Yes' : 'No'}</div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Performance</h4>
                {loadingState && (
                  <div className="text-sm space-y-1">
                    <div>Progress: {Math.round(loadingState.overallProgress)}%</div>
                    <div>Phase: {loadingState.phase}</div>
                    <div>Cache Hits: {loadingState.progressiveLoading?.cacheHits || 0}</div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading Progress */}
      {loadingState && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Loading Progress</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Overall Progress</span>
                  <span>{Math.round(loadingState.overallProgress)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${loadingState.overallProgress}%` }}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {loadingState.criticalPath?.completedCritical || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Critical</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {loadingState.criticalPath?.completedImportant || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Important</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {loadingState.progressiveLoading?.loadedItems || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Loaded</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round((loadingState.timeElapsed || 0) / 1000)}s
                  </div>
                  <div className="text-sm text-muted-foreground">Elapsed</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progressive Components Demo */}
      <Tabs defaultValue="chart" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="chart">Progressive Chart</TabsTrigger>
          <TabsTrigger value="activities">Activity Feed</TabsTrigger>
          <TabsTrigger value="users">User Table</TabsTrigger>
        </TabsList>

        <TabsContent value="chart" className="space-y-4">
          <ProgressiveChart
            config={{
              type: 'line',
              title: 'Progressive Chart Demo',
              description: 'Data loads progressively with preview first',
              dataKey: 'demo-chart',
              xAxisKey: 'x',
              yAxisKey: 'y',
              width: 800,
              height: 400,
              showLegend: true,
              loadingPriority: 'important',
              staleTime: 300000
            }}
            dataLoader={async () => generateMockChartData(50)}
            className="w-full"
            onDataUpdate={(data) => console.log('Chart data updated:', data.length)}
          />
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          <ProgressiveActivityFeed
            dataLoader={async (page, pageSize) => {
              // Simulate API delay
              await new Promise(resolve => setTimeout(resolve, 800))
              const allActivities = generateMockActivities(100)
              const start = page * pageSize
              const end = start + pageSize
              return {
                activities: allActivities.slice(start, end),
                hasMore: end < allActivities.length,
                total: allActivities.length
              }
            }}
            config={{
              enableRealTime: true,
              updateInterval: 10000,
              enableFiltering: true,
              loadingPriority: 'normal'
            }}
            className="w-full"
            compact={false}
          />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <ProgressiveUserTable
            dataLoader={async (page, pageSize, filters) => {
              // Simulate API delay
              await new Promise(resolve => setTimeout(resolve, 1200))
              const allUsers = generateMockUsers(200)
              const start = page * pageSize
              const end = start + pageSize
              return {
                users: allUsers.slice(start, end),
                hasMore: end < allUsers.length,
                total: allUsers.length
              }
            }}
            config={{
              enableSearch: true,
              enableFiltering: true,
              enableSorting: true,
              enableVirtualScrolling: true,
              virtualScrollingThreshold: 50,
              loadingPriority: 'normal'
            }}
            className="w-full"
            compact={false}
          />
        </TabsContent>
      </Tabs>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Performance Metrics</span>
          </CardTitle>
          <CardDescription>
            Real-time performance monitoring and optimization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingState && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Time to First Byte</h4>
                <div className="text-2xl font-bold">
                  {(loadingState.progressiveLoading?.timeToFirstByte || 0).toFixed(0)}ms
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Cache Hit Rate</h4>
                <div className="text-2xl font-bold text-green-600">
                  {((loadingState.progressiveLoading?.cacheHits || 0) / Math.max(loadingState.progressiveLoading?.networkRequests || 1, 1) * 100).toFixed(0)}%
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Network Requests</h4>
                <div className="text-2xl font-bold text-blue-600">
                  {loadingState.progressiveLoading?.networkRequests || 0}
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Error Rate</h4>
                <div className="text-2xl font-bold text-red-600">
                  {loadingState.errorRecovery?.totalFailures || 0}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Features Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Progressive Loading Features</CardTitle>
          <CardDescription>
            Key capabilities implemented in this system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h4 className="font-medium">Critical Path Loading</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Load essential data first with intelligent prioritization
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h4 className="font-medium">Smart Caching</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Adaptive TTL and intelligent cache management
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h4 className="font-medium">Error Recovery</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Circuit breakers, retry logic, and offline support
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h4 className="font-medium">Responsive Design</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Device-aware loading based on capabilities
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h4 className="font-medium">Virtual Scrolling</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Handle large datasets efficiently
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h4 className="font-medium">Real-time Updates</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Live data synchronization and notifications
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ProgressiveLoadingDemo