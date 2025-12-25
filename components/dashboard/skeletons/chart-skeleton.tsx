'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function ChartSkeleton() {
  return (
    <Card data-testid="chart-skeleton">
      <CardHeader>
        <Skeleton className="h-6 w-32 mb-1" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Chart title area */}
          <Skeleton className="h-4 w-24" />
          
          {/* Chart area with grid lines simulation */}
          <div className="relative">
            <Skeleton className="h-64 w-full" />
            {/* Simulate grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between py-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-px w-full opacity-30" />
              ))}
            </div>
            {/* Simulate axis labels */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-3 w-8" />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}