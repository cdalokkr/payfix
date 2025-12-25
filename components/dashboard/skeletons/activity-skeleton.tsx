'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface ActivitySkeletonProps {
  count?: number
  showHeader?: boolean
}

export function ActivitySkeleton({ count = 5, showHeader = true }: ActivitySkeletonProps) {
  return (
    <Card data-testid="activity-skeleton" className="border-border/50">
      {showHeader && (
        <CardHeader className="pb-4">
          <Skeleton className="h-6 w-32 mb-2 animate-pulse" />
          <Skeleton className="h-4 w-40 animate-pulse" />
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
              {/* Activity icon with pulse animation */}
              <div className="relative">
                <Skeleton className="h-4 w-4 rounded-full animate-pulse" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-30 animate-shimmer" />
              </div>
              
              {/* Activity content with staggered loading */}
              <div className="flex-1 space-y-2">
                <div className="relative">
                  <Skeleton
                    className={`h-4 w-3/4 animate-pulse ${i % 2 === 1 ? 'animate-delay-100' : ''}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-20 animate-shimmer animation-delay-100" />
                </div>
                <div className="relative">
                  <Skeleton
                    className={`h-3 w-1/2 animate-pulse ${i % 2 === 1 ? 'animate-delay-200' : 'animate-delay-50'}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-15 animate-shimmer animation-delay-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Enhanced version with different loading states
export function ProgressiveActivitySkeleton() {
  return (
    <div className="space-y-4">
      {/* Critical activities - load first */}
      <ActivitySkeleton count={3} showHeader={true} />
      
      {/* Secondary activities - load with delay */}
      <div className="animate-fade-in animation-delay-1000">
        <Card className="border-border/30 opacity-70">
          <CardHeader>
            <Skeleton className="h-6 w-40 mb-2 animate-pulse" />
            <Skeleton className="h-4 w-48 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-3 p-2 rounded-lg bg-muted/20">
                  <Skeleton className="h-4 w-4 rounded-full opacity-50" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-2/3 opacity-50" />
                    <Skeleton className="h-3 w-1/3 opacity-50" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}