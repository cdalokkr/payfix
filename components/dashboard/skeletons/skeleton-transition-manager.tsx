'use client'

import React, { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface TransitionConfig {
  duration?: number
  delay?: number
  easing?: string
  staggerDelay?: number
  enableAccessibility?: boolean
  reducedMotion?: boolean
}

interface SkeletonTransitionManagerProps {
  children: React.ReactNode
  isLoading: boolean
  isError?: boolean
  error?: Error | null
  onRetry?: () => void
  transitionConfig?: TransitionConfig
  className?: string
  fallback?: React.ReactNode
  loadingComponent?: React.ReactNode
}

export function SkeletonTransitionManager({
  children,
  isLoading,
  isError = false,
  error = null,
  onRetry,
  transitionConfig = {},
  className,
  fallback,
  loadingComponent
}: SkeletonTransitionManagerProps) {
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [contentVisible, setContentVisible] = useState(false)
  const [skeletonVisible, setSkeletonVisible] = useState(true)
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const skeletonTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fix the other useRef usage
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const {
    duration = 400,
    delay = 0,
    easing = 'cubic-bezier(0.16, 1, 0.3, 1)',
    staggerDelay = 50,
    enableAccessibility = true,
    reducedMotion = false
  } = transitionConfig

  // Handle reduced motion preference
  const effectiveDuration = reducedMotion ? 0 : duration
  const effectiveDelay = reducedMotion ? 0 : delay

  useEffect(() => {
    if (!isLoading && skeletonVisible) {
      // Start transition when loading completes
      setIsTransitioning(true)
      
      // Show content after skeleton starts fading
      transitionTimeoutRef.current = setTimeout(() => {
        setContentVisible(true)
        
        // Hide skeleton after content is visible
        skeletonTimeoutRef.current = setTimeout(() => {
          setSkeletonVisible(false)
          setIsTransitioning(false)
        }, effectiveDuration)
      }, effectiveDuration / 2)

      // Cleanup timeouts
      return () => {
        if (transitionTimeoutRef.current) {
          clearTimeout(transitionTimeoutRef.current)
        }
        if (skeletonTimeoutRef.current) {
          clearTimeout(skeletonTimeoutRef.current)
        }
      }
    }
  }, [isLoading, skeletonVisible, effectiveDuration])

  // Reset state when loading starts again
  useEffect(() => {
    if (isLoading) {
      setIsTransitioning(false)
      setContentVisible(false)
      setSkeletonVisible(true)
    }
  }, [isLoading])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current)
      }
      if (skeletonTimeoutRef.current) {
        clearTimeout(skeletonTimeoutRef.current)
      }
    }
  }, [])

  // Error state
  if (isError && !isLoading) {
    return (
      <div className={cn('skeleton-error-state', className)}>
        {fallback || (
          <div className="text-center p-6 border border-destructive/20 rounded-lg bg-destructive/5">
            <div className="space-y-4">
              <div className="text-destructive font-medium">Failed to load content</div>
              <div className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'An unexpected error occurred'}
              </div>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div 
      className={cn('skeleton-transition-container', className)}
      style={{ 
        '--transition-duration': `${effectiveDuration}ms`,
        '--transition-easing': easing,
        '--transition-delay': `${effectiveDelay}ms`,
      } as React.CSSProperties}
    >
      {/* Skeleton Loading State */}
      {skeletonVisible && (
        <div
          className={cn(
            'skeleton-loading-state',
            'transition-all ease-out',
            isTransitioning ? 'opacity-0' : 'opacity-100'
          )}
          style={{
            transitionDuration: `${effectiveDuration}ms`,
            transitionDelay: `${effectiveDelay}ms`,
          }}
        >
          {loadingComponent || (
            <div className="space-y-4">
              {/* Default skeleton layout */}
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex space-x-4"
                  style={{ animationDelay: `${i * staggerDelay}ms` }}
                >
                  <div className="w-12 h-12 bg-muted rounded-full animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded animate-pulse" />
                    <div className="h-4 bg-muted/60 rounded w-3/4 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content State */}
      {contentVisible && (
        <div
          className={cn(
            'content-state',
            'transition-all ease-out',
            skeletonVisible ? 'opacity-0' : 'opacity-100'
          )}
          style={{
            transitionDuration: `${effectiveDuration}ms`,
            transitionDelay: skeletonVisible ? `${effectiveDuration / 2}ms` : '0ms',
          }}
        >
          {children}
        </div>
      )}

      {/* Accessibility support */}
      {enableAccessibility && (
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {isLoading ? 'Loading content...' : 'Content loaded'}
        </div>
      )}
    </div>
  )
}

// Hook for individual element transitions
export function useSkeletonTransition(
  isLoading: boolean,
  config: TransitionConfig = {}
) {
  const [isVisible, setIsVisible] = useState(!isLoading)
  const [isSkeletonVisible, setIsSkeletonVisible] = useState(isLoading)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const {
    duration = 300,
    delay = 0,
    reducedMotion = false
  } = config

  useEffect(() => {
    if (!isLoading) {
      setIsVisible(true)
      setTimeout(() => {
        setIsSkeletonVisible(false)
      }, reducedMotion ? 0 : duration / 2)
    } else {
      setIsVisible(false)
      setIsSkeletonVisible(true)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isLoading, duration, reducedMotion])

  return {
    isVisible,
    isSkeletonVisible,
    skeletonProps: {
      className: cn(
        'transition-all ease-out',
        isSkeletonVisible ? 'opacity-100' : 'opacity-0'
      ),
      style: {
        transitionDuration: reducedMotion ? '0ms' : `${duration}ms`,
        transitionDelay: reducedMotion ? '0ms' : `${delay}ms`
      }
    }
  }
}

// HOC for adding skeleton transitions to components
export function withSkeletonTransition<P extends object>(
  Component: React.ComponentType<P>,
  skeletonComponent: React.ComponentType,
  config: TransitionConfig = {}
) {
  const WrappedComponent = (props: P & { 
    isLoading?: boolean
    isError?: boolean
    error?: Error | null
    onRetry?: () => void
  }) => {
    const {
      isLoading = false,
      isError = false,
      error = null,
      onRetry,
      ...componentProps
    } = props

    return (
      <SkeletonTransitionManager
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={onRetry}
        transitionConfig={config}
        loadingComponent={<div className="animate-pulse">Loading...</div>}
      >
        <Component {...(componentProps as P)} />
      </SkeletonTransitionManager>
    )
  }

  WrappedComponent.displayName = `withSkeletonTransition(${Component.displayName || Component.name})`
  return WrappedComponent
}

// Transition state management hook
export function useTransitionState() {
  const [transitionState, setTransitionState] = useState<'idle' | 'entering' | 'exiting' | 'complete'>('idle')
  const [progress, setProgress] = useState(0)

  const startTransition = (duration: number) => {
    setTransitionState('entering')
    setProgress(0)

    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const currentProgress = Math.min(elapsed / duration, 1)
      setProgress(currentProgress)

      if (currentProgress >= 1) {
        setTransitionState('complete')
        clearInterval(interval)
      }
    }, 16) // ~60fps

    return () => clearInterval(interval)
  }

  const resetTransition = () => {
    setTransitionState('idle')
    setProgress(0)
  }

  return {
    transitionState,
    progress,
    startTransition,
    resetTransition
  }
}