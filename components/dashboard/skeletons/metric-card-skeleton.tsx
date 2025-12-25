'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface MetricCardSkeletonProps {
  showIcon?: boolean
  title?: string
  description?: string
  delay?: number
  ariaLabel?: string
  className?: string
  reducedMotion?: boolean
  enableKeyboardNavigation?: boolean
}

export function MetricCardSkeleton({
  showIcon = true,
  title = "Metric Title",
  description = "Metric description",
  delay = 0,
  ariaLabel,
  className,
  reducedMotion = false,
  enableKeyboardNavigation = true
}: MetricCardSkeletonProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  // Check for reduced motion preference
  useEffect(() => {
    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      setPrefersReducedMotion(mediaQuery.matches)
      
      const handleChange = (e: MediaQueryListEvent) => {
        setPrefersReducedMotion(e.matches)
      }
      
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  // Trigger animation on mount
  useEffect(() => {
    if (delay === 0) {
      setIsVisible(true)
    } else {
      const timer = setTimeout(() => setIsVisible(true), delay)
      return () => clearTimeout(timer)
    }
  }, [delay])

  const effectiveReducedMotion = reducedMotion || prefersReducedMotion
  const animationDelay = effectiveReducedMotion ? 0 : delay

  return (
    <Card
      data-testid="metric-card-skeleton"
      className={cn(
        "group shadow-lg bg-muted/30 transition-all duration-300 ease-in-out border-2 border-transparent group-hover:border-border/50",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        "transform-gpu backface-hidden",
        className
      )}
      style={{
        animationDelay: `${animationDelay}ms`,
        transform: isVisible && !effectiveReducedMotion ? 'translateY(0)' : 'translateY(10px)',
        opacity: isVisible ? 1 : 0,
        transition: effectiveReducedMotion ? 'none' : 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      tabIndex={enableKeyboardNavigation ? 0 : -1}
      role="region"
      aria-label={ariaLabel || `Loading ${title} metric card`}
      aria-describedby={ariaLabel ? undefined : 'metric-card-description'}
    >
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div className="relative">
            <Skeleton
              className="h-4 w-20 animate-pulse"
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-30 animate-shimmer"
              aria-hidden="true"
            />
          </div>
          {showIcon && (
            <div className="relative">
              <Skeleton
                className="h-10 w-10 rounded-full animate-pulse"
                aria-hidden="true"
              />
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-30 animate-shimmer"
                aria-hidden="true"
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="relative">
            <Skeleton
              className="h-8 w-16 animate-pulse"
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-20 animate-shimmer animation-delay-100"
              aria-hidden="true"
            />
          </div>
          <div
            id={ariaLabel ? undefined : 'metric-card-description'}
            className="relative"
          >
            <Skeleton
              className="h-3 w-24 animate-pulse"
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-muted to-transparent opacity-15 animate-shimmer animation-delay-150"
              aria-hidden="true"
            />
          </div>
        </div>
      </CardContent>

      {/* Screen reader announcement for progressive enhancement */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {isVisible ? `${title} metric card is loading` : `${title} metric card loaded`}
      </div>
    </Card>
  )
}

// Grid of metric card skeletons for progressive loading
export function MetricCardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <MetricCardSkeleton
          key={i}
          delay={i * 100} // Stagger the loading animation
        />
      ))}
    </div>
  )
}

// Enhanced skeleton with different loading states
export function ProgressiveMetricCardSkeleton() {
  return (
    <Card className="border-2 border-blue-200/50 bg-blue-50/50 shadow-lg">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-20 animate-pulse bg-blue-200" />
          <div className="relative">
            <div className="h-10 w-10 rounded-full bg-blue-200 animate-pulse flex items-center justify-center">
              <div className="w-4 h-4 bg-blue-400 rounded-full animate-bounce" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-300 to-transparent opacity-40 animate-shimmer" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="relative">
            <div className="h-8 w-16 bg-blue-200 rounded animate-pulse" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-300 to-transparent opacity-30 animate-shimmer" />
          </div>
          <div className="relative">
            <div className="h-3 w-24 bg-blue-200 rounded animate-pulse" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-300 to-transparent opacity-20 animate-shimmer animation-delay-100" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}