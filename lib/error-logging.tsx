'use client'

import React from 'react'
import { toast } from 'react-hot-toast'
import { ErrorBoundary } from '@/components/ui/error-boundary'

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error categories for better organization
export enum ErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  SERVER = 'server',
  CLIENT = 'client',
  PERFORMANCE = 'performance',
  USER_ACTION = 'user_action'
}

// Structured error interface
interface StructuredError {
  id: string
  message: string
  severity: ErrorSeverity
  category: ErrorCategory
  timestamp: Date
  userId?: string
  url?: string
  userAgent?: string
  stack?: string
  context?: Record<string, any>
  recoverable: boolean
  retryCount: number
}

// Error logging service
class ErrorLoggingService {
  private errors: StructuredError[] = []
  private maxErrors = 100 // Prevent memory leaks
  private isProduction = process.env.NODE_ENV === 'production'

  // Log an error with structured data
  logError(
    error: Error | string,
    options: {
      severity?: ErrorSeverity
      category?: ErrorCategory
      context?: Record<string, any>
      recoverable?: boolean
    } = {}
  ): StructuredError {
    const message = typeof error === 'string' ? error : error.message
    const stack = typeof error === 'string' ? undefined : error.stack

    const structuredError: StructuredError = {
      id: crypto.randomUUID(),
      message,
      severity: options.severity || ErrorSeverity.MEDIUM,
      category: options.category || ErrorCategory.CLIENT,
      timestamp: new Date(),
      stack,
      context: options.context,
      recoverable: options.recoverable !== false,
      retryCount: 0
    }

    // Add browser context if available
    if (typeof window !== 'undefined') {
      structuredError.url = window.location.href
      structuredError.userAgent = navigator.userAgent
    }

    // Store error locally
    this.errors.push(structuredError)
    if (this.errors.length > this.maxErrors) {
      this.errors.shift() // Remove oldest error
    }

    // Console log for development
    if (!this.isProduction) {
      console.error('Structured Error:', structuredError)
    }

    // Send to external service in production
    if (this.isProduction) {
      this.sendToExternalService(structuredError)
    }

    // Show user-friendly message for certain errors
    this.showUserNotification(structuredError)

    return structuredError
  }

  // Get recent errors for debugging
  getRecentErrors(limit = 10): StructuredError[] {
    return this.errors.slice(-limit)
  }

  // Clear all errors
  clearErrors(): void {
    this.errors = []
  }

  // Send error to external monitoring service
  private async sendToExternalService(error: StructuredError): Promise<void> {
    try {
      // Example: Send to Sentry, LogRocket, etc.
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(error)
      // })

      // For now, we'll just log it
      console.log('Error sent to monitoring service:', error)
    } catch (err) {
      console.warn('Failed to send error to monitoring service:', err)
    }
  }

  // Show user-friendly notifications
  private showUserNotification(error: StructuredError): void {
    // Don't show notification for authentication errors (handled by auth system)
    if (error.category === ErrorCategory.AUTHENTICATION) {
      return
    }

    // Show different messages based on severity
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        toast.error('A critical error occurred. Please refresh the page.', {
          duration: 0, // Don't auto-dismiss critical errors
          id: `error-${error.id}` // Prevent duplicate toasts
        })
        break

      case ErrorSeverity.HIGH:
        toast.error('Something went wrong. Please try again.', {
          duration: 5000,
          id: `error-${error.id}`
        })
        break

      case ErrorSeverity.MEDIUM:
        toast.error('Unable to complete this action.', {
          duration: 3000,
          id: `error-${error.id}`
        })
        break

      case ErrorSeverity.LOW:
        // Silent logging for low severity errors
        break
    }
  }
}

// Singleton instance
export const errorLogger = new ErrorLoggingService()

// Hook for error logging in components
export function useErrorLogging() {
  const logError = (
    error: Error | string,
    options?: {
      severity?: ErrorSeverity
      category?: ErrorCategory
      context?: Record<string, any>
      recoverable?: boolean
    }
  ) => {
    return errorLogger.logError(error, options)
  }

  const logNetworkError = (error: Error, context?: Record<string, any>) => {
    return errorLogger.logError(error, {
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.NETWORK,
      context,
      recoverable: true
    })
  }

  const logUserActionError = (error: Error, action: string, context?: Record<string, any>) => {
    return errorLogger.logError(error, {
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.USER_ACTION,
      context: { action, ...context },
      recoverable: true
    })
  }

  const logPerformanceError = (error: Error, operation: string, context?: Record<string, any>) => {
    return errorLogger.logError(error, {
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.PERFORMANCE,
      context: { operation, ...context },
      recoverable: false
    })
  }

  return {
    logError,
    logNetworkError,
    logUserActionError,
    logPerformanceError
  }
}

// Higher-order component for error boundary wrapping
export function withErrorLogging<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorContext: {
    componentName: string
    category?: ErrorCategory
    defaultSeverity?: ErrorSeverity
  }
) {
  const WithErrorLogging: React.FC<P> = (props) => {
    const { logError } = useErrorLogging()

    React.useEffect(() => {
      // Log component mount
      logError(`Component ${errorContext.componentName} mounted`, {
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.CLIENT,
        context: { component: errorContext.componentName }
      })
    }, [])

    return (
      <ErrorBoundary
        level="component"
        onError={(error, errorInfo) => {
          logError(error, {
            severity: errorContext.defaultSeverity || ErrorSeverity.MEDIUM,
            category: errorContext.category || ErrorCategory.CLIENT,
            context: {
              component: errorContext.componentName,
              componentStack: errorInfo.componentStack
            }
          })
        }}
      >
        <WrappedComponent {...props} />
      </ErrorBoundary>
    )
  }

  WithErrorLogging.displayName = `withErrorLogging(${errorContext.componentName})`
  
  return WithErrorLogging
}

// Error recovery utilities
export class ErrorRecovery {
  // Retry with exponential backoff
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number
      baseDelay?: number
      maxDelay?: number
      onRetry?: (attempt: number, error: Error) => void
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      onRetry
    } = options

    let lastError: Error

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error

        if (attempt === maxRetries) {
          throw error
        }

        // Calculate delay with exponential backoff and jitter
        const delay = Math.min(
          baseDelay * Math.pow(2, attempt),
          maxDelay
        )
        const jitter = Math.random() * 0.1 * delay
        const finalDelay = delay + jitter

        onRetry?.(attempt + 1, lastError)

        await new Promise(resolve => setTimeout(resolve, finalDelay))
      }
    }

    throw lastError!
  }

  // Circuit breaker pattern
  static createCircuitBreaker<T>(
    operation: () => Promise<T>,
    options: {
      failureThreshold?: number
      resetTimeout?: number
      onStateChange?: (state: 'closed' | 'open' | 'half-open') => void
    } = {}
  ) {
    const {
      failureThreshold = 5,
      resetTimeout = 60000, // 1 minute
      onStateChange
    } = options

    let failures = 0
    let lastFailureTime = 0
    let state: 'closed' | 'open' | 'half-open' = 'closed'

    const updateState = (newState: typeof state) => {
      state = newState
      onStateChange?.(newState)
    }

    return async (): Promise<T> => {
      const now = Date.now()

      // Check if circuit should transition from open to half-open
      if (state === 'open' && now - lastFailureTime >= resetTimeout) {
        updateState('half-open')
      }

      // If circuit is open, fail fast
      if (state === 'open') {
        throw new Error('Circuit breaker is open')
      }

      try {
        const result = await operation()
        
        // Success - reset failure count and close circuit
        if (state === 'half-open') {
          updateState('closed')
        }
        failures = 0
        
        return result
      } catch (error) {
        failures++
        lastFailureTime = now

        // Open circuit if failure threshold reached
        if (failures >= failureThreshold) {
          updateState('open')
        }

        throw error
      }
    }
  }
}