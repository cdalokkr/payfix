'use client'

import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  RefreshCw,
  WifiOff,
  CheckCircle, 
  XCircle, 
  Zap, 
  TrendingDown,
  Clock,
  Activity,
  AlertCircle,
  Settings
} from 'lucide-react'
import { 
  useErrorRecovery,
  type RecoveryState,
  type RecoveryResult,
  type RecoveryStrategy
} from '@/lib/error-recovery'
import { toastSuccess, toastError } from '@/components/ui/toast-notifications'

// Error recovery status display
export function RecoveryStatus({
  service,
  className,
  showDetails = true
}: {
  service: string
  className?: string
  showDetails?: boolean
}) {
  const recovery = useErrorRecovery()
  const { getDegradationStatus, circuitBreakerState, failureCount } = recovery
  const status = getDegradationStatus(service)

  const getStatusColor = () => {
    switch (status.level) {
      case 0:
        return 'text-green-600'
      case 1:
        return 'text-yellow-600'
      case 2:
        return 'text-orange-600'
      case 3:
        return 'text-red-600'
      default:
        return 'text-red-700'
    }
  }

  const getStatusIcon = () => {
    switch (status.level) {
      case 0:
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 1:
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 2:
        return <AlertCircle className="h-4 w-4 text-orange-600" />
      case 3:
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <WifiOff className="h-4 w-4 text-red-700" />
    }
  }

  const getStatusText = () => {
    switch (status.level) {
      case 0:
        return 'Healthy'
      case 1:
        return 'Degraded'
      case 2:
        return 'Poor'
      case 3:
        return 'Critical'
      default:
        return 'Offline'
    }
  }

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      {getStatusIcon()}
      <span className={cn('font-medium', getStatusColor())}>
        {getStatusText()}
      </span>
      
      {showDetails && status.level > 0 && (
        <Badge variant="secondary" className="ml-2">
          Level {status.level}
        </Badge>
      )}

      {showDetails && circuitBreakerState === 'open' && (
        <Badge variant="destructive" className="ml-2">
          Circuit Open
        </Badge>
      )}

      {showDetails && (failureCount ?? 0) > 0 && (
        <Badge variant="outline" className="ml-2">
          {failureCount} failures
        </Badge>
      )}
    </div>
  )
}

// Interactive retry component
export function RetryButton({
  operation,
  onRetry,
  errorMessage,
  disabled = false,
  className,
  children
}: {
  operation: () => Promise<any>
  onRetry?: (result: any) => void
  errorMessage?: string
  disabled?: boolean
  className?: string
  children?: React.ReactNode
}) {
  const recovery = useErrorRecovery()
  const { attemptManualRetry, recoveryState, canManualRetry } = recovery

  const handleRetry = async () => {
    const result = await attemptManualRetry(operation, {
      operationName: 'Retry Operation',
      errorMessage: errorMessage || 'Operation failed',
      onSuccess: onRetry
    })

    if (result?.success) {
      toastSuccess('Operation recovered successfully')
    } else {
      toastError('Recovery attempt failed')
    }
  }

  return (
    <Button
      onClick={handleRetry}
      disabled={disabled || !canManualRetry || recoveryState === 'retrying'}
      variant="outline"
      className={cn('transition-all duration-200', className)}
    >
      {recoveryState === 'retrying' ? (
        <>
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          Retrying...
        </>
      ) : (
        <>
          <RefreshCw className="mr-2 h-4 w-4" />
          {children || 'Retry'}
        </>
      )}
    </Button>
  )
}

// Circuit breaker dashboard
export function CircuitBreakerDashboard({
  service,
  className
}: {
  service: string
  className?: string
}) {
  const recovery = useErrorRecovery()
  const { 
    getDegradationStatus, 
    circuitBreakerState, 
    failureCount, 
    isCircuitOpen,
    resetRecovery 
  } = recovery
  
  const status = getDegradationStatus(service)
  const isOpen = isCircuitOpen()

  const getStateColor = () => {
    switch (circuitBreakerState) {
      case 'closed':
        return 'text-green-600 bg-green-100'
      case 'open':
        return 'text-red-600 bg-red-100'
      case 'half-open':
        return 'text-yellow-600 bg-yellow-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Zap className="h-5 w-5" />
          <span>Circuit Breaker Status</span>
        </CardTitle>
        <CardDescription>
          Monitor service health and recovery status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">Service</span>
          <span className="text-sm text-muted-foreground">{service}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-medium">State</span>
          <Badge className={cn('capitalize', getStateColor())}>
            {circuitBreakerState || 'Unknown'}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-medium">Failure Count</span>
          <Badge variant="outline">{failureCount || 0}</Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-medium">Health Status</span>
          <RecoveryStatus service={service} showDetails={false} />
        </div>

        <div className="pt-2">
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(0, 100 - (status.level * 25))}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Service availability: {Math.max(0, 100 - (status.level * 25))}%
          </p>
        </div>

        {isOpen && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Circuit breaker is open. The service is temporarily unavailable.
              <Button 
                variant="link" 
                size="sm" 
                onClick={resetRecovery}
                className="ml-2 p-0 h-auto"
              >
                Reset
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetRecovery}
          >
            <Settings className="mr-2 h-4 w-4" />
            Reset Recovery
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Fallback UI component for degraded services
export function FallbackUI({
  service,
  fallbackContent,
  children,
  className
}: {
  service: string
  fallbackContent?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  const recovery = useErrorRecovery()
  const { getDegradationStatus } = recovery
  const status = getDegradationStatus(service)

  const shouldShowFallback = status.level > 0

  if (!shouldShowFallback) {
    return <>{children}</>
  }

  const getFallbackMessage = () => {
    switch (status.level) {
      case 1:
        return 'This feature is running with reduced functionality.'
      case 2:
        return 'This feature is available in basic mode only.'
      case 3:
        return 'This feature is temporarily read-only.'
      default:
        return 'This feature is currently unavailable.'
    }
  }

  return (
    <div className={cn('relative', className)}>
      {children}
      
      {/* Fallback overlay */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingDown className="h-5 w-5 text-yellow-600" />
              <span>Service Degraded</span>
            </CardTitle>
            <CardDescription>
              {service} is experiencing issues
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {getFallbackMessage()}
              </AlertDescription>
            </Alert>

            {fallbackContent}

            <RecoveryStatus service={service} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Recovery progress indicator
export function RecoveryProgress({
  operation,
  className
}: {
  operation: string
  className?: string
}) {
  const recovery = useErrorRecovery()
  const { recoveryState, recoveryResult } = recovery

  if (recoveryState === 'idle' || recoveryState === 'success' || recoveryState === 'failed') {
    return null
  }

  const getProgressValue = () => {
    switch (recoveryState) {
      case 'retrying':
        return 50
      case 'circuit_open':
        return 75
      case 'fallback_active':
        return 90
      default:
        return 25
    }
  }

  const getStatusText = () => {
    switch (recoveryState) {
      case 'retrying':
        return `Recovering ${operation}...`
      case 'circuit_open':
        return 'Circuit breaker is open'
      case 'fallback_active':
        return 'Using fallback strategy'
      default:
        return `Starting recovery for ${operation}`
    }
  }

  return (
    <Card className={cn('border-yellow-200 bg-yellow-50', className)}>
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <RefreshCw className="h-5 w-5 text-yellow-600 animate-spin" />
          <div className="flex-1">
            <p className="text-sm font-medium">{getStatusText()}</p>
            <div className="w-full bg-muted rounded-full h-2 mt-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${getProgressValue()}%` }}
              />
            </div>
          </div>
        </div>
        
        {recoveryResult && (
          <div className="mt-3 text-xs text-muted-foreground">
            Attempt {recoveryResult.attempts} of {recoveryResult.attempts} • 
            Strategy: {recoveryResult.finalStrategy.replace('_', ' ')}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Error recovery summary component
export function RecoverySummary({
  service,
  operationName,
  recoveryResult,
  className
}: {
  service: string
  operationName: string
  recoveryResult: RecoveryResult<any>
  className?: string
}) {
  const getStatusIcon = () => {
    if (recoveryResult.success) {
      return <CheckCircle className="h-5 w-5 text-green-600" />
    }
    return <XCircle className="h-5 w-5 text-red-600" />
  }

  const getStatusColor = () => {
    if (recoveryResult.success) {
      return 'border-green-200 bg-green-50'
    }
    return 'border-red-200 bg-red-50'
  }

  const getStrategyText = (strategy: RecoveryStrategy) => {
    return strategy.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <Card className={cn(getStatusColor(), className)}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          {getStatusIcon()}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">
                {recoveryResult.success ? 'Recovery Successful' : 'Recovery Failed'}
              </h3>
              <Badge variant="outline">
                {getStrategyText(recoveryResult.finalStrategy)}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground mt-1">
              {operationName} on {service}
            </p>

            <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
              <span>Attempts: {recoveryResult.attempts}</span>
              <span>Time: {recoveryResult.recoveryTime}ms</span>
              {recoveryResult.error && (
                <span className="text-red-600 truncate max-w-xs">
                  {recoveryResult.error.message}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Recovery configuration panel
export function RecoveryConfig({
  service,
  className
}: {
  service: string
  className?: string
}) {
  const recovery = useErrorRecovery()
  const { resetRecovery, getDegradationStatus } = recovery
  const [showAdvanced, setShowAdvanced] = useState(false)

  const status = getDegradationStatus(service)

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5" />
          <span>Recovery Configuration</span>
        </CardTitle>
        <CardDescription>
          Manage error recovery settings for {service}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">Current Status</span>
          <RecoveryStatus service={service} />
        </div>

        <div className="flex items-center justify-between">
          <span className="font-medium">Degradation Level</span>
          <Badge variant={status.level === 0 ? 'default' : 'destructive'}>
            Level {status.level} / 3
          </Badge>
        </div>

        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetRecovery}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Settings className="mr-2 h-4 w-4" />
            {showAdvanced ? 'Hide' : 'Show'} Details
          </Button>
        </div>

        {showAdvanced && (
          <div className="pt-4 border-t space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Fallback Strategy</span>
              <span className="font-mono">{status.strategy}</span>
            </div>
            <div className="flex justify-between">
              <span>Is Degraded</span>
              <Badge variant={status.isDegraded ? 'destructive' : 'default'}>
                {status.isDegraded ? 'Yes' : 'No'}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Combined error recovery wrapper
export function ErrorRecoveryWrapper({
  service,
  operationName,
  children,
  fallbackContent,
  showStatus = true,
  className
}: {
  service: string
  operationName: string
  children: React.ReactNode
  fallbackContent?: React.ReactNode
  showStatus?: boolean
  className?: string
}) {
  const recovery = useErrorRecovery()
  const { recoveryState, recoveryResult } = recovery

  return (
    <div className={cn('space-y-4', className)}>
      {showStatus && (
        <RecoveryStatus service={service} />
      )}

      <RecoveryProgress operation={operationName} />

      <FallbackUI service={service} fallbackContent={fallbackContent}>
        {children}
      </FallbackUI>

      {recoveryResult && (
        <RecoverySummary
          service={service}
          operationName={operationName}
          recoveryResult={recoveryResult}
        />
      )}

      <CircuitBreakerDashboard service={service} />
    </div>
  )
}

export default ErrorRecoveryWrapper