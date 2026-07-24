// ============================================
// components/dashboard/status-bar.tsx
// ============================================

'use client'

import { useEffect, useState } from 'react'
import { useIndependentCacheStatus } from '@/hooks/use-independent-cache-status'
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Wifi,
  WifiOff
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const [relativeTime, setRelativeTime] = useState('Loading...')

  useEffect(() => {
    const calculateRelativeTime = () => {
      const now = Date.now()
      const diff = now - timestamp
      const seconds = Math.floor(diff / 1000)

      if (seconds < 60) return 'Just now'
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
      return `${Math.floor(seconds / 3600)}h ago`
    }

    setRelativeTime(calculateRelativeTime())

    // Update every 30 seconds
    const interval = setInterval(() => {
      setRelativeTime(calculateRelativeTime())
    }, 30000)

    return () => clearInterval(interval)
  }, [timestamp])

  return (
    <span className="text-xs text-muted-foreground" suppressHydrationWarning>
      {relativeTime}
    </span>
  )
}

export function StatusBar({ className }: { className?: string }) {
  const { cacheStatus, markDashboardLoaded } = useIndependentCacheStatus()

  // Mark dashboard as loaded immediately when StatusBar mounts
  useEffect(() => {
    markDashboardLoaded()
  }, [markDashboardLoaded])

  const getStatusText = () => {
    switch (cacheStatus.status) {
      case 'excellent': return 'Excellent';
      case 'good': return 'Good';
      case 'fair': return 'Fair';
      default: return 'Poor';
    }
  }

  const getStatusColor = () => {
    switch (cacheStatus.status) {
      case 'excellent': return 'text-emerald-500 dark:text-emerald-400';
      case 'good': return 'text-blue-500 dark:text-blue-400';
      case 'fair': return 'text-amber-500 dark:text-amber-400';
      default: return 'text-rose-500 dark:text-rose-400';
    }
  }

  return (
    <div className={cn("w-full flex items-center justify-between px-6 py-2.5 bg-white dark:bg-zinc-950 border-t border-border/80 text-xs font-sans", className)}>
      {/* Left - Status indicator */}
      <div className="flex items-center gap-1.5">
        <CheckCircle className="h-4 w-4 text-emerald-500" />
        <span className="text-[#6B7280] font-medium">Status:</span>
        <span className={cn("font-semibold", getStatusColor())}>{getStatusText()}</span>
      </div>

      {/* Center - Connection status and last updated */}
      <div className="flex items-center gap-1.5">
        {cacheStatus.isConnected ? (
          <Wifi className="h-4 w-4 text-emerald-500" />
        ) : (
          <WifiOff className="h-4 w-4 text-rose-500 animate-pulse" />
        )}
        <SimpleLastUpdated timestamp={cacheStatus.lastUpdated} />
      </div>

      {/* Right - All systems operational */}
      <div className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400 font-semibold">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <span>All systems operational</span>
      </div>
    </div>
  )
}