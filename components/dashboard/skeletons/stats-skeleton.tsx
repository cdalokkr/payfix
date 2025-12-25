'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface StatsSkeletonProps {
  type?: 'metric' | 'chart' | 'progress' | 'timeline' | 'comparison'
  count?: number
  layout?: 'grid' | 'list' | 'stacked'
  showHeader?: boolean
  animationDelay?: number
}

export function StatsSkeleton({
  type = 'metric',
  count = 4,
  layout = 'grid',
  showHeader = true,
  animationDelay = 0
}: StatsSkeletonProps) {
  if (type === 'chart') {
    return (
      <Card 
        data-testid="chart-stats-skeleton"
        className="border-border/50"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {showHeader && (
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-6 w-32 animate-pulse" />
                <Skeleton className="h-4 w-48 animate-pulse" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20 animate-pulse" />
                <Skeleton className="h-8 w-16 animate-pulse" />
              </div>
            </div>
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-6">
            {/* Chart area */}
            <div className="relative">
              <Skeleton className="h-64 w-full rounded-lg" />
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between p-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-px w-full opacity-30" />
                ))}
              </div>
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between p-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-3 w-8" />
                ))}
              </div>
              {/* X-axis labels */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 pb-1">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-3 w-8" />
                ))}
              </div>
            </div>

            {/* Chart legend */}
            <div className="flex flex-wrap gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/30">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="text-center space-y-1">
                  <Skeleton className="h-8 w-16 mx-auto" />
                  <Skeleton className="h-3 w-12 mx-auto" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (type === 'progress') {
    return (
      <Card 
        data-testid="progress-stats-skeleton"
        className="border-border/50"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {showHeader && (
          <CardHeader className="pb-4">
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-32" />
          </CardHeader>
        )}
        <CardContent className="space-y-6">
          {[...Array(count)].map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="relative">
                  <Skeleton className="h-4 w-20" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-20 animate-shimmer" />
                </div>
                <div className="relative">
                  <Skeleton className="h-4 w-12" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-15 animate-shimmer" />
                </div>
              </div>
              <div className="relative">
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-40 animate-shimmer" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (type === 'timeline') {
    return (
      <Card 
        data-testid="timeline-stats-skeleton"
        className="border-border/50"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {showHeader && (
          <CardHeader className="pb-4">
            <Skeleton className="h-6 w-36 mb-2" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-4">
            {[...Array(count)].map((_, i) => (
              <div 
                key={i} 
                className="flex space-x-4"
                style={{ animationDelay: `${animationDelay + (i * 150)}ms` }}
              >
                {/* Timeline indicator */}
                <div className="relative flex-shrink-0">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-30 animate-shimmer" />
                  {i < count - 1 && (
                    <div className="absolute top-4 left-1/2 w-px h-8 bg-border/30 transform -translate-x-1/2" />
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 space-y-2 pb-4">
                  <div className="relative">
                    <Skeleton className={`h-4 w-3/4 animate-pulse ${i % 2 === 1 ? 'animate-delay-100' : ''}`} />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-20 animate-shimmer" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="relative">
                      <Skeleton className={`h-3 w-1/2 animate-pulse ${i % 2 === 0 ? 'animate-delay-200' : 'animate-delay-50'}`} />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-15 animate-shimmer" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (type === 'comparison') {
    return (
      <Card 
        data-testid="comparison-stats-skeleton"
        className="border-border/50"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {showHeader && (
          <CardHeader className="pb-4">
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-36" />
          </CardHeader>
        )}
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="relative">
                    <Skeleton className="h-4 w-16" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-20 animate-shimmer" />
                  </div>
                  <Skeleton className="h-6 w-12" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-10" />
                    <Skeleton className="h-3 w-6" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Default: Metric type
  if (layout === 'list') {
    return (
      <div 
        className="space-y-3"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {[...Array(count)].map((_, i) => (
          <div 
            key={i}
            className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card"
            style={{ animationDelay: `${animationDelay + (i * 100)}ms` }}
          >
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-30 animate-shimmer" />
              </div>
              <div className="space-y-1">
                <div className="relative">
                  <Skeleton className="h-4 w-24" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-20 animate-shimmer" />
                </div>
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="relative">
                <Skeleton className="h-6 w-16" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-15 animate-shimmer" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (layout === 'stacked') {
    return (
      <Card 
        data-testid="stacked-stats-skeleton"
        className="border-border/50"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {showHeader && (
          <CardHeader className="pb-4">
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
        )}
        <CardContent className="space-y-6">
          {[...Array(count)].map((_, i) => (
            <div 
              key={i}
              className="space-y-2"
              style={{ animationDelay: `${animationDelay + (i * 200)}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className="relative">
                  <Skeleton className="h-4 w-20" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-20 animate-shimmer" />
                </div>
                <div className="relative">
                  <Skeleton className="h-5 w-16" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-15 animate-shimmer" />
                </div>
              </div>
              <div className="relative">
                <Skeleton className="h-8 w-full rounded-md" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent opacity-30 animate-shimmer" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  // Default grid layout
  return (
    <div 
      className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {[...Array(count)].map((_, i) => (
        <Card 
          key={i}
          className="border-border/50 transition-all duration-300 hover:shadow-md"
          style={{ animationDelay: `${animationDelay + (i * 100)}ms` }}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="relative">
                <Skeleton className="h-4 w-20" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-20 animate-shimmer" />
              </div>
              <div className="relative">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-30 animate-shimmer" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="relative">
                <Skeleton className="h-8 w-20" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-30 animate-shimmer" />
              </div>
              <div className="relative">
                <Skeleton className="h-3 w-32" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-15 animate-shimmer" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Enhanced stats skeleton with animations and accessibility
export function EnhancedStatsSkeleton({
  showTooltip = true,
  interactive = false,
  ...props
}: StatsSkeletonProps & {
  showTooltip?: boolean
  interactive?: boolean
}) {
  return (
    <div 
      className={`
        ${interactive ? 'cursor-pointer' : ''}
        transition-all duration-300 ease-out
        hover:shadow-lg hover:scale-[1.02]
      `}
    >
      <StatsSkeleton {...props} />
      {showTooltip && (
        <div className="sr-only">
          <div className="absolute inset-0 bg-muted/5 animate-pulse" />
        </div>
      )}
    </div>
  )
}