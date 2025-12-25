'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface TableSkeletonProps {
  rows?: number
  columns?: number
  showHeader?: boolean
  showPagination?: boolean
  rowHeight?: 'sm' | 'md' | 'lg'
  animationDelay?: number
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  showHeader = true,
  showPagination = true,
  rowHeight = 'md',
  animationDelay = 0
}: TableSkeletonProps) {
  const rowHeights = {
    sm: 'h-8',
    md: 'h-12',
    lg: 'h-16'
  }

  return (
    <Card 
      data-testid="table-skeleton" 
      className="border-border/50 shadow-sm"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {showHeader && (
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48 animate-pulse" />
              <Skeleton className="h-4 w-32 animate-pulse" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20 animate-pulse" />
              <Skeleton className="h-9 w-24 animate-pulse" />
            </div>
          </div>
        </CardHeader>
      )}
      
      <CardContent className="p-0">
        {/* Table Header */}
        <div className="border-b border-border/50">
          <div className={`grid gap-4 px-6 py-3`} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, i) => (
              <div key={i} className="relative">
                <Skeleton 
                  className={`h-4 animate-pulse ${i === 0 ? 'w-24' : 'w-16'}`} 
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-20 animate-shimmer" />
              </div>
            ))}
          </div>
        </div>

        {/* Table Body */}
        <div className="space-y-1 p-2">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div 
              key={rowIndex} 
              className={`
                grid gap-4 px-4 py-3 rounded-md 
                transition-all duration-300 ease-out
                hover:bg-muted/30
                ${rowHeights[rowHeight]}
                animate-row-stagger
              `}
              style={{ 
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                animationDelay: `${animationDelay + (rowIndex * 100)}ms`
              }}
            >
              {Array.from({ length: columns }).map((_, colIndex) => (
                <div key={colIndex} className="relative flex items-center">
                  {colIndex === 0 ? (
                    // Avatar + Name column
                    <div className="flex items-center space-x-3">
                      <Skeleton className="h-8 w-8 rounded-full animate-pulse" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-24 animate-pulse" />
                        <Skeleton className="h-3 w-16 animate-pulse" />
                      </div>
                    </div>
                  ) : colIndex === columns - 1 ? (
                    // Actions column
                    <div className="flex justify-end">
                      <Skeleton className="h-8 w-8 rounded animate-pulse" />
                    </div>
                  ) : (
                    // Regular data columns
                    <div className="relative">
                      <Skeleton 
                        className={`h-4 animate-pulse ${
                          colIndex === 1 ? 'w-20' : 'w-16'
                        }`} 
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-15 animate-shimmer" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Pagination */}
        {showPagination && (
          <div className="border-t border-border/50 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Skeleton className="h-4 w-20 animate-pulse" />
                <Skeleton className="h-8 w-24 animate-pulse" />
              </div>
              <div className="flex items-center space-x-2">
                <Skeleton className="h-8 w-8 rounded animate-pulse" />
                <Skeleton className="h-8 w-8 rounded animate-pulse" />
                <Skeleton className="h-8 w-8 rounded animate-pulse" />
                <Skeleton className="h-8 w-8 rounded animate-pulse" />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Advanced table skeleton with loading states
export function EnhancedTableSkeleton({
  isLoading = true,
  error = null,
  onRetry,
  ...props
}: TableSkeletonProps & {
  isLoading?: boolean
  error?: Error | null
  onRetry?: () => void
}) {
  if (error && !isLoading) {
    return (
      <Card className="border-destructive/20">
        <CardContent className="p-6 text-center">
          <div className="space-y-4">
            <div className="text-destructive">Error loading table data</div>
            {onRetry && (
              <button 
                onClick={onRetry}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Retry
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return <TableSkeleton {...props} />
}

// Responsive table skeleton
export function ResponsiveTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Mobile view */}
      <div className="block md:hidden space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop view */}
      <div className="hidden md:block">
        <TableSkeleton rows={5} columns={4} />
      </div>
    </div>
  )
}