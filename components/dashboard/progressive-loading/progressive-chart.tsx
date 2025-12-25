'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Activity, TrendingUp, TrendingDown, BarChart3, LineChart, PieChart } from 'lucide-react'

interface ChartDataPoint {
  x: string | number
  y: number
  label?: string
  color?: string
  category?: string
}

interface ChartConfig {
  type: 'line' | 'bar' | 'area' | 'pie' | 'doughnut'
  title: string
  description?: string
  dataKey: string
  xAxisKey: string
  yAxisKey: string
  width: number
  height: number
  showLegend?: boolean
  showGrid?: boolean
  showTooltip?: boolean
  animationDuration?: number
  colors?: string[]
  loadingPriority: 'critical' | 'important' | 'normal' | 'low'
  staleTime: number
  enableRealTime?: boolean
  updateInterval?: number
}

interface ProgressiveChartState {
  isLoading: boolean
  isPreview: boolean
  progress: number
  phase: 'initializing' | 'loading-preview' | 'loading-full' | 'updating' | 'complete' | 'error'
  data: ChartDataPoint[]
  previewData: ChartDataPoint[]
  error?: Error | null
  lastUpdated?: Date
  renderTime: number
  dataPoints: number
  previewPoints: number
}

interface ProgressiveChartProps {
  config: ChartConfig
  dataLoader: () => Promise<ChartDataPoint[]>
  className?: string
  onDataUpdate?: (data: ChartDataPoint[]) => void
  onError?: (error: Error) => void
  enableOfflineMode?: boolean
  showRefreshButton?: boolean
  compact?: boolean
  children?: React.ReactNode
}

export function ProgressiveChart({
  config,
  dataLoader,
  className,
  onDataUpdate,
  onError,
  enableOfflineMode = true,
  showRefreshButton = true,
  compact = false,
  children
}: ProgressiveChartProps) {
  const [state, setState] = useState<ProgressiveChartState>({
    isLoading: true,
    isPreview: true,
    progress: 0,
    phase: 'initializing',
    data: [],
    previewData: [],
    error: null,
    renderTime: 0,
    dataPoints: 0,
    previewPoints: 0
  })

  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastUpdateRef = useRef<number>(0)

  // Calculate preview data (sample subset for fast loading)
  const generatePreviewData = useCallback((fullData: ChartDataPoint[], previewSize: number = 20): ChartDataPoint[] => {
    if (fullData.length <= previewSize) {
      return fullData
    }

    const step = Math.ceil(fullData.length / previewSize)
    const preview: ChartDataPoint[] = []
    
    // Always include first and last data points
    preview.push(fullData[0])
    
    // Add evenly distributed middle points
    for (let i = step; i < fullData.length - step; i += step) {
      preview.push(fullData[i])
    }
    
    preview.push(fullData[fullData.length - 1])
    
    return preview
  }, [])

  // Load preview data first (critical path)
  const loadPreviewData = useCallback(async () => {
    const startTime = performance.now()
    
    setState(prev => ({
      ...prev,
      phase: 'loading-preview',
      progress: 10,
      isLoading: true,
      isPreview: true
    }))

    try {
      const fullData = await dataLoader()
      const previewData = generatePreviewData(fullData)
      
      const renderTime = performance.now() - startTime
      
      setState(prev => ({
        ...prev,
        phase: 'complete',
        progress: 100,
        isLoading: false,
        isPreview: true,
        previewData,
        previewPoints: previewData.length,
        renderTime,
        dataPoints: fullData.length,
        lastUpdated: new Date()
      }))

      onDataUpdate?.(previewData)

    } catch (error) {
      setState(prev => ({
        ...prev,
        phase: 'error',
        isLoading: false,
        error: error as Error
      }))
      onError?.(error as Error)
    }
  }, [dataLoader, generatePreviewData, onDataUpdate, onError])

  // Load full data progressively
  const loadFullData = useCallback(async () => {
    if (state.isPreview && state.previewData.length > 0) {
      setState(prev => ({
        ...prev,
        phase: 'loading-full',
        progress: 50
      }))

      try {
        const fullData = await dataLoader()
        const renderTime = performance.now() - performance.now()
        
        setState(prev => ({
          ...prev,
          phase: 'complete',
          progress: 100,
          isLoading: false,
          isPreview: false,
          data: fullData,
          dataPoints: fullData.length,
          renderTime,
          lastUpdated: new Date()
        }))

        onDataUpdate?.(fullData)

      } catch (error) {
        console.warn('Failed to load full chart data, keeping preview:', error)
        setState(prev => ({
          ...prev,
          phase: 'complete',
          progress: 100,
          isLoading: false,
          isPreview: true
        }))
      }
    }
  }, [dataLoader, state.isPreview, state.previewData.length, onDataUpdate])

  // Real-time updates
  useEffect(() => {
    if (config.enableRealTime && config.updateInterval) {
      updateIntervalRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          phase: 'updating',
          progress: 80
        }))

        // In a real implementation, this would fetch incremental updates
        loadFullData()
      }, config.updateInterval)

      return () => {
        if (updateIntervalRef.current) {
          clearInterval(updateIntervalRef.current)
        }
      }
    }
  }, [config.enableRealTime, config.updateInterval, loadFullData])

  // Initial data loading
  useEffect(() => {
    // Load preview immediately for critical/important charts
    if (config.loadingPriority === 'critical' || config.loadingPriority === 'important') {
      loadPreviewData()
    }
  }, [loadPreviewData, config.loadingPriority])

  // Load full data after preview (for important and normal priority)
  useEffect(() => {
    if (config.loadingPriority === 'important' || config.loadingPriority === 'normal') {
      // Delay full data load to allow preview to render
      const timer = setTimeout(() => {
        loadFullData()
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [loadFullData, config.loadingPriority])

  // Refresh data
  const handleRefresh = useCallback(async () => {
    await loadPreviewData()
    if (!state.isPreview) {
      await loadFullData()
    }
  }, [loadPreviewData, loadFullData, state.isPreview])

  // Get current data (preview or full)
  const currentData = state.isPreview ? state.previewData : state.data

  // Loading skeleton components
  const renderPreviewSkeleton = () => (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  )

  const renderFullSkeleton = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        {showRefreshButton && (
          <Skeleton className="h-8 w-20" />
        )}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )

  // Chart icon based on type
  const getChartIcon = () => {
    switch (config.type) {
      case 'line':
        return <LineChart className="h-5 w-5" />
      case 'bar':
        return <BarChart3 className="h-5 w-5" />
      case 'area':
        return <TrendingUp className="h-5 w-5" />
      case 'pie':
      case 'doughnut':
        return <PieChart className="h-5 w-5" />
      default:
        return <BarChart3 className="h-5 w-5" />
    }
  }

  // Simple chart rendering (in real app, would use a chart library)
  const renderSimpleChart = (data: ChartDataPoint[], isPreview: boolean) => {
    const maxValue = Math.max(...data.map(d => d.y))
    const minValue = Math.min(...data.map(d => d.y))
    const range = maxValue - minValue || 1

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Data Points: {data.length}</span>
          {isPreview && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
              Preview
            </span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {data.map((point, index) => (
            <div
              key={index}
              className="flex flex-col items-center space-y-1"
            >
              <div
                className="w-full bg-primary/20 rounded-t"
                style={{
                  height: `${Math.max(4, (point.y - minValue) / range * 40)}px`,
                  minHeight: '4px'
                }}
              />
              <div className="text-xs text-center truncate w-full">
                {typeof point.x === 'string' ? point.x.slice(0, 3) : point.x}
              </div>
            </div>
          ))}
        </div>
        {config.description && (
          <p className="text-xs text-muted-foreground mt-2">
            {config.description}
          </p>
        )}
      </div>
    )
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className={compact ? 'pb-2' : 'pb-4'}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getChartIcon()}
            <div>
              <CardTitle className={cn('text-lg', compact && 'text-base')}>
                {config.title}
              </CardTitle>
              {!compact && config.description && (
                <CardDescription className="text-sm">
                  {config.description}
                </CardDescription>
              )}
            </div>
          </div>
          {showRefreshButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={state.isLoading}
              className="shrink-0"
            >
              <Activity className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          )}
        </div>
        
        {/* Loading progress indicator */}
        {state.isLoading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {state.phase === 'loading-preview' && 'Loading preview...'}
                {state.phase === 'loading-full' && 'Loading full data...'}
                {state.phase === 'updating' && 'Updating...'}
              </span>
              <span>{state.progress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {/* Error state */}
        {state.phase === 'error' && state.error && (
          <div className="text-center py-8 text-destructive">
            <p>Failed to load chart data</p>
            <p className="text-sm text-muted-foreground mt-1">
              {state.error.message}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Loading state */}
        {state.isLoading && (
          <div className="py-4">
            {state.phase === 'loading-preview' ? renderPreviewSkeleton() : renderFullSkeleton()}
          </div>
        )}

        {/* Chart content */}
        {!state.isLoading && currentData.length > 0 && (
          <div className="py-4">
            {renderSimpleChart(currentData, state.isPreview)}
          </div>
        )}

        {/* Empty state */}
        {!state.isLoading && currentData.length === 0 && state.phase === 'complete' && (
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No data available</p>
            {showRefreshButton && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="mt-2"
              >
                Refresh
              </Button>
            )}
          </div>
        )}

        {/* Additional content from children */}
        {children}
      </CardContent>

      {/* Performance metrics (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="px-6 pb-4 text-xs text-muted-foreground border-t">
          <div className="flex justify-between">
            <span>Render time: {state.renderTime.toFixed(1)}ms</span>
            <span>
              {state.isPreview ? 'Preview' : 'Full'} • {currentData.length} points
            </span>
            {state.lastUpdated && (
              <span>
                Updated: {state.lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

export default ProgressiveChart