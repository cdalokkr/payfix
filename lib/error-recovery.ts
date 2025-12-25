'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useUserFeedback } from '../hooks/use-user-feedback'
import { toastSuccess, toastError } from '@/components/ui/toast-notifications'

// Error recovery strategies
export enum RecoveryStrategy {
  RETRY = 'retry',
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  CIRCUIT_BREAKER = 'circuit_breaker',
  FALLBACK = 'fallback',
  DEGRADE_GRACEFULLY = 'degrade_gracefully',
  MANUAL_RETRY = 'manual_retry'
}

// Recovery states
export enum RecoveryState {
  IDLE = 'idle',
  RETRYING = 'retrying',
  SUCCESS = 'success',
  FAILED = 'failed',
  CIRCUIT_OPEN = 'circuit_open',
  FALLBACK_ACTIVE = 'fallback_active'
}

// Recovery configuration
export interface RecoveryConfig {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  failureThreshold?: number
  resetTimeout?: number
  enableCircuitBreaker?: boolean
  enableExponentialBackoff?: boolean
  onRetry?: (attempt: number, error: Error) => void
  onFallback?: (error: Error) => void
}

// Error recovery result
export interface RecoveryResult<T> {
  success: boolean
  data?: T
  error?: Error
  attempts: number
  finalStrategy: RecoveryStrategy
  recoveryTime: number
}

// Circuit breaker implementation
class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  private readonly config: Required<RecoveryConfig>

  constructor(config: RecoveryConfig) {
    this.config = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      failureThreshold: 5,
      resetTimeout: 60000,
      enableCircuitBreaker: true,
      enableExponentialBackoff: true,
      onRetry: () => {},
      onFallback: () => {},
      ...config
    }
  }

  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<RecoveryResult<T>> {
    const startTime = Date.now()
    let attempts = 0
    let lastError: Error

    // Check circuit breaker state
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
        this.state = 'half-open'
      } else {
        // Circuit is open, try fallback or fail fast
        if (fallback) {
          this.config.onFallback(new Error('Circuit breaker is open'))
          try {
            const result = await fallback()
            return {
              success: true,
              data: result,
              attempts,
              finalStrategy: RecoveryStrategy.FALLBACK,
              recoveryTime: Date.now() - startTime
            }
          } catch (fallbackError) {
            return {
              success: false,
              error: fallbackError as Error,
              attempts,
              finalStrategy: RecoveryStrategy.FALLBACK,
              recoveryTime: Date.now() - startTime
            }
          }
        }
        return {
          success: false,
          error: new Error('Circuit breaker is open'),
          attempts,
          finalStrategy: RecoveryStrategy.CIRCUIT_BREAKER,
          recoveryTime: Date.now() - startTime
        }
      }
    }

    // Execute operation with retry logic
    while (attempts <= this.config.maxRetries) {
      try {
        attempts++
        const result = await operation()
        
        // Success - reset circuit breaker
        if (this.state === 'half-open') {
          this.state = 'closed'
        }
        this.failures = 0

        return {
          success: true,
          data: result,
          attempts,
          finalStrategy: RecoveryStrategy.RETRY,
          recoveryTime: Date.now() - startTime
        }
      } catch (error) {
        lastError = error as Error

        // Call retry callback
        this.config.onRetry(attempts, lastError)

        // Check if we should open the circuit
        if (this.config.enableCircuitBreaker) {
          this.failures++
          if (this.failures >= this.config.failureThreshold) {
            this.state = 'open'
            this.lastFailureTime = Date.now()
          }
        }

        // If this isn't the last attempt, wait before retrying
        if (attempts <= this.config.maxRetries) {
          const delay = this.config.enableExponentialBackoff 
            ? Math.min(
                this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attempts - 1),
                this.config.maxDelay
              )
            : this.config.initialDelay

          // Add jitter to prevent thundering herd
          const jitter = Math.random() * 0.1 * delay
          await new Promise(resolve => setTimeout(resolve, delay + jitter))
        }
      }
    }

    // All retries failed, try fallback or return final error
    if (fallback) {
      this.config.onFallback(lastError!)
      try {
        const result = await fallback()
        return {
          success: true,
          data: result,
          attempts,
          finalStrategy: RecoveryStrategy.FALLBACK,
          recoveryTime: Date.now() - startTime
        }
      } catch (fallbackError) {
        return {
          success: false,
          error: fallbackError as Error,
          attempts,
          finalStrategy: RecoveryStrategy.FALLBACK,
          recoveryTime: Date.now() - startTime
        }
      }
    }

    return {
      success: false,
      error: lastError!,
      attempts,
      finalStrategy: RecoveryStrategy.RETRY,
      recoveryTime: Date.now() - startTime
    }
  }

  getState() {
    return this.state
  }

  getFailureCount() {
    return this.failures
  }

  reset() {
    this.failures = 0
    this.state = 'closed'
  }
}

// Manual retry handler
class ManualRetryHandler {
  private retryCount = 0
  private maxRetries: number
  private onRetry?: (attempt: number, error: Error) => void

  constructor(config: RecoveryConfig = {}) {
    this.maxRetries = config.maxRetries || 3
    this.onRetry = config.onRetry
  }

  canRetry(): boolean {
    return this.retryCount < this.maxRetries
  }

  getRetryCount(): number {
    return this.retryCount
  }

  getMaxRetries(): number {
    return this.maxRetries
  }

  recordRetry(): void {
    this.retryCount++
  }

  reset(): void {
    this.retryCount = 0
  }
}

// Graceful degradation manager
class GracefulDegradationManager {
  private degradationLevels = new Map<string, number>()
  private maxDegradationLevel = 3

  setMaxLevel(level: number) {
    this.maxDegradationLevel = level
  }

  getDegradationLevel(service: string): number {
    return this.degradationLevels.get(service) || 0
  }

  increaseDegradation(service: string): number {
    const current = this.getDegradationLevel(service)
    const newLevel = Math.min(current + 1, this.maxDegradationLevel)
    this.degradationLevels.set(service, newLevel)
    return newLevel
  }

  decreaseDegradation(service: string): number {
    const current = this.getDegradationLevel(service)
    const newLevel = Math.max(0, current - 1)
    this.degradationLevels.set(service, newLevel)
    return newLevel
  }

  reset(service?: string) {
    if (service) {
      this.degradationLevels.delete(service)
    } else {
      this.degradationLevels.clear()
    }
  }

  isDegraded(service: string): boolean {
    return this.getDegradationLevel(service) > 0
  }

  getFallbackStrategy(service: string): string {
    const level = this.getDegradationLevel(service)
    
    switch (level) {
      case 0:
        return 'full_functionality'
      case 1:
        return 'reduced_features'
      case 2:
        return 'basic_functionality'
      case 3:
        return 'read_only'
      default:
        return 'offline_mode'
    }
  }
}

// Main error recovery hook
export function useErrorRecovery(config: RecoveryConfig = {}) {
  const [recoveryState, setRecoveryState] = useState<RecoveryState>(RecoveryState.IDLE)
  const [lastError, setLastError] = useState<Error | null>(null)
  const [recoveryResult, setRecoveryResult] = useState<RecoveryResult<any> | null>(null)
  
  const circuitBreakerRef = useRef<CircuitBreaker | null>(null)
  const manualRetryRef = useRef<ManualRetryHandler | null>(null)
  const degradationManagerRef = useRef<GracefulDegradationManager | null>(null)

  // Initialize components
  useEffect(() => {
    circuitBreakerRef.current = new CircuitBreaker(config)
    manualRetryRef.current = new ManualRetryHandler(config)
    degradationManagerRef.current = new GracefulDegradationManager()

    return () => {
      circuitBreakerRef.current?.reset()
    }
  }, [JSON.stringify(config)])

  const { executeWithFeedback } = useUserFeedback()

  // Execute operation with full error recovery
  const executeWithRecovery = useCallback(async <T>(
    operation: () => Promise<T>,
    options: {
      operationName: string
      fallback?: () => Promise<T>
      enableFeedback?: boolean
      enableManualRetry?: boolean
      onSuccess?: (result: T) => void
      onError?: (error: Error) => void
    } = { operationName: 'operation' }
  ): Promise<RecoveryResult<T> | null> => {
    const {
      operationName,
      fallback,
      enableFeedback = true,
      enableManualRetry = true,
      onSuccess,
      onError
    } = options

    if (!circuitBreakerRef.current || !manualRetryRef.current || !degradationManagerRef.current) {
      throw new Error('Error recovery components not initialized')
    }

    setRecoveryState(RecoveryState.RETRYING)
    setLastError(null)

    try {
      // Execute with circuit breaker
      const result = await circuitBreakerRef.current!.execute(operation, fallback)
      setRecoveryResult(result)

      if (result.success) {
        setRecoveryState(RecoveryState.SUCCESS)
        
        // Decrease degradation level on success
        degradationManagerRef.current!.decreaseDegradation(operationName)
        
        if (enableFeedback) {
          executeWithFeedback(
            () => Promise.resolve(result.data!),
            {
              operationName,
              successMessage: `${operationName} recovered successfully`,
              loadingMessage: `Recovering ${operationName}...`
            }
          )
        }
        
        onSuccess?.(result.data!)
        return result
      } else {
        setRecoveryState(RecoveryState.FAILED)
        setLastError(result.error!)
        
        // Increase degradation level on failure
        degradationManagerRef.current!.increaseDegradation(operationName)
        
        if (enableFeedback) {
          executeWithFeedback(
            () => Promise.reject(result.error!),
            {
              operationName,
              errorMessage: `Failed to recover ${operationName}: ${result.error!.message}`,
              loadingMessage: `Recovering ${operationName}...`
            }
          )
        }
        
        onError?.(result.error!)
        return result
      }
    } catch (error) {
      const err = error as Error
      setLastError(err)
      setRecoveryState(RecoveryState.FAILED)
      
      if (enableFeedback) {
        toastError(`Unexpected error in recovery: ${err.message}`)
      }
      
      onError?.(err)
      return {
        success: false,
        error: err,
        attempts: manualRetryRef.current!.getRetryCount(),
        finalStrategy: RecoveryStrategy.MANUAL_RETRY,
        recoveryTime: 0
      }
    } finally {
      manualRetryRef.current!.reset()
    }
  }, [executeWithFeedback])

  // Manual retry with user interaction
  const attemptManualRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    options: {
      operationName: string
      errorMessage: string
      onSuccess?: (result: T) => void
      onError?: (error: Error) => void
    }
  ): Promise<RecoveryResult<T> | null> => {
    if (!manualRetryRef.current) {
      throw new Error('Manual retry handler not initialized')
    }

    const { operationName, errorMessage, onSuccess, onError } = options

    if (!manualRetryRef.current.canRetry()) {
      const maxRetries = manualRetryRef.current.getMaxRetries()
      const error = new Error(`Maximum retry attempts (${maxRetries}) exceeded`)
      
      setRecoveryState(RecoveryState.FAILED)
      setLastError(error)
      
      toastError(errorMessage)
      onError?.(error)
      
      return {
        success: false,
        error,
        attempts: manualRetryRef.current.getRetryCount(),
        finalStrategy: RecoveryStrategy.MANUAL_RETRY,
        recoveryTime: 0
      }
    }

    manualRetryRef.current.recordRetry()
    setRecoveryState(RecoveryState.RETRYING)

    try {
      const result = await operation()
      
      setRecoveryState(RecoveryState.SUCCESS)
      manualRetryRef.current.reset()
      
      toastSuccess(`Retry successful for ${operationName}`)
      onSuccess?.(result)
      
      return {
        success: true,
        data: result,
        attempts: manualRetryRef.current.getRetryCount(),
        finalStrategy: RecoveryStrategy.MANUAL_RETRY,
        recoveryTime: 0
      }
    } catch (error) {
      const err = error as Error
      setLastError(err)
      
      const remainingRetries = manualRetryRef.current.getMaxRetries() - manualRetryRef.current.getRetryCount()
      const retryMessage = remainingRetries > 0 
        ? `Retry ${manualRetryRef.current.getRetryCount()} failed. ${remainingRetries} attempts remaining.`
        : 'No retry attempts remaining.'
      
      toastError(`${errorMessage}. ${retryMessage}`)
      onError?.(err)
      
      return {
        success: false,
        error: err,
        attempts: manualRetryRef.current.getRetryCount(),
        finalStrategy: RecoveryStrategy.MANUAL_RETRY,
        recoveryTime: 0
      }
    }
  }, [])

  // Get degradation status
  const getDegradationStatus = useCallback((service: string) => {
    if (!degradationManagerRef.current) {
      return {
        level: 0,
        isDegraded: false,
        strategy: 'full_functionality' as const
      }
    }

    return {
      level: degradationManagerRef.current.getDegradationLevel(service),
      isDegraded: degradationManagerRef.current.isDegraded(service),
      strategy: degradationManagerRef.current.getFallbackStrategy(service)
    }
  }, [])

  // Reset all recovery systems
  const resetRecovery = useCallback(() => {
    circuitBreakerRef.current?.reset()
    manualRetryRef.current?.reset()
    degradationManagerRef.current?.reset()
    setRecoveryState(RecoveryState.IDLE)
    setLastError(null)
    setRecoveryResult(null)
  }, [])

  // Check if circuit breaker is open
  const isCircuitOpen = useCallback(() => {
    return circuitBreakerRef.current?.getState() === 'open'
  }, [])

  return {
    // State
    recoveryState,
    lastError,
    recoveryResult,

    // Recovery methods
    executeWithRecovery,
    attemptManualRetry,

    // Status and configuration
    getDegradationStatus,
    isCircuitOpen,
    resetRecovery,

    // Circuit breaker info
    circuitBreakerState: circuitBreakerRef.current?.getState(),
    failureCount: circuitBreakerRef.current?.getFailureCount(),
    
    // Manual retry info
    canManualRetry: manualRetryRef.current?.canRetry() || false,
    retryCount: manualRetryRef.current?.getRetryCount() || 0,
    maxRetries: manualRetryRef.current?.getMaxRetries() || 0
  }
}

// Specialized hooks for specific recovery scenarios

// Hook for API recovery
export function useApiErrorRecovery() {
  const recovery = useErrorRecovery({
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 5000,
    enableCircuitBreaker: true,
    enableExponentialBackoff: true
  })

  return {
    ...recovery,
    recoverApiCall: recovery.executeWithRecovery
  }
}

// Hook for database recovery
export function useDatabaseErrorRecovery() {
  const recovery = useErrorRecovery({
    maxRetries: 5,
    initialDelay: 2000,
    maxDelay: 15000,
    enableCircuitBreaker: true,
    enableExponentialBackoff: true
  })

  return {
    ...recovery,
    recoverDbOperation: recovery.executeWithRecovery
  }
}

// Hook for file system recovery
export function useFileSystemErrorRecovery() {
  const recovery = useErrorRecovery({
    maxRetries: 2,
    initialDelay: 500,
    maxDelay: 3000,
    enableCircuitBreaker: false,
    enableExponentialBackoff: true
  })

  return {
    ...recovery,
    recoverFileOperation: recovery.executeWithRecovery
  }
}

// Hook for network connectivity recovery
export function useNetworkErrorRecovery() {
  const recovery = useErrorRecovery({
    maxRetries: 10,
    initialDelay: 1000,
    maxDelay: 30000,
    enableCircuitBreaker: false,
    enableExponentialBackoff: true
  })

  return {
    ...recovery,
    recoverNetworkCall: recovery.executeWithRecovery
  }
}

export { CircuitBreaker, ManualRetryHandler, GracefulDegradationManager }
export default useErrorRecovery