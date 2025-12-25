'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { CheckCircle, Circle, Clock, Zap } from 'lucide-react'

// Progress indicator types and variants
export enum ProgressType {
  LINEAR = 'linear',
  CIRCULAR = 'circular',
  STEPPER = 'stepper',
  DOTS = 'dots',
  RING = 'ring',
  WAVES = 'waves'
}

// Progress status
export enum ProgressStatus {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
  PAUSED = 'paused'
}

// Linear progress component
export interface LinearProgressProps {
  value?: number // 0-100
  max?: number
  variant?: 'default' | 'buffer' | 'indeterminate' | 'striped'
  size?: 'sm' | 'md' | 'lg'
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  showLabel?: boolean
  label?: string
  labelPosition?: 'start' | 'end' | 'above' | 'inside'
  animated?: boolean
  striped?: boolean
  className?: string
  duration?: number // for indeterminate animations
}

export function LinearProgress({
  value = 0,
  max = 100,
  variant = 'default',
  size = 'md',
  color = 'primary',
  showLabel = false,
  label,
  labelPosition = 'above',
  animated = true,
  striped = false,
  className,
  duration = 2000
}: LinearProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)
  const isIndeterminate = variant === 'indeterminate'
  const isStriped = striped || variant === 'striped'
  
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  }

  const colorClasses = {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500'
  }

  const containerClasses = cn(
    'w-full bg-muted rounded-full overflow-hidden',
    sizeClasses[size],
    animated && 'transition-all duration-300 ease-out',
    className
  )

  const progressClasses = cn(
    'rounded-full h-full transition-all duration-300 ease-out',
    colorClasses[color],
    isStriped && 'bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:1rem_1rem]',
    animated && 'animate-[progress-bar_2s_ease-in-out_infinite]',
    isIndeterminate && 'animate-[indeterminate-bar_1.5s_ease-in-out_infinite]'
  )

  const labelElement = showLabel && (
    <div className={cn(
      'flex items-center justify-between text-sm text-muted-foreground',
      {
        'mb-2': labelPosition === 'above',
        'mt-1': labelPosition === 'end',
        'absolute inset-0 flex items-center justify-center text-xs font-medium text-primary-foreground' 
          : labelPosition === 'inside'
      }
    )}>
      {labelPosition === 'start' && (
        <span>{label || `${Math.round(percentage)}%`}</span>
      )}
      {labelPosition === 'above' && label && (
        <span>{label}</span>
      )}
      {(labelPosition === 'end' || labelPosition === 'above') && (
        <span>{Math.round(percentage)}%</span>
      )}
    </div>
  )

  return (
    <div className={cn('w-full', labelPosition === 'inside' && 'relative')}>
      {labelElement}
      <div className={containerClasses} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <div
          className={progressClasses}
          style={{
            width: isIndeterminate ? '100%' : `${percentage}%`,
            backgroundImage: isStriped 
              ? 'linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.15) 50%, rgba(255,255,255,.15) 75%, transparent 75%, transparent)' 
              : undefined,
            backgroundSize: isStriped ? '1rem 1rem' : undefined
          }}
        />
      </div>
    </div>
  )
}

// Circular progress component
export interface CircularProgressProps {
  value?: number // 0-100
  max?: number
  size?: number // diameter in pixels
  strokeWidth?: number
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  showLabel?: boolean
  label?: string
  centerContent?: React.ReactNode
  variant?: 'default' | 'dashboard' | 'minimal'
  className?: string
  duration?: number
}

export function CircularProgress({
  value = 0,
  max = 100,
  size = 80,
  strokeWidth = 6,
  color = 'primary',
  showLabel = true,
  label,
  centerContent,
  variant = 'default',
  className,
  duration = 2000
}: CircularProgressProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (displayValue / 100) * circumference

  const colorClasses = {
    primary: 'stroke-primary',
    secondary: 'stroke-secondary',
    success: 'stroke-green-500',
    warning: 'stroke-yellow-500',
    error: 'stroke-red-500'
  }

  // Animated counter
  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayValue(percentage)
    }, 100)
    return () => clearTimeout(timer)
  }, [percentage])

  const getCenterContent = () => {
    if (centerContent) return centerContent
    if (!showLabel) return null
    
    if (variant === 'dashboard') {
      return (
        <div className="text-center">
          <div className="text-2xl font-bold">{Math.round(percentage)}%</div>
          {label && <div className="text-sm text-muted-foreground">{label}</div>}
        </div>
      )
    }

    return (
      <div className="text-center">
        <div className="text-lg font-semibold">{Math.round(percentage)}%</div>
        {label && <div className="text-xs text-muted-foreground">{label}</div>}
      </div>
    )
  }

  const trackColor = 'stroke-muted'

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg 
        width={size} 
        height={size} 
        className={cn(
          'transform -rotate-90',
          variant === 'minimal' && 'opacity-75'
        )}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={trackColor}
          opacity={variant === 'minimal' ? 0.3 : 1}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={cn(
            'transition-all duration-1000 ease-out',
            colorClasses[color]
          )}
        />
      </svg>
      
      {/* Center content */}
      {variant !== 'minimal' && (
        <div className="absolute inset-0 flex items-center justify-center">
          {getCenterContent()}
        </div>
      )}
    </div>
  )
}

// Step progress indicator
export interface Step {
  id: string
  label: string
  description?: string
  status: 'pending' | 'active' | 'completed' | 'error'
  icon?: React.ReactNode
}

export interface StepperProps {
  steps: Step[]
  orientation?: 'horizontal' | 'vertical'
  size?: 'sm' | 'md' | 'lg'
  showLabels?: boolean
  showDescriptions?: boolean
  animated?: boolean
  className?: string
}

export function Stepper({
  steps,
  orientation = 'horizontal',
  size = 'md',
  showLabels = true,
  showDescriptions = false,
  animated = true,
  className
}: StepperProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base'
  }

  const connectorClasses = orientation === 'horizontal' 
    ? 'flex-1 h-0.5 mx-4'
    : 'w-0.5 h-8 mx-auto'

  return (
    <div className={cn(
      'flex',
      orientation === 'horizontal' ? 'flex-row items-center' : 'flex-col items-start',
      className
    )}>
      {steps.map((step, index) => {
        const isCompleted = step.status === 'completed'
        const isActive = step.status === 'active'
        const isError = step.status === 'error'
        const isLast = index === steps.length - 1

        return (
          <React.Fragment key={step.id}>
            {/* Step indicator */}
            <div className={cn(
              'flex flex-col items-center',
              orientation === 'horizontal' ? 'text-center' : 'text-left'
            )}>
              {/* Step circle */}
              <div className={cn(
                'relative rounded-full flex items-center justify-center border-2 transition-all duration-300',
                sizeClasses[size],
                isCompleted && 'bg-primary border-primary text-primary-foreground',
                isActive && 'border-primary text-primary bg-primary/10',
                isError && 'border-red-500 text-red-500 bg-red-50 dark:bg-red-950/20',
                !isActive && !isCompleted && !isError && 'border-muted-foreground/30 text-muted-foreground bg-background'
              )}>
                {isCompleted ? (
                  <CheckCircle className="h-5 w-5" />
                ) : isError ? (
                  <Circle className="h-5 w-5" />
                ) : isActive ? (
                  step.icon || <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                ) : (
                  step.icon || <Circle className="h-5 w-5" />
                )}
              </div>

              {/* Step content */}
              {(showLabels || showDescriptions) && (
                <div className={cn(
                  'mt-2',
                  orientation === 'horizontal' ? 'text-center' : 'text-left ml-4'
                )}>
                  {showLabels && (
                    <div className={cn(
                      'font-medium',
                      (isActive || isCompleted) && 'text-foreground',
                      isError && 'text-red-600 dark:text-red-400',
                      !isActive && !isCompleted && !isError && 'text-muted-foreground'
                    )}>
                      {step.label}
                    </div>
                  )}
                  {showDescriptions && step.description && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {step.description}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Connector */}
            {!isLast && (
              <div className={cn(
                'flex-shrink-0 transition-all duration-300',
                connectorClasses,
                steps[index + 1]?.status === 'completed' || steps[index + 1]?.status === 'active'
                  ? 'bg-primary'
                  : 'bg-muted-foreground/20'
              )} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// Dots progress indicator
export interface DotsProgressProps {
  count?: number
  activeIndex?: number
  color?: 'primary' | 'secondary' | 'white'
  size?: 'sm' | 'md' | 'lg'
  animated?: boolean
  className?: string
}

export function DotsProgress({
  count = 3,
  activeIndex = 0,
  color = 'primary',
  size = 'md',
  animated = true,
  className
}: DotsProgressProps) {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4'
  }

  const colorClasses = {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    white: 'bg-white'
  }

  return (
    <div className={cn('flex space-x-2 items-center', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'rounded-full transition-all duration-300',
            sizeClasses[size],
            index <= activeIndex 
              ? colorClasses[color]
              : 'bg-muted-foreground/30',
            animated && index === activeIndex && 'animate-pulse'
          )}
        />
      ))}
    </div>
  )
}

// Ring progress (donut chart style)
export interface RingProgressProps {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  children?: React.ReactNode
  color?: string
  trackColor?: string
  showValue?: boolean
  animated?: boolean
  className?: string
}

export function RingProgress({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  children,
  color = 'currentColor',
  trackColor = '#e5e7eb',
  showValue = true,
  animated = true,
  className
}: RingProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={animated ? strokeDashoffset : 0}
          strokeLinecap="round"
          className={animated ? 'transition-all duration-1000 ease-out' : ''}
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children || (showValue && (
          <span className="text-lg font-semibold">{Math.round(percentage)}%</span>
        ))}
      </div>
    </div>
  )
}

// Animated waves progress
export interface WavesProgressProps {
  value: number
  max?: number
  height?: number
  color?: string
  backgroundColor?: string
  animated?: boolean
  className?: string
}

export function WavesProgress({
  value,
  max = 100,
  height = 60,
  color = '#3b82f6',
  backgroundColor = '#e5e7eb',
  animated = true,
  className
}: WavesProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div 
      className={cn('relative overflow-hidden rounded-lg', className)}
      style={{ height, backgroundColor }}
    >
      {/* Waves */}
      <svg
        className={cn(
          'absolute bottom-0 left-0 w-full',
          animated && 'animate-[wave_4s_linear_infinite]'
        )}
        height={height}
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
      >
        <path
          d="M0,60 C150,100 350,0 600,60 C850,120 1050,20 1200,60 L1200,120 L0,120 Z"
          fill={color}
          className={animated ? 'animate-[wave_4s_ease-in-out_infinite]' : ''}
        />
      </svg>
      
      {/* Percentage */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white font-bold text-lg drop-shadow-lg">
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  )
}

// Multi-step progress with phases
export interface PhaseItem {
  id: string
  name: string
  duration?: number // in milliseconds
  status: 'pending' | 'active' | 'completed' | 'error'
}

export interface PhaseProgressProps {
  phases: PhaseItem[]
  currentPhase?: string
  animated?: boolean
  showDuration?: boolean
  className?: string
}

export function PhaseProgress({
  phases,
  currentPhase,
  animated = true,
  showDuration = false,
  className
}: PhaseProgressProps) {
  const getPhaseProgress = (phaseIndex: number, phasesList: PhaseItem[]) => {
    const phase = phasesList[phaseIndex]
    
    if (phase.status === 'completed') return 100
    if (phase.status === 'active') return 50 // Approximation for active phase
    if (phase.status === 'error') return 0
    return 0
  }

  return (
    <div className={cn('space-y-4', className)}>
      {phases.map((phase, index) => {
        const progress = getPhaseProgress(index, phases)
        const isActive = phase.status === 'active'
        const isCompleted = phase.status === 'completed'
        const isError = phase.status === 'error'

        return (
          <div key={phase.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* Phase icon */}
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
                  isCompleted && 'bg-green-500 text-white',
                  isActive && 'bg-blue-500 text-white',
                  isError && 'bg-red-500 text-white',
                  !isActive && !isCompleted && !isError && 'bg-gray-200 text-gray-600'
                )}>
                  {isCompleted ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : isActive ? (
                    <Clock className="h-4 w-4 animate-pulse" />
                  ) : (
                    index + 1
                  )}
                </div>
                
                {/* Phase name */}
                <span className={cn(
                  'font-medium',
                  (isActive || isCompleted) && 'text-foreground',
                  isError && 'text-red-600 dark:text-red-400',
                  !isActive && !isCompleted && !isError && 'text-muted-foreground'
                )}>
                  {phase.name}
                </span>
              </div>

              {/* Duration */}
              {showDuration && phase.duration && (
                <span className="text-sm text-muted-foreground">
                  {Math.round(phase.duration / 1000)}s
                </span>
              )}
            </div>

            {/* Phase progress bar */}
            <LinearProgress
              value={progress}
              variant={isActive ? 'indeterminate' : 'default'}
              size="sm"
              animated={animated}
              color={isError ? 'error' : isCompleted ? 'success' : 'primary'}
              showLabel={false}
            />
          </div>
        )
      })}
    </div>
  )
}

// Utility hooks for progress management
export function useProgress(value: number, max = 100) {
  const [displayValue, setDisplayValue] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  const startAnimation = useCallback((targetValue: number) => {
    setIsAnimating(true)
    const startValue = displayValue
    const difference = targetValue - startValue
    const duration = 1000
    const steps = 60
    const stepValue = difference / steps
    const stepDuration = duration / steps

    let currentStep = 0
    const timer = setInterval(() => {
      currentStep++
      const newValue = startValue + (stepValue * currentStep)
      
      if (currentStep >= steps) {
        setDisplayValue(targetValue)
        setIsAnimating(false)
        clearInterval(timer)
      } else {
        setDisplayValue(Math.round(newValue))
      }
    }, stepDuration)

    return () => clearInterval(timer)
  }, [displayValue])

  useEffect(() => {
    if (value !== displayValue) {
      startAnimation(value)
    }
  }, [value, displayValue, startAnimation])

  return {
    value: displayValue,
    percentage: Math.min(Math.max((displayValue / max) * 100, 0), 100),
    isAnimating
  }
}

export default LinearProgress