'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  level?: 'page' | 'component' | 'section'
  showDetails?: boolean
  retryCount?: number
  maxRetries?: number
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
  retryCount: number
}

// Global error logging function
const logError = (error: Error, errorInfo: ErrorInfo, context: string) => {
  const errorData = {
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
    context,
    timestamp: new Date().toISOString(),
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
    url: typeof window !== 'undefined' ? window.location.href : 'server'
  }
  
  // Console log for development
  console.error('Error Boundary caught an error:', errorData)
  
  // In production, you would send this to your error tracking service
  // Example: Sentry, LogRocket, etc.
  if (typeof window !== 'undefined') {
    // Client-side error tracking
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { extra: errorData })
    }
  }
}

// Basic Error Boundary Component
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    
    this.state = {
      hasError: false,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      retryCount: 0
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // Log error
    const context = `ErrorBoundary (${this.props.level || 'component'})`
    logError(error, errorInfo, context)
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = () => {
    const { retryCount = 0, maxRetries = 3 } = this.props
    
    if (retryCount < maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        retryCount: prevState.retryCount + 1
      }))
    }
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI based on level
      const { level = 'component', showDetails = false, maxRetries = 3 } = this.props
      const { error, retryCount } = this.state
      const canRetry = retryCount < maxRetries

      const errorContent = (
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {level === 'page' && 'The page failed to load properly.'}
            {level === 'component' && 'This component encountered an error.'}
            {level === 'section' && 'This section failed to load.'}
          </p>
          
          {showDetails && error && (
            <details className="mb-4 text-left">
              <summary className="cursor-pointer text-sm font-medium">Error Details</summary>
              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-w-md">
                {error.message}
              </pre>
            </details>
          )}
          
          <div className="flex gap-2">
            {canRetry && (
              <Button 
                onClick={this.handleRetry} 
                variant="outline" 
                size="sm"
                disabled={retryCount >= maxRetries}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry ({maxRetries - retryCount} left)
              </Button>
            )}
            <Button 
              onClick={() => window.location.href = '/'} 
              variant="outline" 
              size="sm"
            >
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </div>
        </div>
      )

      // Different layouts based on level
      if (level === 'page') {
        return (
          <div className="min-h-screen flex items-center justify-center bg-background">
            <Card className="w-full max-w-md">
              <CardContent className="pt-6">
                {errorContent}
              </CardContent>
            </Card>
          </div>
        )
      }

      if (level === 'section') {
        return (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              {errorContent}
            </CardContent>
          </Card>
        )
      }

      // Component level (default)
      return (
        <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
          {errorContent}
        </div>
      )
    }

    return this.props.children
  }
}

// Specialized Error Boundaries
export const PageErrorBoundary: React.FC<Omit<Props, 'level'>> = (props) => (
  <ErrorBoundary {...props} level="page" showDetails={false} />
)

export const SectionErrorBoundary: React.FC<Omit<Props, 'level'>> = (props) => (
  <ErrorBoundary {...props} level="section" />
)

// Loading fallback component for Suspense
export const LoadingFallback: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="flex items-center justify-center p-8">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  </div>
)

// Skeleton fallback for complex components
export const SkeletonFallback: React.FC<{ type?: 'dashboard' | 'chart' | 'table' }> = ({ 
  type = 'dashboard' 
}) => {
  if (type === 'dashboard') {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        
        {/* Metrics grid skeleton */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'chart') {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return <Skeleton className="h-32 w-full" />
}

// Async Error Boundary for data fetching
export const AsyncErrorBoundary: React.FC<Props & { 
  onReset?: () => void 
}> = ({ onReset, ...props }) => {
  const [key, setKey] = React.useState(0)

  const handleReset = () => {
    setKey(prev => prev + 1)
    onReset?.()
  }

  return (
    <ErrorBoundary 
      {...props} 
      key={key}
      fallback={
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to load data</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Unable to fetch the requested information. Please try again.
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleReset} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      }
    />
  )
}

export default ErrorBoundary