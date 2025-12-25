'use client'

import React, { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Loader2,
  Activity,
  BarChart3,
  FileText,
  Users,
  Settings,
  RefreshCw
} from 'lucide-react'

// Loading priority levels for different UI components
export enum LoadingPriority {
  CRITICAL = 'critical',     // Above-the-fold content, navigation
  HIGH = 'high',             // Primary user actions, forms
  MEDIUM = 'medium',         // Secondary content, sidebars
  LOW = 'low',               // Background content, recommendations
  BACKGROUND = 'background'  // Analytics, metadata
}

// Loading state types
export enum LoadingState {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
  PARTIAL = 'partial'
}

// Base loading indicator with configurable variants
export interface LoadingIndicatorProps {
  variant?: 'spinner' | 'dots' | 'pulse' | 'bar' | 'skeleton'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'secondary' | 'muted'
  message?: string
  overlay?: boolean
  priority?: LoadingPriority
  progress?: number // For progress-based loading
  className?: string
}

// Spinner variants
export function Spinner({ 
  size = 'md', 
  color = 'primary', 
  className,
  ...props 
}: Omit<LoadingIndicatorProps, 'variant'>) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  }

  const colorClasses = {
    primary: 'text-primary',
    secondary: 'text-secondary',
    muted: 'text-muted-foreground'
  }

  return (
    <Loader2 
      className={cn(
        'animate-spin',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
      {...props}
    />
  )
}

// Dots loading animation
export function DotsLoader({ 
  size = 'md', 
  color = 'primary', 
  className 
}: Omit<LoadingIndicatorProps, 'variant'>) {
  const sizeClasses = {
    sm: 'h-1 w-1',
    md: 'h-2 w-2',
    lg: 'h-3 w-3',
    xl: 'h-4 w-4'
  }

  const colorClasses = {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    muted: 'bg-muted-foreground'
  }

  return (
    <div className={cn('flex space-x-1', className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            'rounded-full animate-pulse',
            sizeClasses[size],
            colorClasses[color],
            `animation-delay-${i * 100}`
          )}
        />
      ))}
    </div>
  )
}

// Pulse loading animation
export function PulseLoader({ 
  size = 'md', 
  color = 'primary', 
  className 
}: Omit<LoadingIndicatorProps, 'variant'>) {
  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <div className={cn(
        'rounded-full animate-pulse',
        {
          'h-2 w-8': size === 'sm',
          'h-3 w-12': size === 'md',
          'h-4 w-16': size === 'lg',
          'h-5 w-20': size === 'xl'
        },
        {
          'bg-primary': color === 'primary',
          'bg-secondary': color === 'secondary',
          'bg-muted-foreground': color === 'muted'
        }
      )} />
    </div>
  )
}

// Context-aware loading indicator
export function ContextualLoader({
  variant = 'spinner',
  size = 'md',
  color = 'primary',
  message,
  overlay = false,
  priority = LoadingPriority.MEDIUM,
  progress,
  className
}: LoadingIndicatorProps) {
  const [isVisible, setIsVisible] = useState(false)

  // Only show critical and high priority loading immediately
  const shouldShow = priority === LoadingPriority.CRITICAL || priority === LoadingPriority.HIGH

  useEffect(() => {
    if (shouldShow) {
      setIsVisible(true)
    } else {
      // Delay showing lower priority loading to improve perceived performance
      const timer = setTimeout(() => setIsVisible(true), 200)
      return () => clearTimeout(timer)
    }
  }, [shouldShow])

  if (!isVisible) return null

  const loaderContent = (
    <div className={cn(
      'flex flex-col items-center justify-center space-y-3',
      {
        'p-4': size === 'sm',
        'p-6': size === 'md',
        'p-8': size === 'lg',
        'p-12': size === 'xl'
      },
      className
    )}>
      {/* Progress bar for indeterminate loading */}
      {progress !== undefined ? (
        <div className="w-full max-w-xs">
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          {message && (
            <p className="text-sm text-muted-foreground mt-2 text-center">{message}</p>
          )}
        </div>
      ) : (
        <>
          {/* Different loader variants */}
          {variant === 'spinner' && <Spinner size={size} color={color} />}
          {variant === 'dots' && <DotsLoader size={size} color={color} />}
          {variant === 'pulse' && <PulseLoader size={size} color={color} />}
          
          {/* Context-aware messages */}
          {message && (
            <p className={cn(
              'text-muted-foreground',
              {
                'text-xs': size === 'sm',
                'text-sm': size === 'md',
                'text-base': size === 'lg',
                'text-lg': size === 'xl'
              }
            )}>
              {message}
            </p>
          )}
        </>
      )}
    </div>
  )

  if (overlay) {
    return (
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
        {loaderContent}
      </div>
    )
  }

  return loaderContent
}

// Specialized loading components for different content types

// List loading state with staggered animations
export function ListLoader({ 
  count = 5, 
  className,
  delay = 100 
}: { 
  count?: number
  className?: string
  delay?: number 
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30 animate-fade-in"
          style={{ animationDelay: `${i * delay}ms` }}
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  )
}

// Card grid loading state
export function CardGridLoader({ 
  count = 4, 
  columns = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  className 
}: { 
  count?: number
  columns?: string
  className?: string 
}) {
  return (
    <div className={cn('grid gap-4', columns, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-16 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Table loading state
export function TableLoader({ 
  rows = 5, 
  columns = 4, 
  className 
}: { 
  rows?: number
  columns?: number
  className?: string 
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex space-x-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-8 flex-1" />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div 
          key={rowIndex} 
          className="flex space-x-3 animate-fade-in"
          style={{ animationDelay: `${rowIndex * 50}ms` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton 
              key={colIndex} 
              className={cn(
                'h-12 flex-1',
                {
                  'w-24': colIndex === 0, // First column wider
                  'w-16': colIndex === columns - 1, // Last column wider for actions
                  'w-20': colIndex > 0 && colIndex < columns - 1 // Middle columns normal
                }
              )} 
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// Chart loading state with realistic data placeholders
export function ChartLoader({ 
  type = 'bar',
  height = 300,
  className 
}: { 
  type?: 'bar' | 'line' | 'pie' | 'area'
  height?: number
  className?: string 
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-6 w-32 mb-1" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <div className="relative" style={{ height }}>
          <Skeleton className="h-full w-full" />
          
          {/* Simulate chart elements */}
          {type === 'bar' && (
            <div className="absolute inset-0 flex items-end justify-around p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-muted-foreground/20 rounded-t animate-pulse"
                  style={{
                    width: '20px',
                    height: `${Math.random() * 60 + 20}%`,
                    animationDelay: `${i * 100}ms`
                  }}
                />
              ))}
            </div>
          )}
          
          {type === 'line' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-full h-full" viewBox="0 0 300 200">
                <polyline
                  points="0,150 50,120 100,140 150,100 200,110 250,80 300,90"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-muted-foreground/30 animate-pulse"
                />
              </svg>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Progressive loading container for complex layouts
export function ProgressiveLoader({ 
  children,
  priority = LoadingPriority.MEDIUM,
  showImmediate = false,
  className 
}: {
  children: React.ReactNode
  priority?: LoadingPriority
  showImmediate?: boolean
  className?: string
}) {
  const [loadedSections, setLoadedSections] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  // Simulate progressive loading
  useEffect(() => {
    if (priority === LoadingPriority.CRITICAL || showImmediate) {
      setLoadedSections(new Set(['critical']))
    }

    const timer = setTimeout(() => {
      setIsLoading(false)
      setLoadedSections(new Set(['critical', 'primary']))
    }, priority === LoadingPriority.CRITICAL ? 100 : 500)

    return () => clearTimeout(timer)
  }, [priority, showImmediate])

  return (
    <div className={cn('relative', className)}>
      {isLoading && (
        <ContextualLoader
          variant="spinner"
          message={`Loading ${priority} content...`}
          priority={priority}
          overlay
        />
      )}
      <div className={cn(
        'transition-opacity duration-300',
        isLoading ? 'opacity-0' : 'opacity-100'
      )}>
        {children}
      </div>
    </div>
  )
}

// Loading state persistence hook
export function useLoadingStatePersistence(key: string) {
  const [loadingStates, setLoadingStates] = useState<Record<string, LoadingState>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`loading-${key}`)
        return stored ? JSON.parse(stored) : {}
      } catch {
        return {}
      }
    }
    return {}
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`loading-${key}`, JSON.stringify(loadingStates))
      } catch {
        // Ignore storage errors
      }
    }
  }, [key, loadingStates])

  const updateLoadingState = (componentId: string, state: LoadingState) => {
    setLoadingStates(prev => ({ ...prev, [componentId]: state }))
  }

  const getLoadingState = (componentId: string): LoadingState => {
    return loadingStates[componentId] || LoadingState.IDLE
  }

  const clearLoadingState = (componentId?: string) => {
    if (componentId) {
      setLoadingStates(prev => {
        const newState = { ...prev }
        delete newState[componentId]
        return newState
      })
    } else {
      setLoadingStates({})
    }
  }

  return {
    updateLoadingState,
    getLoadingState,
    clearLoadingState,
    loadingStates
  }
}

// Loading performance monitor
export function useLoadingPerformance(componentName: string) {
  const startTimeRef = useRef<number | null>(null)
  const [metrics, setMetrics] = useState<{
    duration?: number
    isLoading: boolean
  }>({ isLoading: false })

  const startLoading = () => {
    startTimeRef.current = performance.now()
    setMetrics(prev => ({ ...prev, isLoading: true }))
  }

  const endLoading = () => {
    if (startTimeRef.current) {
      const duration = performance.now() - startTimeRef.current
      setMetrics({ duration, isLoading: false })
      
      // Log slow loading times for optimization
      if (duration > 1000) {
        console.warn(`Slow loading detected for ${componentName}: ${duration.toFixed(2)}ms`)
      }
      startTimeRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      if (metrics.isLoading) {
        endLoading()
      }
    }
  }, [])

  return {
    startLoading,
    endLoading,
    metrics
  }
}

export default ContextualLoader