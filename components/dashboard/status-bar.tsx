// ============================================
// components/dashboard/status-bar.tsx
// ============================================

'use client'

import { useEffect } from 'react'
import { useIndependentCacheStatus } from '@/hooks/use-independent-cache-status'
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Wifi,
  WifiOff
} from 'lucide-react'

// Compact cache status indicator for independent use
function CompactIndependentStatus({ status, detail }: { status: string; detail: string }) {
  const getStatusConfig = () => {
    switch (status) {
      case 'excellent':
        return {
          icon: <CheckCircle className="h-3 w-3" />,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          text: 'Excellent'
        }
      case 'good':
        return {
          icon: <CheckCircle className="h-3 w-3" />,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          text: 'Good'
        }
      case 'fair':
        return {
          icon: <Clock className="h-3 w-3" />,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          text: 'Fair'
        }
      default:
        return {
          icon: <AlertTriangle className="h-3 w-3" />,
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          text: 'Poor'
        }
    }
  }

  const config = getStatusConfig()

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${config.bgColor} ${config.color} inline-flex items-center gap-1`}>
      {config.icon}
      {config.text}
    </span>
  )
}

// Simple last updated indicator
function SimpleLastUpdated({ timestamp }: { timestamp: number }) {
  const getRelativeTime = (timestamp: number) => {
    if (typeof window === 'undefined') return 'Loading...'

    const now = Date.now()
    const diff = now - timestamp
    const seconds = Math.floor(diff / 1000)

    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    return `${Math.floor(seconds / 3600)}h ago`
  }

  return (
    <span className="text-xs text-muted-foreground">
      {getRelativeTime(timestamp)}
    </span>
  )
}

export function StatusBar() {
  const { cacheStatus, markDashboardLoaded } = useIndependentCacheStatus()

  // Mark dashboard as loaded immediately when StatusBar mounts
  useEffect(() => {
    markDashboardLoaded()
  }, [markDashboardLoaded])

  return (
    <div className="flex items-center justify-center gap-4 px-4 py-2 bg-muted/50 border-t">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium">Status:</span>
          <CompactIndependentStatus
            status={cacheStatus.status}
            detail={cacheStatus.statusDetail}
          />
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-1">
          {cacheStatus.isConnected ? (
            <Wifi className="h-3 w-3 text-green-500" />
          ) : (
            <WifiOff className="h-3 w-3 text-red-500" />
          )}
        </div>

        {/* Last updated */}
        <SimpleLastUpdated timestamp={cacheStatus.lastUpdated} />
      </div>
    </div>
  )
}