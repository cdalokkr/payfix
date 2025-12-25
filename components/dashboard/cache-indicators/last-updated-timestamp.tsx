// ============================================
// components/dashboard/cache-indicators/last-updated-timestamp.tsx
// ============================================

'use client'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useState, useEffect } from 'react'
import { Clock, RefreshCw, Calendar } from 'lucide-react'

interface LastUpdatedTimestampProps {
  lastUpdated: number
  showRelative?: boolean
  showAbsolute?: boolean
  showIcon?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'outline' | 'secondary'
  className?: string
  updateInterval?: number // in milliseconds
}

export function LastUpdatedTimestamp({ 
  lastUpdated, 
  showRelative = true,
  showAbsolute = false,
  showIcon = true,
  size = 'md',
  variant = 'outline',
  className = '',
  updateInterval = 1000
}: LastUpdatedTimestampProps) {
  const [relativeTime, setRelativeTime] = useState('')
  const [absoluteTime, setAbsoluteTime] = useState('')

  useEffect(() => {
    const updateTimestamps = () => {
      const now = Date.now()
      const diff = now - lastUpdated

      // Calculate relative time
      const seconds = Math.floor(diff / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)
      const days = Math.floor(hours / 24)

      let relative = ''
      if (seconds < 10) {
        relative = 'just now'
      } else if (seconds < 60) {
        relative = `${seconds}s ago`
      } else if (minutes < 60) {
        relative = `${minutes}m ago`
      } else if (hours < 24) {
        relative = `${hours}h ago`
      } else if (days < 7) {
        relative = `${days}d ago`
      } else {
        const date = new Date(lastUpdated)
        relative = date.toLocaleDateString()
      }

      setRelativeTime(relative)

      // Calculate absolute time
      const date = new Date(lastUpdated)
      setAbsoluteTime(date.toLocaleString())
    }

    // Initial update
    updateTimestamps()

    // Set up interval for relative time updates
    const interval = setInterval(updateTimestamps, updateInterval)

    return () => clearInterval(interval)
  }, [lastUpdated, updateInterval])

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

  const getTimeAgoColor = () => {
    const now = Date.now()
    const diff = now - lastUpdated
    const minutes = Math.floor(diff / (1000 * 60))

    if (minutes < 5) return 'default' // Very recent
    if (minutes < 30) return 'secondary' // Recent
    if (minutes < 120) return 'outline' // Getting old
    return 'destructive' // Old
  }

  const badgeContent = (
    <Badge 
      variant={variant === 'default' ? getTimeAgoColor() : variant} 
      className={`${sizeClasses[size]} ${className}`}
    >
      {showIcon && (
        <Clock className={`${iconSizeClasses[size]} mr-1`} />
      )}
      {showRelative && (
        <span>{relativeTime}</span>
      )}
      {showAbsolute && showRelative && (
        <span className="mx-1">•</span>
      )}
      {showAbsolute && (
        <span className="hidden sm:inline">{absoluteTime}</span>
      )}
    </Badge>
  )

  if (!showRelative && !showAbsolute) {
    return null
  }

  // If no tooltip needed, return simple badge
  if (!showRelative || !showAbsolute) {
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
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Last Updated</span>
            </div>
            
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Relative:</span>
                <span className="font-medium">{relativeTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Absolute:</span>
                <span className="font-medium">{absoluteTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Timestamp:</span>
                <span className="font-mono text-xs">{lastUpdated}</span>
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="text-xs text-muted-foreground">
                Updated {new Date(lastUpdated).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Compact version for inline use
export function CompactLastUpdated({ 
  lastUpdated, 
  className = '' 
}: { 
  lastUpdated: number
  className?: string 
}) {
  return (
    <LastUpdatedTimestamp 
      lastUpdated={lastUpdated} 
      size="sm" 
      showRelative={true}
      showAbsolute={false}
      showIcon={false}
      className={className}
    />
  )
}

// Version with refresh indicator for real-time data
export function LastUpdatedWithRefresh({ 
  lastUpdated, 
  isRefreshing = false,
  onRefresh,
  className = '' 
}: { 
  lastUpdated: number
  isRefreshing?: boolean
  onRefresh?: () => void
  className?: string 
}) {
  const [relativeTime, setRelativeTime] = useState('')

  useEffect(() => {
    const updateRelativeTime = () => {
      const now = Date.now()
      const diff = now - lastUpdated

      const seconds = Math.floor(diff / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)

      let relative = ''
      if (seconds < 10) {
        relative = 'just now'
      } else if (seconds < 60) {
        relative = `${seconds}s ago`
      } else if (minutes < 60) {
        relative = `${minutes}m ago`
      } else if (hours < 24) {
        relative = `${hours}h ago`
      } else {
        const date = new Date(lastUpdated)
        relative = date.toLocaleDateString()
      }

      setRelativeTime(relative)
    }

    updateRelativeTime()
    const interval = setInterval(updateRelativeTime, 1000)
    return () => clearInterval(interval)
  }, [lastUpdated])

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <span className="text-sm text-muted-foreground">Last updated:</span>
      <span className="text-sm font-medium">{relativeTime}</span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-1 hover:bg-muted rounded transition-colors"
          title="Refresh data"
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      )}
    </div>
  )
}

// Minimal version for tight spaces
export function MinimalLastUpdated({ 
  lastUpdated, 
  className = '' 
}: { 
  lastUpdated: number
  className?: string 
}) {
  const [relativeTime, setRelativeTime] = useState('')

  useEffect(() => {
    const updateRelativeTime = () => {
      const now = Date.now()
      const diff = now - lastUpdated

      const seconds = Math.floor(diff / 1000)
      const minutes = Math.floor(seconds / 60)

      let relative = ''
      if (seconds < 60) {
        relative = `${seconds}s`
      } else if (minutes < 60) {
        relative = `${minutes}m`
      } else {
        const hours = Math.floor(minutes / 60)
        relative = `${hours}h`
      }

      setRelativeTime(relative)
    }

    updateRelativeTime()
    const interval = setInterval(updateRelativeTime, 1000)
    return () => clearInterval(interval)
  }, [lastUpdated])

  return (
    <span className={`text-xs text-muted-foreground ${className}`}>
      {relativeTime}
    </span>
  )
}