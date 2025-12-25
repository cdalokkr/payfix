'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface NavigationSkeletonProps {
  variant?: 'sidebar' | 'topbar' | 'breadcrumbs'
  showProfile?: boolean
  showNotifications?: boolean
  showSearch?: boolean
  itemCount?: number
  animationDelay?: number
}

export function NavigationSkeleton({
  variant = 'sidebar',
  showProfile = true,
  showNotifications = true,
  showSearch = true,
  itemCount = 5,
  animationDelay = 0
}: NavigationSkeletonProps) {
  if (variant === 'topbar') {
    return (
      <div 
        className="flex items-center justify-between p-4 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {/* Logo/Brand */}
        <div className="flex items-center space-x-4">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-6 w-32" />
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="flex-1 max-w-md mx-8">
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        )}

        {/* Right Side Actions */}
        <div className="flex items-center space-x-4">
          {showNotifications && (
            <div className="relative">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="absolute -top-1 -right-1">
                <Skeleton className="h-4 w-4 rounded-full" />
              </div>
            </div>
          )}
          
          {showProfile && (
            <div className="flex items-center space-x-3">
              <div className="text-right space-y-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
          )}
        </div>
      </div>
    )
  }

  if (variant === 'breadcrumbs') {
    return (
      <nav 
        className="flex items-center space-x-2 p-4 bg-muted/30"
        style={{ animationDelay: `${animationDelay}ms` }}
        aria-label="Breadcrumb navigation"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center">
            {i > 0 && (
              <div className="mx-2">
                <Skeleton className="h-4 w-4 rotate-45 border-r border-b" />
              </div>
            )}
            <div className="relative">
              <Skeleton 
                className={`h-4 animate-pulse ${
                  i === 0 ? 'w-16' : i === 3 ? 'w-20' : 'w-12'
                }`} 
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-20 animate-shimmer" />
            </div>
          </div>
        ))}
      </nav>
    )
  }

  // Default: Sidebar navigation
  return (
    <Card 
      className="h-full border-r border-border/50 bg-sidebar/50 backdrop-blur-sm"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <CardHeader className="p-4">
        {/* Logo/Brand */}
        <div className="flex items-center space-x-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 space-y-2">
        {/* Navigation Items */}
        {Array.from({ length: itemCount }).map((_, i) => (
          <div 
            key={i}
            className="flex items-center space-x-3 p-3 rounded-lg transition-colors hover:bg-muted/50"
            style={{ animationDelay: `${animationDelay + (i * 100)}ms` }}
          >
            <div className="relative">
              <Skeleton className="h-5 w-5 rounded" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-30 animate-shimmer" />
            </div>
            <div className="flex-1 relative">
              <Skeleton 
                className={`h-4 animate-pulse ${
                  i < 2 ? 'w-20' : 'w-16'
                }`} 
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-15 animate-shimmer" />
            </div>
            {i === 1 && (
              <div className="relative">
                <Skeleton className="h-5 w-5 rounded-full" />
                <div className="absolute -top-1 -right-1">
                  <Skeleton className="h-3 w-3 rounded-full" />
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Secondary Navigation */}
        <div className="pt-4 mt-4 border-t border-border/30">
          <Skeleton className="h-3 w-16 mb-3" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div 
              key={i}
              className="flex items-center space-x-3 p-2 rounded-md"
              style={{ animationDelay: `${animationDelay + ((itemCount + i) * 100)}ms` }}
            >
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>

        {/* User Profile Section */}
        {showProfile && (
          <div className="pt-4 mt-4 border-t border-border/30">
            <div className="flex items-center space-x-3 p-3 rounded-lg">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Mobile navigation skeleton
export function MobileNavigationSkeleton() {
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      
      {/* Sidebar */}
      <div className="relative flex flex-col w-full max-w-xs h-full bg-background border-r">
        <NavigationSkeleton 
          variant="sidebar" 
          itemCount={6}
          showProfile={true}
          animationDelay={100}
        />
      </div>
    </div>
  )
}

// Breadcrumb navigation skeleton
export function BreadcrumbNavigationSkeleton({ 
  levels = 4, 
  animationDelay = 0 
}: { 
  levels?: number
  animationDelay?: number 
}) {
  return (
    <nav 
      className="flex items-center space-x-2 p-4"
      aria-label="Breadcrumb navigation"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {Array.from({ length: levels }).map((_, i) => (
        <div key={i} className="flex items-center">
          {i > 0 && (
            <div className="mx-2">
              <div className="h-4 w-4 border-r border-b border-muted-foreground/50 rotate-45" />
            </div>
          )}
          <div className="relative">
            <Skeleton 
              className={`h-4 animate-pulse ${
                i === levels - 1 ? 'w-24' : 'w-16'
              }`} 
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-20 animate-shimmer" />
          </div>
        </div>
      ))}
    </nav>
  )
}

// Top navigation skeleton for mobile
export function MobileTopNavigationSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 border-b border-border/50 lg:hidden">
      <div className="flex items-center space-x-3">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="flex items-center space-x-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    </div>
  )
}