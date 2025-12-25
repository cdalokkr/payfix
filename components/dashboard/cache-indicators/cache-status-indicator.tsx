// ============================================
// components/dashboard/cache-indicators/cache-status-indicator.tsx
// ============================================

'use client'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useState, useEffect } from 'react'
import { WifiOff, RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

interface CacheStatus {
  hitRate: number
  totalEntries: number
  totalSize: number
  isOnline: boolean
  lastRefresh: number
  backgroundRefreshActive: boolean
}

interface CacheStatusIndicatorProps {
  namespace?: string
  showDetails?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function CacheStatusIndicator({ 
  namespace, 
  showDetails = false, 
  size = 'md',
  className = '' 
}: CacheStatusIndicatorProps) {
  const [status, setStatus] = useState<CacheStatus>({
    hitRate: 0,
    totalEntries: 0,
    totalSize: 0,
    isOnline: true,
    lastRefresh: 0,
    backgroundRefreshActive: false
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const updateStatus = async () => {
      try {
        // Import smart cache manager dynamically to avoid SSR issues
        const { smartCacheManager } = await import('@/lib/cache/smart-cache-manager')

        const stats = smartCacheManager.getStats()
        const entries = smartCacheManager.getAllEntries()

        // Calculate namespace-specific stats if namespace is provided
        let namespaceStats = stats
        if (namespace) {
          const namespaceEntries = entries.filter(entry => entry.namespace === namespace)
          const namespaceSize = namespaceEntries.reduce((sum, entry) => sum + entry.size, 0)
          const namespaceHitRate = namespaceEntries.length > 0 ?
            namespaceEntries.reduce((sum, entry) => sum + entry.accessCount, 0) / namespaceEntries.length : 0

          namespaceStats = {
            ...stats,
            totalEntries: namespaceEntries.length,
            totalSize: namespaceSize,
            hitRate: namespaceHitRate
          }
        }

        const cacheStatus: CacheStatus = {
          hitRate: namespaceStats.hitRate * 100,
          totalEntries: namespaceStats.totalEntries,
          totalSize: namespaceStats.totalSize,
          isOnline: navigator.onLine,
          lastRefresh: namespaceStats.newestEntry || Date.now(),
          backgroundRefreshActive: false // TODO: Get from background refresher
        }

        setStatus(cacheStatus)
      } catch (error) {
        console.error('Failed to fetch cache status:', error)
        setStatus(prev => ({ ...prev, isOnline: false }))
      } finally {
        setIsLoading(false)
      }
    }

    // Initial load
    updateStatus()

    // Update status every 5 seconds
    const interval = setInterval(updateStatus, 5000)

    // Listen for online/offline events
    const handleOnline = () => setStatus(prev => ({ ...prev, isOnline: true }))
    const handleOffline = () => setStatus(prev => ({ ...prev, isOnline: false }))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      clearInterval(interval)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [namespace])

  const getStatusColor = () => {
    if (!status.isOnline) return 'destructive'
    if (status.hitRate >= 80) return 'default'
    if (status.hitRate >= 60) return 'secondary'
    return 'outline'
  }

  const getStatusIcon = () => {
    if (!status.isOnline) return <WifiOff className="h-3 w-3" />
    if (status.hitRate >= 80) return <CheckCircle className="h-3 w-3" />
    if (status.hitRate >= 60) return <Clock className="h-3 w-3" />
    return <AlertTriangle className="h-3 w-3" />
  }

  const getStatusText = () => {
    if (!status.isOnline) return 'Offline'
    if (status.hitRate >= 80) return 'Excellent'
    if (status.hitRate >= 60) return 'Good'
    return 'Poor'
  }

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getTimeSinceRefresh = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  const sizeClasses = {
    sm: 'h-4 px-2 text-xs',
    md: 'h-5 px-2.5 text-xs',
    lg: 'h-6 px-3 text-sm'
  }

  const iconSizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-3 w-3',
    lg: 'h-4 w-4'
  }

  if (isLoading) {
    return (
      <Badge variant="outline" className={`${sizeClasses[size]} ${className}`}>
        <RefreshCw className={`${iconSizeClasses[size]} animate-spin mr-1`} />
        Loading...
      </Badge>
    )
  }

  const badgeContent = (
    <Badge variant={getStatusColor()} className={`${sizeClasses[size]} ${className}`}>
      {getStatusIcon()}
      {!showDetails && <span className="ml-1">{getStatusText()}</span>}
      {showDetails && (
        <span className="ml-1">
          {Math.round(status.hitRate)}% hit rate
        </span>
      )}
      {status.backgroundRefreshActive && (
        <RefreshCw className={`${iconSizeClasses[size]} animate-spin ml-1`} />
      )}
    </Badge>
  )

  if (!showDetails) {
    return badgeContent
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent className="w-80">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">Cache Status</span>
              <span className={`text-xs px-2 py-1 rounded ${
                status.isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {status.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Hit Rate:</span>
                <div className="font-medium">{Math.round(status.hitRate)}%</div>
              </div>
              <div>
                <span className="text-muted-foreground">Entries:</span>
                <div className="font-medium">{status.totalEntries}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Size:</span>
                <div className="font-medium">{formatSize(status.totalSize)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Last Refresh:</span>
                <div className="font-medium">{getTimeSinceRefresh(status.lastRefresh)}</div>
              </div>
            </div>

            {status.backgroundRefreshActive && (
              <div className="flex items-center text-xs text-blue-600">
                <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                Background refresh active
              </div>
            )}

            {namespace && (
              <div className="text-xs text-muted-foreground pt-1 border-t">
                Namespace: {namespace}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Compact version for inline use
export function CompactCacheStatusIndicator({ 
  namespace, 
  className = '' 
}: { 
  namespace?: string
  className?: string 
}) {
  return (
    <CacheStatusIndicator 
      namespace={namespace} 
      size="sm" 
      showDetails={false}
      className={className}
    />
  )
}

// Detailed version for dashboard panels
export function DetailedCacheStatusIndicator({ 
  namespace, 
  className = '' 
}: { 
  namespace?: string
  className?: string 
}) {
  return (
    <CacheStatusIndicator 
      namespace={namespace} 
      size="lg" 
      showDetails={true}
      className={className}
    />
  )
}