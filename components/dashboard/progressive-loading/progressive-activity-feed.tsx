'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { 
  Activity, 
  User, 
  Clock, 
  ChevronDown, 
  RefreshCw, 
  Filter,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react'
// Simple date formatting function to replace date-fns
const formatDistanceToNow = (date: Date): string => {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
  return date.toLocaleDateString()
}

interface ActivityItem {
  id: string
  type: 'user_action' | 'system_event' | 'data_change' | 'error' | 'success' | 'info'
  title: string
  description: string
  timestamp: Date
  user?: {
    id: string
    name: string
    email: string
    avatar?: string
  }
  metadata?: {
    [key: string]: any
  }
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: string
  tags?: string[]
  read: boolean
}

interface ActivityFeedConfig {
  pageSize: number
  prefetchDistance: number
  enableRealTime: boolean
  updateInterval: number
  maxItems: number
  enableFiltering: boolean
  enableGrouping: boolean
  groupByTimeWindow: number // minutes
  loadingPriority: 'critical' | 'important' | 'normal' | 'low'
}

interface ActivityFeedState {
  activities: ActivityItem[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  page: number
  totalItems: number
  error?: Error | null
  lastUpdated?: Date
  filter: {
    types: string[]
    severity: string[]
    category: string
    timeRange: '1h' | '6h' | '24h' | '7d' | 'all'
  }
  groupByTime: boolean
  showUnreadOnly: boolean
}

interface ProgressiveActivityFeedProps {
  dataLoader: (page: number, pageSize: number, filter?: any) => Promise<{
    activities: ActivityItem[]
    hasMore: boolean
    total: number
  }>
  config?: Partial<ActivityFeedConfig>
  className?: string
  onActivityClick?: (activity: ActivityItem) => void
  onRefresh?: () => void
  enableInfiniteScroll?: boolean
  showHeader?: boolean
  compact?: boolean
  maxHeight?: number
}

const DEFAULT_CONFIG: ActivityFeedConfig = {
  pageSize: 20,
  prefetchDistance: 3,
  enableRealTime: true,
  updateInterval: 30000, // 30 seconds
  maxItems: 1000,
  enableFiltering: true,
  enableGrouping: true,
  groupByTimeWindow: 60, // 1 hour
  loadingPriority: 'normal'
}

export function ProgressiveActivityFeed({
  dataLoader,
  config = {},
  className,
  onActivityClick,
  onRefresh,
  enableInfiniteScroll = true,
  showHeader = true,
  compact = false,
  maxHeight = 600
}: ProgressiveActivityFeedProps) {
  const [state, setState] = useState<ActivityFeedState>({
    activities: [],
    isLoading: true,
    isLoadingMore: false,
    hasMore: true,
    page: 0,
    totalItems: 0,
    error: null,
    lastUpdated: new Date(),
    filter: {
      types: [],
      severity: [],
      category: 'all',
      timeRange: '24h'
    },
    groupByTime: false,
    showUnreadOnly: false
  })

  const configFinal = { ...DEFAULT_CONFIG, ...config }
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null)
  const isLoadingRef = useRef(false)
  const realTimeIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load initial data
  const loadInitialData = useCallback(async () => {
    if (isLoadingRef.current) return
    isLoadingRef.current = true

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const result = await dataLoader(0, configFinal.pageSize, state.filter)
      
      setState(prev => ({
        ...prev,
        activities: result.activities,
        isLoading: false,
        hasMore: result.hasMore,
        totalItems: result.total,
        page: 1,
        lastUpdated: new Date()
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error
      }))
    } finally {
      isLoadingRef.current = false
    }
  }, [dataLoader, configFinal.pageSize, state.filter])

  // Load more data (pagination)
  const loadMoreData = useCallback(async () => {
    if (isLoadingRef.current || !state.hasMore) return
    isLoadingRef.current = true

    setState(prev => ({ ...prev, isLoadingMore: true }))

    try {
      const result = await dataLoader(state.page, configFinal.pageSize, state.filter)
      
      setState(prev => ({
        ...prev,
        activities: [...prev.activities, ...result.activities],
        isLoadingMore: false,
        hasMore: result.hasMore,
        totalItems: result.total,
        page: prev.page + 1
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoadingMore: false,
        error: error as Error
      }))
    } finally {
      isLoadingRef.current = false
    }
  }, [dataLoader, configFinal.pageSize, state.filter, state.page, state.hasMore])

  // Real-time updates
  useEffect(() => {
    if (!configFinal.enableRealTime) return

    realTimeIntervalRef.current = setInterval(async () => {
      try {
        // Fetch latest activities (newer than last update)
        const result = await dataLoader(0, 10, { ...state.filter, newerThan: state.lastUpdated })
        
        if (result.activities.length > 0) {
          setState(prev => ({
            ...prev,
            activities: [...result.activities, ...prev.activities].slice(0, configFinal.maxItems),
            lastUpdated: new Date()
          }))
        }
      } catch (error) {
        console.warn('Real-time update failed:', error)
      }
    }, configFinal.updateInterval)

    return () => {
      if (realTimeIntervalRef.current) {
        clearInterval(realTimeIntervalRef.current)
      }
    }
  }, [configFinal.enableRealTime, configFinal.updateInterval, dataLoader, state.filter, state.lastUpdated, configFinal.maxItems])

  // Infinite scroll setup
  useEffect(() => {
    if (!enableInfiniteScroll || !loadMoreTriggerRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0]
        if (target.isIntersecting && !state.isLoadingMore && state.hasMore) {
          loadMoreData()
        }
      },
      {
        rootMargin: `${configFinal.prefetchDistance * 100}px`
      }
    )

    observer.observe(loadMoreTriggerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [enableInfiniteScroll, loadMoreData, state.isLoadingMore, state.hasMore, configFinal.prefetchDistance])

  // Initial data load
  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // Handle filter changes
  const handleFilterChange = useCallback((newFilter: Partial<typeof state.filter>) => {
    setState(prev => ({
      ...prev,
      filter: { ...prev.filter, ...newFilter }
    }))
  }, [])

  // Mark activity as read
  const markAsRead = useCallback((activityId: string) => {
    setState(prev => ({
      ...prev,
      activities: prev.activities.map(activity =>
        activity.id === activityId ? { ...activity, read: true } : activity
      )
    }))
  }, [])

  // Get activity icon based on type and severity
  const getActivityIcon = (activity: ActivityItem) => {
    const iconClass = "h-4 w-4"
    
    switch (activity.type) {
      case 'user_action':
        return <User className={iconClass} />
      case 'system_event':
        return <Activity className={iconClass} />
      case 'data_change':
        return <TrendingUp className={iconClass} />
      case 'error':
        return <AlertCircle className={iconClass} />
      case 'success':
        return <CheckCircle className={iconClass} />
      case 'info':
        return <Info className={iconClass} />
      default:
        return <Activity className={iconClass} />
    }
  }

  // Get activity color based on severity
  const getActivityColor = (activity: ActivityItem) => {
    switch (activity.severity) {
      case 'critical':
        return 'border-l-red-500 bg-red-50'
      case 'high':
        return 'border-l-orange-500 bg-orange-50'
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50'
      case 'low':
        return 'border-l-blue-500 bg-blue-50'
      default:
        return 'border-l-gray-300 bg-gray-50'
    }
  }

  // Group activities by time window
  const groupedActivities = React.useMemo(() => {
    if (!configFinal.enableGrouping || !state.groupByTime) {
      return [{ key: 'all', activities: state.activities }]
    }

    const groups: { [key: string]: ActivityItem[] } = {}
    const timeWindow = configFinal.groupByTimeWindow * 60 * 1000 // Convert to milliseconds

    state.activities.forEach(activity => {
      const timeKey = Math.floor(activity.timestamp.getTime() / timeWindow) * timeWindow
      const groupKey = new Date(timeKey).toISOString()
      
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(activity)
    })

    return Object.entries(groups)
      .map(([key, activities]) => ({ key, activities }))
      .sort((a, b) => new Date(b.key).getTime() - new Date(a.key).getTime())
  }, [state.activities, configFinal.enableGrouping, state.groupByTime, configFinal.groupByTimeWindow])

  // Loading skeleton
  const renderSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start space-x-3 p-3 border rounded-lg">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )

  // Activity item component
  const renderActivityItem = (activity: ActivityItem, index: number) => (
    <div
      key={activity.id}
      className={cn(
        'flex items-start space-x-3 p-3 border-l-4 rounded-r-lg transition-colors hover:bg-muted/50 cursor-pointer',
        getActivityColor(activity),
        !activity.read && 'ring-1 ring-blue-200',
        compact && 'p-2'
      )}
      onClick={() => {
        onActivityClick?.(activity)
        markAsRead(activity.id)
      }}
    >
      <div className="flex-shrink-0">
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
          {getActivityIcon(activity)}
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              {activity.title}
              {!activity.read && (
                <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full inline-block" />
              )}
            </p>
            <p className={cn('text-sm text-muted-foreground mt-1', compact && 'text-xs')}>
              {activity.description}
            </p>
            
            {activity.user && (
              <div className="flex items-center space-x-2 mt-2 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span>{activity.user.name}</span>
                <span>•</span>
                <Clock className="h-3 w-3" />
                <span>{formatDistanceToNow(activity.timestamp)}</span>
              </div>
            )}
            
            {activity.tags && activity.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {activity.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex-shrink-0 ml-2">
            <Badge 
              variant={activity.severity === 'critical' ? 'destructive' : 'outline'}
              className="text-xs"
            >
              {activity.severity}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <Card className={cn('w-full', className)}>
      {showHeader && (
        <CardHeader className={compact ? 'pb-2' : 'pb-4'}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className={cn('text-lg', compact && 'text-base')}>
                Activity Feed
              </CardTitle>
              {!compact && (
                <CardDescription>
                  Real-time activity monitoring and updates
                </CardDescription>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadInitialData}
                disabled={state.isLoading}
              >
                <RefreshCw className={cn('h-4 w-4', state.isLoading && 'animate-spin')} />
              </Button>
              
              {configFinal.enableFiltering && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setState(prev => ({ ...prev, showUnreadOnly: !prev.showUnreadOnly }))}
                  className={state.showUnreadOnly ? 'bg-primary/10' : ''}
                >
                  <Filter className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      )}

      <CardContent className="p-0">
        <div 
          className="overflow-auto"
          style={{ maxHeight: compact ? 400 : maxHeight }}
        >
          {/* Loading state */}
          {state.isLoading && (
            <div className="p-4">
              {renderSkeleton()}
            </div>
          )}

          {/* Error state */}
          {state.error && !state.isLoading && (
            <div className="p-4 text-center text-destructive">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p className="font-medium">Failed to load activities</p>
              <p className="text-sm text-muted-foreground mt-1">
                {state.error.message}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadInitialData}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Activities list */}
          {!state.isLoading && !state.error && (
            <div className="space-y-2 p-4">
              {groupedActivities.map((group, groupIndex) => (
                <div key={group.key}>
                  {configFinal.enableGrouping && state.groupByTime && group.key !== 'all' && (
                    <div className="flex items-center space-x-2 py-2 border-b">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">
                        {new Date(group.key).toLocaleDateString()} - {new Date(group.key).toLocaleTimeString()}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {group.activities.length}
                      </Badge>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    {group.activities
                      .filter(activity => !state.showUnreadOnly || !activity.read)
                      .map((activity, index) => renderActivityItem(activity, index))}
                  </div>
                </div>
              ))}
              
              {/* Load more trigger */}
              {state.hasMore && enableInfiniteScroll && (
                <div ref={loadMoreTriggerRef} className="py-4 text-center">
                  {state.isLoadingMore ? (
                    <div className="flex items-center justify-center space-x-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading more...</span>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadMoreData}
                    >
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Load More
                    </Button>
                  )}
                </div>
              )}
              
              {/* End of list */}
              {!state.hasMore && state.activities.length > 0 && (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  <p>No more activities to load</p>
                  <p className="text-xs mt-1">
                    Showing {state.activities.length} of {state.totalItems} activities
                  </p>
                </div>
              )}
              
              {/* Empty state */}
              {state.activities.length === 0 && !state.isLoading && !state.isLoadingMore && (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No activities found</p>
                  {state.showUnreadOnly && (
                    <p className="text-sm mt-1">No unread activities</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default ProgressiveActivityFeed