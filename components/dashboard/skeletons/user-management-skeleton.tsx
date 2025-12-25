'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { UserPlus, Search, Filter } from 'lucide-react'

export enum UserManagementSkeletonVariant {
  COMPACT = 'compact',
  STANDARD = 'standard',
  DETAILED = 'detailed'
}

export enum UserManagementAnimationMode {
  STATIC = 'static',
  PULSE = 'pulse',
  STAGGERED = 'staggered',
  WAVE = 'wave'
}

// Props interface
export interface UserManagementSkeletonProps {
  variant?: UserManagementSkeletonVariant
  animationMode?: UserManagementAnimationMode
  rowCount?: number
  showHeader?: boolean
  showSearchBar?: boolean
  showFilters?: boolean
  showCreateButton?: boolean
  showActions?: boolean
  showPagination?: boolean
  showBulkActions?: boolean
  className?: string
  ariaLabel?: string
}

// Header skeleton component
function UserManagementHeaderSkeleton({
  showSearchBar = true,
  showFilters = true,
  showCreateButton = true,
  variant = UserManagementSkeletonVariant.STANDARD,
  animationMode = UserManagementAnimationMode.STAGGERED
}: {
  showSearchBar?: boolean
  showFilters?: boolean
  showCreateButton?: boolean
  variant?: UserManagementSkeletonVariant
  animationMode?: UserManagementAnimationMode
}) {
  const getVariantStyles = () => {
    switch (variant) {
      case UserManagementSkeletonVariant.COMPACT:
        return 'p-4'
      case UserManagementSkeletonVariant.DETAILED:
        return 'p-6'
      default:
        return 'p-5'
    }
  }

  return (
    <div className={cn('flex justify-between items-center', getVariantStyles())}>
      <div className="space-y-2">
        <Skeleton
          className={cn(
            'transition-all duration-300',
            variant === UserManagementSkeletonVariant.COMPACT ? 'h-6 w-32' :
            variant === UserManagementSkeletonVariant.DETAILED ? 'h-8 w-48' :
            'h-7 w-40',
            animationMode === UserManagementAnimationMode.STAGGERED && 'animate-fade-in'
          )}
        />
        <Skeleton
          className={cn(
            'transition-all duration-300',
            variant === UserManagementSkeletonVariant.COMPACT ? 'h-3 w-48' :
            variant === UserManagementSkeletonVariant.DETAILED ? 'h-4 w-64' :
            'h-3.5 w-56',
            animationMode === UserManagementAnimationMode.STAGGERED && 'animate-fade-in'
          )}
          style={{ 
            animationDelay: animationMode === UserManagementAnimationMode.STAGGERED ? '100ms' : undefined 
          }}
        />
      </div>
      
      <div className="flex items-center space-x-3">
        {showSearchBar && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Skeleton
              className={cn(
                'pl-10 transition-all duration-300',
                variant === UserManagementSkeletonVariant.COMPACT ? 'h-8 w-32' :
                variant === UserManagementSkeletonVariant.DETAILED ? 'h-10 w-48' :
                'h-9 w-40',
                animationMode === UserManagementAnimationMode.STAGGERED && 'animate-fade-in'
              )}
              style={{ 
                animationDelay: animationMode === UserManagementAnimationMode.STAGGERED ? '200ms' : undefined 
              }}
            />
          </div>
        )}
        
        {showFilters && (
          <Skeleton
            className={cn(
              'transition-all duration-300',
              variant === UserManagementSkeletonVariant.COMPACT ? 'h-8 w-8' :
              variant === UserManagementSkeletonVariant.DETAILED ? 'h-10 w-10' :
              'h-9 w-9',
              animationMode === UserManagementAnimationMode.STAGGERED && 'animate-fade-in'
            )}
            style={{ 
              animationDelay: animationMode === UserManagementAnimationMode.STAGGERED ? '300ms' : undefined 
            }}
          >
            <Filter className="h-4 w-4 m-auto" />
          </Skeleton>
        )}
        
        {showCreateButton && (
          <Skeleton
            className={cn(
              'transition-all duration-300',
              variant === UserManagementSkeletonVariant.COMPACT ? 'h-8 px-3' :
              variant === UserManagementSkeletonVariant.DETAILED ? 'h-10 px-6' :
              'h-9 px-4',
              animationMode === UserManagementAnimationMode.STAGGERED && 'animate-fade-in'
            )}
            style={{ 
              animationDelay: animationMode === UserManagementAnimationMode.STAGGERED ? '400ms' : undefined 
            }}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            <span>Create User</span>
          </Skeleton>
        )}
      </div>
    </div>
  )
}

// Table row skeleton component
function UserManagementRowSkeleton({
  index,
  variant = UserManagementSkeletonVariant.STANDARD,
  animationMode = UserManagementAnimationMode.STAGGERED,
  showActions = true
}: {
  index: number
  variant?: UserManagementSkeletonVariant
  animationMode?: UserManagementAnimationMode
  showActions?: boolean
}) {
  const getRowVariantStyles = () => {
    switch (variant) {
      case UserManagementSkeletonVariant.COMPACT:
        return 'py-2 px-4'
      case UserManagementSkeletonVariant.DETAILED:
        return 'py-4 px-6'
      default:
        return 'py-3 px-5'
    }
  }

  const getColumnSizes = () => {
    switch (variant) {
      case UserManagementSkeletonVariant.COMPACT:
        return {
          email: 'w-48',
          firstName: 'w-24',
          lastName: 'w-24',
          role: 'w-20',
          actions: 'w-32'
        }
      case UserManagementSkeletonVariant.DETAILED:
        return {
          email: 'w-64',
          firstName: 'w-32',
          lastName: 'w-32',
          role: 'w-24',
          actions: 'w-48'
        }
      default:
        return {
          email: 'w-56',
          firstName: 'w-28',
          lastName: 'w-28',
          role: 'w-22',
          actions: 'w-40'
        }
    }
  }

  const columnSizes = getColumnSizes()

  return (
    <TableRow 
      className={cn(
        'transition-colors duration-200',
        animationMode === UserManagementAnimationMode.STAGGERED && 'animate-fade-in'
      )}
      style={{ 
        animationDelay: animationMode === UserManagementAnimationMode.STAGGERED ? `${index * 75}ms` : undefined 
      }}
    >
      {/* Email Column */}
      <TableCell className={getRowVariantStyles()}>
        <div className="flex items-center space-x-3">
          <Skeleton className={cn('rounded-full', variant === UserManagementSkeletonVariant.COMPACT ? 'h-6 w-6' : variant === UserManagementSkeletonVariant.DETAILED ? 'h-10 w-10' : 'h-8 w-8')} />
          <div className="space-y-1">
            <Skeleton className={cn('h-4', columnSizes.email)} />
            {variant !== UserManagementSkeletonVariant.COMPACT && (
              <Skeleton className={cn('h-3', columnSizes.email)} />
            )}
          </div>
        </div>
      </TableCell>

      {/* First Name Column */}
      <TableCell className={getRowVariantStyles()}>
        <Skeleton className={cn('h-4', columnSizes.firstName)} />
      </TableCell>

      {/* Last Name Column */}
      <TableCell className={getRowVariantStyles()}>
        <Skeleton className={cn('h-4', columnSizes.lastName)} />
      </TableCell>

      {/* Role Column */}
      <TableCell className={getRowVariantStyles()}>
        <div className="flex items-center space-x-2">
          <Skeleton className={cn('h-6 rounded-full', columnSizes.role)} />
          {variant === UserManagementSkeletonVariant.DETAILED && (
            <Skeleton className="h-3 w-16" />
          )}
        </div>
      </TableCell>

      {/* Actions Column */}
      {showActions && (
        <TableCell className={getRowVariantStyles()}>
          <div className="flex items-center space-x-2">
            {/* Edit Button */}
            <Skeleton className={cn(
              'transition-all duration-200 hover:scale-105',
              variant === UserManagementSkeletonVariant.COMPACT ? 'h-7 w-7' :
              variant === UserManagementSkeletonVariant.DETAILED ? 'h-9 w-20' :
              'h-8 w-16'
            )}>
              <span className="sr-only">Edit user</span>
            </Skeleton>

            {/* Delete Button */}
            <Skeleton className={cn(
              'transition-all duration-200 hover:scale-105',
              variant === UserManagementSkeletonVariant.COMPACT ? 'h-7 w-7' :
              variant === UserManagementSkeletonVariant.DETAILED ? 'h-9 w-20' :
              'h-8 w-16'
            )}>
              <span className="sr-only">Delete user</span>
            </Skeleton>

            {/* Additional Actions for detailed variant */}
            {variant === UserManagementSkeletonVariant.DETAILED && (
              <Skeleton className="h-9 w-24">
                <span className="sr-only">More actions</span>
              </Skeleton>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  )
}

// Pagination skeleton component
function UserManagementPaginationSkeleton({
  variant = UserManagementSkeletonVariant.STANDARD,
  animationMode = UserManagementAnimationMode.STAGGERED
}: {
  variant?: UserManagementSkeletonVariant
  animationMode?: UserManagementAnimationMode
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-t">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
      
      <div className="flex items-center space-x-2">
        <Skeleton
          className={cn(
            'transition-all duration-200',
            variant === UserManagementSkeletonVariant.COMPACT ? 'h-8 w-8' :
            variant === UserManagementSkeletonVariant.DETAILED ? 'h-10 w-10' :
            'h-9 w-9',
            animationMode === UserManagementAnimationMode.STAGGERED && 'animate-fade-in'
          )}
          style={{ 
            animationDelay: animationMode === UserManagementAnimationMode.STAGGERED ? '200ms' : undefined 
          }}
        />
        <Skeleton
          className={cn(
            'transition-all duration-200',
            variant === UserManagementSkeletonVariant.COMPACT ? 'h-8 w-16' :
            variant === UserManagementSkeletonVariant.DETAILED ? 'h-10 w-20' :
            'h-9 w-18',
            animationMode === UserManagementAnimationMode.STAGGERED && 'animate-fade-in'
          )}
          style={{ 
            animationDelay: animationMode === UserManagementAnimationMode.STAGGERED ? '300ms' : undefined 
          }}
        />
        <Skeleton
          className={cn(
            'transition-all duration-200',
            variant === UserManagementSkeletonVariant.COMPACT ? 'h-8 w-8' :
            variant === UserManagementSkeletonVariant.DETAILED ? 'h-10 w-10' :
            'h-9 w-9',
            animationMode === UserManagementAnimationMode.STAGGERED && 'animate-fade-in'
          )}
          style={{ 
            animationDelay: animationMode === UserManagementAnimationMode.STAGGERED ? '400ms' : undefined 
          }}
        />
      </div>
    </div>
  )
}

// Bulk actions skeleton component
function UserManagementBulkActionsSkeleton({
  variant = UserManagementSkeletonVariant.STANDARD,
  animationMode = UserManagementAnimationMode.STAGGERED
}: {
  variant?: UserManagementSkeletonVariant
  animationMode?: UserManagementAnimationMode
}) {
  return (
    <div className={cn(
      'flex items-center justify-between border-b bg-muted/30',
      variant === UserManagementSkeletonVariant.COMPACT ? 'px-4 py-2' :
      variant === UserManagementSkeletonVariant.DETAILED ? 'px-6 py-4' :
      'px-5 py-3',
      animationMode === UserManagementAnimationMode.STAGGERED && 'animate-fade-in'
    )}>
      <div className="flex items-center space-x-4">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton 
          className="h-4 w-32"
          style={{ 
            animationDelay: animationMode === UserManagementAnimationMode.STAGGERED ? '100ms' : undefined 
          }}
        />
      </div>
      
      <div className="flex items-center space-x-2">
        <Skeleton
          className={cn(
            'transition-all duration-200',
            variant === UserManagementSkeletonVariant.COMPACT ? 'h-7 px-3' :
            variant === UserManagementSkeletonVariant.DETAILED ? 'h-10 px-6' :
            'h-8 px-4',
            animationMode === UserManagementAnimationMode.STAGGERED && 'animate-fade-in'
          )}
          style={{ 
            animationDelay: animationMode === UserManagementAnimationMode.STAGGERED ? '200ms' : undefined 
          }}
        />
        <Skeleton
          className={cn(
            'transition-all duration-200',
            variant === UserManagementSkeletonVariant.COMPACT ? 'h-7 px-3' :
            variant === UserManagementSkeletonVariant.DETAILED ? 'h-10 px-6' :
            'h-8 px-4',
            animationMode === UserManagementAnimationMode.STAGGERED && 'animate-fade-in'
          )}
          style={{ 
            animationDelay: animationMode === UserManagementAnimationMode.STAGGERED ? '300ms' : undefined 
          }}
        />
      </div>
    </div>
  )
}

// Main UserManagementSkeleton component
export function UserManagementSkeleton({
  variant = UserManagementSkeletonVariant.STANDARD,
  animationMode = UserManagementAnimationMode.STAGGERED,
  rowCount = 8,
  showHeader = true,
  showSearchBar = true,
  showFilters = true,
  showCreateButton = true,
  showActions = true,
  showPagination = true,
  showBulkActions = false,
  className,
  ariaLabel = 'Loading user management interface'
}: UserManagementSkeletonProps) {
  // Validate row count (5-10 for realistic display)
  const validatedRowCount = Math.max(5, Math.min(rowCount, 10))
  
  const getCardVariantStyles = () => {
    switch (variant) {
      case UserManagementSkeletonVariant.COMPACT:
        return 'p-0'
      case UserManagementSkeletonVariant.DETAILED:
        return 'p-0'
      default:
        return 'p-0'
    }
  }

  return (
    <div className={cn('space-y-4', className)} role="status" aria-label={ariaLabel}>
      {showHeader && (
        <UserManagementHeaderSkeleton
          showSearchBar={showSearchBar}
          showFilters={showFilters}
          showCreateButton={showCreateButton}
          variant={variant}
          animationMode={animationMode}
        />
      )}

      <Card className={getCardVariantStyles()}>
        {variant === UserManagementSkeletonVariant.DETAILED && (
          <CardHeader className="text-center">
            <CardTitle>
              <Skeleton className="h-6 w-32 mx-auto" />
            </CardTitle>
            <CardDescription>
              <Skeleton className="h-4 w-96 mx-auto" />
            </CardDescription>
          </CardHeader>
        )}
        
        <CardContent className="p-0">
          {/* Bulk Actions */}
          {showBulkActions && (
            <UserManagementBulkActionsSkeleton
              variant={variant}
              animationMode={animationMode}
            />
          )}

          {/* Table */}
          <Table>
            <TableHeader className="bg-blue-500/70 [&_tr]:border-0 hover:[&_tr]:bg-blue-500/10">
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>First Name</TableHead>
                <TableHead>Last Name</TableHead>
                <TableHead>Role</TableHead>
                {showActions && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody className="[&_tr]:border-0">
              {Array.from({ length: validatedRowCount }).map((_, index) => (
                <UserManagementRowSkeleton
                  key={index}
                  index={index}
                  variant={variant}
                  animationMode={animationMode}
                  showActions={showActions}
                />
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {showPagination && (
            <UserManagementPaginationSkeleton
              variant={variant}
              animationMode={animationMode}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Preset configurations for common use cases
export const UserManagementSkeletonPresets = {
  // Compact variant with minimal animations for faster loading
  compact: (props?: Partial<UserManagementSkeletonProps>) => (
    <UserManagementSkeleton
      {...props}
      variant={UserManagementSkeletonVariant.COMPACT}
      animationMode={UserManagementAnimationMode.PULSE}
      rowCount={6}
      showFilters={false}
      showPagination={false}
      className={cn('space-y-2', props?.className)}
    />
  ),

  // Standard variant with staggered animations
  standard: (props?: Partial<UserManagementSkeletonProps>) => (
    <UserManagementSkeleton
      {...props}
      variant={UserManagementSkeletonVariant.STANDARD}
      animationMode={UserManagementAnimationMode.STAGGERED}
      rowCount={8}
      className={cn('space-y-4', props?.className)}
    />
  ),

  // Detailed variant with all features
  detailed: (props?: Partial<UserManagementSkeletonProps>) => (
    <UserManagementSkeleton
      {...props}
      variant={UserManagementSkeletonVariant.DETAILED}
      animationMode={UserManagementAnimationMode.STAGGERED}
      rowCount={10}
      showFilters={true}
      showPagination={true}
      showBulkActions={true}
      className={cn('space-y-6', props?.className)}
    />
  ),

  // Minimal skeleton for fast loading states
  minimal: (props?: Partial<UserManagementSkeletonProps>) => (
    <UserManagementSkeleton
      {...props}
      variant={UserManagementSkeletonVariant.COMPACT}
      animationMode={UserManagementAnimationMode.STATIC}
      rowCount={5}
      showHeader={false}
      showSearchBar={false}
      showFilters={false}
      showActions={false}
      showPagination={false}
      className={cn('space-y-1', props?.className)}
    />
  ),

  // Dashboard integration preset
  dashboard: (props?: Partial<UserManagementSkeletonProps>) => (
    <UserManagementSkeleton
      {...props}
      variant={UserManagementSkeletonVariant.COMPACT}
      animationMode={UserManagementAnimationMode.STAGGERED}
      rowCount={6}
      showCreateButton={false}
      showFilters={false}
      showPagination={false}
      showBulkActions={false}
      className={cn('space-y-3', props?.className)}
    />
  )
}

export default UserManagementSkeleton