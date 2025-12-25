'use client'

import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { 
  FileText, 
  Users, 
  Globe,
  Activity,
  Zap,
  User,
  BarChart3
} from 'lucide-react'

// Import UserManagementSkeleton
import { 
  UserManagementSkeleton, 
  UserManagementSkeletonPresets,
  UserManagementSkeletonVariant,
  UserManagementAnimationMode
} from '@/components/dashboard/skeletons/user-management-skeleton'

// Enhanced skeleton variants for different content types
export enum SkeletonType {
  LIST = 'list',
  CARD = 'card',
  TABLE = 'table',
  CHART = 'chart',
  FORM = 'form',
  DASHBOARD = 'dashboard',
  PROFILE = 'profile',
  NAVIGATION = 'navigation',
  TIMELINE = 'timeline',
  USER_MANAGEMENT = 'user-management'
}

// Skeleton animation modes
export enum AnimationMode {
  STATIC = 'static',
  PULSE = 'pulse',
  SHIMMER = 'shimmer',
  WAVE = 'wave',
  STAGGERED = 'staggered'
}

// Advanced list skeleton with realistic content placeholders
export function EnhancedListSkeleton({
  count = 5,
  variant = AnimationMode.STAGGERED,
  className,
}: {
  count?: number
  variant?: AnimationMode
  className?: string
}) {
  const getIcon = (index: number) => {
    const icons = [Users, FileText, Globe, Activity, Zap]
    const Icon = icons[index % icons.length]
    return <Icon className="h-4 w-4" />
  }

  const getLineCount = (index: number) => {
    const counts = [2, 3, 2, 1, 3, 2]
    return counts[index % counts.length]
  }

  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card 
          key={i} 
          className={cn(
            'p-4 transition-all duration-300',
            variant === AnimationMode.STAGGERED && 'animate-fade-in',
            variant === AnimationMode.WAVE && 'animate-pulse'
          )}
          style={{ 
            animationDelay: variant === AnimationMode.STAGGERED ? `${i * 100}ms` : undefined 
          }}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
            
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-3/4" />
                {i % 3 === 0 && <Skeleton className="h-4 w-16" />}
              </div>
              
              {Array.from({ length: getLineCount(i) }).map((_, lineIndex) => (
                <Skeleton 
                  key={lineIndex} 
                  className={cn(
                    'h-3',
                    {
                      'w-full': lineIndex === 0,
                      'w-5/6': lineIndex === 1,
                      'w-2/3': lineIndex === 2
                    }[lineIndex] || 'w-3/4'
                  )}
                />
              ))}
              
              <div className="flex items-center space-x-4 pt-1">
                <Skeleton className="h-3 w-20" />
                {i % 2 === 0 && <Skeleton className="h-3 w-16" />}
                {i % 3 === 0 && <Skeleton className="h-3 w-12" />}
              </div>
            </div>
            
            <div className="flex-shrink-0">
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// Enhanced card skeleton with contextual elements
export function EnhancedCardSkeleton({
  variant = AnimationMode.PULSE,
  showHeader = true,
  showFooter = false,
  className,
}: {
  variant?: AnimationMode
  showHeader?: boolean
  showFooter?: boolean
  className?: string
}) {
  return (
    <Card className={cn('transition-all duration-300', className)}>
      {showHeader && (
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        </CardHeader>
      )}
      
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="text-center space-y-2">
            <Skeleton className="h-8 w-20 mx-auto" />
            <Skeleton className="h-4 w-16 mx-auto" />
          </div>
          
          <div className="space-y-2">
            <Skeleton className="h-2 w-full" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-8" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-14" />
            </div>
          </div>
          
          <div className="relative">
            <Skeleton className="h-32 w-full" />
            <div className="absolute inset-0 flex items-end justify-around px-4 pb-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton 
                  key={i} 
                  className="w-4 rounded-t animate-pulse" 
                  style={{ 
                    height: `${Math.random() * 60 + 20}%`,
                    animationDelay: `${i * 100}ms`
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
      
      {showFooter && (
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// Advanced table skeleton
export function EnhancedTableSkeleton({
  rows = 8,
  columns = 4,
  variant = AnimationMode.STAGGERED,
  className,
}: {
  rows?: number
  columns?: number
  variant?: AnimationMode
  className?: string
}) {
  const columnSizes = ['w-24', 'flex-1', 'w-32', 'w-24', 'w-20', 'w-16']
  
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex space-x-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton 
            key={i} 
            className={cn('h-8', columnSizes[i] || 'flex-1')} 
          />
        ))}
      </div>
      
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div 
          key={rowIndex} 
          className={cn(
            'flex space-x-3 p-4 rounded-lg bg-muted/30',
            variant === AnimationMode.STAGGERED && 'animate-fade-in'
          )}
          style={{ 
            animationDelay: variant === AnimationMode.STAGGERED ? `${rowIndex * 50}ms` : undefined 
          }}
        >
          <Skeleton className="h-6 w-6" />
          
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-4 w-20" />
          
          <div className="flex space-x-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Dashboard skeleton layouts
export function DashboardSkeleton({
  layout = 'standard',
  variant = AnimationMode.PULSE,
  className,
}: {
  layout?: 'standard' | 'analytics' | 'admin' | 'user'
  variant?: AnimationMode
  className?: string
}) {
  if (layout === 'analytics') {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex space-x-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <EnhancedCardSkeleton key={i} variant={variant} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <EnhancedListSkeleton count={5} variant={variant} />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (layout === 'admin') {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex space-x-3">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <EnhancedTableSkeleton rows={6} columns={5} variant={variant} />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <EnhancedCardSkeleton key={i} variant={variant} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <EnhancedListSkeleton count={6} variant={variant} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-2 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-2 w-3/4" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Form skeleton
export function FormSkeleton({
  fields = 6,
  variant = AnimationMode.STAGGERED,
  className,
}: {
  fields?: number
  variant?: AnimationMode
  className?: string
}) {
  const fieldTypes = ['text', 'email', 'password', 'select', 'textarea', 'checkbox', 'radio']
  
  return (
    <div className={cn('space-y-6', className)}>
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: fields }).map((_, i) => {
          const fieldType = fieldTypes[i % fieldTypes.length]
          
          return (
            <div 
              key={i} 
              className={cn(
                'space-y-2',
                variant === AnimationMode.STAGGERED && 'animate-fade-in'
              )}
              style={{ 
                animationDelay: variant === AnimationMode.STAGGERED ? `${i * 100}ms` : undefined 
              }}
            >
              <Skeleton className="h-4 w-24" />
              {fieldType === 'textarea' ? (
                <Skeleton className="h-20 w-full" />
              ) : fieldType === 'checkbox' || fieldType === 'radio' ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
            </div>
          )
        })}
      </div>

      <div className="flex space-x-3 pt-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}

// Profile skeleton
export function ProfileSkeleton({
  variant = AnimationMode.PULSE,
  className,
}: {
  variant?: AnimationMode
  className?: string
}) {
  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-start space-x-6">
        <Skeleton className="h-20 w-20 rounded-full" />
        
        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
          
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          
          <div className="flex space-x-4">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      </div>
    </Card>
  )
}

// Timeline skeleton
export function TimelineSkeleton({
  items = 5,
  variant = AnimationMode.STAGGERED,
  className,
}: {
  items?: number
  variant?: AnimationMode
  className?: string
}) {
  return (
    <div className={cn('space-y-6', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div 
          key={i} 
          className={cn(
            'flex space-x-4',
            variant === AnimationMode.STAGGERED && 'animate-fade-in'
          )}
          style={{ 
            animationDelay: variant === AnimationMode.STAGGERED ? `${i * 150}ms` : undefined 
          }}
        >
          <div className="flex flex-col items-center">
            <Skeleton className="h-3 w-3 rounded-full" />
            {i < items - 1 && <Skeleton className="h-16 w-px mt-2" />}
          </div>
          
          <div className="flex-1 space-y-2 pb-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="flex space-x-2 pt-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Unified skeleton component
export function EnhancedSkeleton({
  type,
  variant = AnimationMode.PULSE,
  count = 1,
  delay = 0,
  className,
  ...props
}: {
  type: SkeletonType
  variant?: AnimationMode
  count?: number
  delay?: number
  className?: string
} & any) {
  // Direct rendering approach to avoid complex type mapping
  const renderSkeleton = () => {
    switch (type) {
      case SkeletonType.LIST:
        return <EnhancedListSkeleton count={count} variant={variant} className={className} />
      case SkeletonType.CARD:
        return <EnhancedCardSkeleton variant={variant} className={className} />
      case SkeletonType.TABLE:
        return <EnhancedTableSkeleton variant={variant} className={className} />
      case SkeletonType.DASHBOARD:
        return <DashboardSkeleton variant={variant} className={className} />
      case SkeletonType.FORM:
        return <FormSkeleton variant={variant} className={className} />
      case SkeletonType.PROFILE:
        return <ProfileSkeleton variant={variant} className={className} />
      case SkeletonType.TIMELINE:
        return <TimelineSkeleton variant={variant} className={className} />
      case SkeletonType.CHART:
        return (
          <Card className={className}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        )
      case SkeletonType.NAVIGATION:
        return (
          <div className={`space-y-2 ${className || ''}`}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-3 p-3 rounded-lg">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        )
      case SkeletonType.USER_MANAGEMENT:
        return <UserManagementSkeletonStandard variant={variant} className={className} />
      default:
        throw new Error(`Unknown skeleton type: ${type}`)
    }
  }

  return renderSkeleton()
}

// Animation utilities
export function useSkeletonAnimations() {
  const [isAnimating, setIsAnimating] = useState(false)

  const triggerAnimation = () => {
    setIsAnimating(true)
    setTimeout(() => setIsAnimating(false), 2000)
  }

  return {
    isAnimating,
    triggerAnimation
  }
}

// User management skeleton presets for enhanced-skeletons integration
export const UserManagementSkeletonIntegration = {
  // Standard user management skeleton
  standard: () => (
    <UserManagementSkeleton
      variant={UserManagementSkeletonVariant.STANDARD}
      animationMode={UserManagementAnimationMode.STAGGERED}
      rowCount={8}
    />
  ),

  // Compact version for dashboard widgets
  dashboard: () => (
    <UserManagementSkeleton
      variant={UserManagementSkeletonVariant.COMPACT}
      animationMode={UserManagementAnimationMode.STAGGERED}
      rowCount={6}
      showCreateButton={false}
      showFilters={false}
      showPagination={false}
    />
  ),

  // Minimal version for fast loading
  minimal: () => (
    <UserManagementSkeleton
      variant={UserManagementSkeletonVariant.COMPACT}
      animationMode={UserManagementAnimationMode.STATIC}
      rowCount={5}
      showHeader={false}
      showSearchBar={false}
      showActions={false}
    />
  ),

  // Detailed version for full admin interface
  detailed: () => (
    <UserManagementSkeleton
      variant={UserManagementSkeletonVariant.DETAILED}
      animationMode={UserManagementAnimationMode.STAGGERED}
      rowCount={10}
      showFilters={true}
      showPagination={true}
      showBulkActions={true}
    />
  )
}

// Helper function to handle user management skeleton with AnimationMode
function UserManagementSkeletonStandard({ 
  variant = AnimationMode.STAGGERED, 
  className 
}: { 
  variant?: AnimationMode
  className?: string 
}) {
  const animationMode = variant === AnimationMode.STATIC ? UserManagementAnimationMode.STATIC :
                       variant === AnimationMode.PULSE ? UserManagementAnimationMode.PULSE :
                       variant === AnimationMode.WAVE ? UserManagementAnimationMode.WAVE :
                       UserManagementAnimationMode.STAGGERED

  return (
    <UserManagementSkeleton
      variant={UserManagementSkeletonVariant.STANDARD}
      animationMode={animationMode}
      rowCount={8}
      className={className}
    />
  )
}

// Preset configurations
export const SkeletonPresets = {
  dashboard: () => (
    <DashboardSkeleton 
      layout="standard" 
      variant={AnimationMode.STAGGERED}
    />
  ),

  analytics: () => (
    <DashboardSkeleton 
      layout="analytics" 
      variant={AnimationMode.PULSE}
    />
  ),

  admin: () => (
    <DashboardSkeleton 
      layout="admin" 
      variant={AnimationMode.STAGGERED}
    />
  ),

  profile: () => (
    <div className="space-y-6">
      <ProfileSkeleton />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <EnhancedListSkeleton count={4} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <FormSkeleton fields={4} />
          </CardContent>
        </Card>
      </div>
    </div>
  ),

  dataTable: () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Card>
        <CardContent className="p-6">
          <EnhancedTableSkeleton rows={10} columns={6} />
        </CardContent>
      </Card>
    </div>
  ),

  form: () => (
    <Card className="p-6">
      <FormSkeleton fields={8} />
    </Card>
  ),

  // User management specific presets
  userManagement: () => (
    <UserManagementSkeleton
      variant={UserManagementSkeletonVariant.STANDARD}
      animationMode={UserManagementAnimationMode.STAGGERED}
      rowCount={8}
    />
  ),

  userManagementDashboard: () => (
    <UserManagementSkeleton
      variant={UserManagementSkeletonVariant.COMPACT}
      animationMode={UserManagementAnimationMode.STAGGERED}
      rowCount={6}
      showCreateButton={false}
      showFilters={false}
      showPagination={false}
    />
  ),

  userManagementMinimal: () => (
    <UserManagementSkeleton
      variant={UserManagementSkeletonVariant.COMPACT}
      animationMode={UserManagementAnimationMode.STATIC}
      rowCount={5}
      showHeader={false}
      showSearchBar={false}
      showActions={false}
    />
  )
}

export default EnhancedSkeleton