'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { 
  toastSuccess, 
  toastError, 
  toastWarning, 
  toastInfo, 
  toastLoading,
  updateToastProgress,
  updateToastMessage,
  dismissToast,
  type ToastType
} from '@/components/ui/toast-notifications'
import { type AsyncState } from '@/components/ui/async-button'

// Feedback types and interfaces
export enum FeedbackType {
  NOTIFICATION = 'notification',
  FORM_FEEDBACK = 'form_feedback',
  LOADING_STATE = 'loading_state',
  PROGRESS_FEEDBACK = 'progress_feedback',
  INLINE_FEEDBACK = 'inline_feedback',
  VALIDATION_FEEDBACK = 'validation_feedback',
  SUCCESS_FEEDBACK = 'success_feedback',
  ERROR_FEEDBACK = 'error_feedback'
}

export enum FeedbackSeverity {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error'
}

export interface FeedbackMessage {
  id: string
  type: FeedbackType
  severity: FeedbackSeverity
  title?: string
  message: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
  context?: string
  timestamp: number
  persistent?: boolean
  position?: 'top' | 'bottom' | 'inline'
}

export interface ProgressFeedback {
  id: string
  type: FeedbackType.PROGRESS_FEEDBACK
  title: string
  message?: string
  progress: number // 0-100
  indeterminate?: boolean
  estimatedTimeRemaining?: number // in seconds
  toastId?: string // ID of associated toast notification
}

export interface FormFeedback {
  id: string
  type: FeedbackType.FORM_FEEDBACK
  fieldId: string
  fieldName: string
  severity: FeedbackSeverity
  message: string
  valid: boolean
}

export interface LoadingState {
  id: string
  type: FeedbackType.LOADING_STATE
  operation: string
  state: AsyncState
  message?: string
  progress?: number
  toastId?: string
}

// Main feedback hook
export function useUserFeedback() {
  const [feedbackMessages, setFeedbackMessages] = useState<FeedbackMessage[]>([])
  const [progressFeedback, setProgressFeedback] = useState<Record<string, ProgressFeedback>>({})
  const [formFeedback, setFormFeedback] = useState<Record<string, FormFeedback>>({})
  const [loadingStates, setLoadingStates] = useState<Record<string, LoadingState>>({})

  // Generate unique IDs
  const generateId = useCallback(() => crypto.randomUUID(), [])

  // Add a feedback message
  const addFeedback = useCallback((feedback: Omit<FeedbackMessage, 'id' | 'timestamp'>) => {
    const id = generateId()
    const newFeedback: FeedbackMessage = {
      ...feedback,
      id,
      timestamp: Date.now()
    }

    setFeedbackMessages(prev => [...prev, newFeedback])

    // Auto-remove non-persistent messages
    if (!feedback.persistent && feedback.duration !== 0) {
      setTimeout(() => {
        removeFeedback(id)
      }, feedback.duration || 5000)
    }

    return id
  }, [generateId])

  // Remove feedback message
  const removeFeedback = useCallback((id: string) => {
    setFeedbackMessages(prev => prev.filter(msg => msg.id !== id))
  }, [])

  // Clear all feedback
  const clearFeedback = useCallback((type?: FeedbackType) => {
    if (type) {
      setFeedbackMessages(prev => prev.filter(msg => msg.type !== type))
    } else {
      setFeedbackMessages([])
    }
  }, [])

  // Notification methods
  const showNotification = useCallback((
    message: string,
    options: {
      title?: string
      severity?: FeedbackSeverity
      duration?: number
      action?: { label: string; onClick: () => void }
      context?: string
    } = {}
  ) => {
    const { title, severity = FeedbackSeverity.INFO, duration, action, context } = options

    return addFeedback({
      type: FeedbackType.NOTIFICATION,
      severity,
      title,
      message,
      duration,
      action,
      context,
      persistent: false
    })
  }, [addFeedback])

  const showSuccess = useCallback((
    message: string,
    options?: { title?: string; duration?: number; action?: { label: string; onClick: () => void } }
  ) => {
    return showNotification(message, { ...options, severity: FeedbackSeverity.SUCCESS })
  }, [showNotification])

  const showError = useCallback((
    message: string,
    options?: { title?: string; duration?: number; action?: { label: string; onClick: () => void } }
  ) => {
    return showNotification(message, { ...options, severity: FeedbackSeverity.ERROR })
  }, [showNotification])

  const showWarning = useCallback((
    message: string,
    options?: { title?: string; duration?: number; action?: { label: string; onClick: () => void } }
  ) => {
    return showNotification(message, { ...options, severity: FeedbackSeverity.WARNING })
  }, [showNotification])

  // Progress feedback methods
  const startProgress = useCallback((
    operation: string,
    title: string,
    message?: string,
    indeterminate: boolean = false
  ) => {
    const id = generateId()
    const toastId = toastLoading(message || title, {
      duration: 0 // Don't auto-dismiss progress toasts
    })

    const progressFeedback: ProgressFeedback = {
      id,
      type: FeedbackType.PROGRESS_FEEDBACK,
      title,
      message,
      progress: 0,
      indeterminate,
      toastId
    }

    setProgressFeedback(prev => ({ ...prev, [id]: progressFeedback }))
    return id
  }, [generateId])

  const updateProgress = useCallback((id: string, progress: number, message?: string) => {
    setProgressFeedback(prev => {
      const current = prev[id]
      if (!current) return prev

      const updated = { ...current, progress: Math.max(0, Math.min(100, progress)) }
      if (message) {
        updated.message = message
      }

      // Update associated toast
      if (current.toastId) {
        updateToastProgress(current.toastId, progress)
        if (message) {
          updateToastMessage(current.toastId, message)
        }
      }

      return { ...prev, [id]: updated }
    })
  }, [])

  const completeProgress = useCallback((id: string, successMessage?: string) => {
    setProgressFeedback(prev => {
      const current = prev[id]
      if (!current) return prev

      // Update final state
      const updated = { ...current, progress: 100 }
      if (current.toastId) {
        dismissToast(current.toastId)
      }

      // Show success message
      if (successMessage) {
        toastSuccess(successMessage, { duration: 3000 })
      }

      // Remove after delay
      setTimeout(() => {
        setProgressFeedback(prev => {
          const newPrev = { ...prev }
          delete newPrev[id]
          return newPrev
        })
      }, 2000)

      return { ...prev, [id]: updated }
    })
  }, [])

  const failProgress = useCallback((id: string, errorMessage: string) => {
    setProgressFeedback(prev => {
      const current = prev[id]
      if (!current) return prev

      if (current.toastId) {
        dismissToast(current.toastId)
      }

      toastError(errorMessage)

      // Remove after delay
      setTimeout(() => {
        setProgressFeedback(prev => {
          const newPrev = { ...prev }
          delete newPrev[id]
          return newPrev
        })
      }, 5000)

      const newPrev = { ...prev }
      delete newPrev[id]
      return newPrev
    })
  }, [])

  // Form feedback methods
  const setFormFieldFeedback = useCallback((
    fieldId: string,
    fieldName: string,
    valid: boolean,
    message: string
  ) => {
    const id = generateId()
    const severity = valid ? FeedbackSeverity.SUCCESS : FeedbackSeverity.ERROR

    const feedback: FormFeedback = {
      id,
      type: FeedbackType.FORM_FEEDBACK,
      fieldId,
      fieldName,
      severity,
      message,
      valid
    }

    setFormFeedback(prev => ({ ...prev, [fieldId]: feedback }))
    return id
  }, [generateId])

  const clearFormFieldFeedback = useCallback((fieldId: string) => {
    setFormFeedback(prev => {
      const newPrev = { ...prev }
      delete newPrev[fieldId]
      return newPrev
    })
  }, [])

  const clearAllFormFeedback = useCallback(() => {
    setFormFeedback({})
  }, [])

  // Loading state methods
  const startLoading = useCallback((
    operation: string,
    message?: string
  ) => {
    const id = generateId()
    const toastId = toastLoading(message || operation)

    const loadingState: LoadingState = {
      id,
      type: FeedbackType.LOADING_STATE,
      operation,
      state: 'loading' as AsyncState,
      message,
      toastId
    }

    setLoadingStates(prev => ({ ...prev, [id]: loadingState }))
    return id
  }, [generateId])

  const updateLoadingState = useCallback((
    id: string,
    state: AsyncState,
    message?: string,
    progress?: number
  ) => {
    setLoadingStates(prev => {
      const current = prev[id]
      if (!current) return prev

      const updated = { 
        ...current, 
        state, 
        message: message || current.message,
        progress 
      }

      // Handle toast for different states
      if (current.toastId) {
        switch (state) {
          case 'success':
            dismissToast(current.toastId)
            toastSuccess(message || `${current.operation} completed`)
            break
          case 'error':
            dismissToast(current.toastId)
            toastError(message || `${current.operation} failed`)
            break
          case 'loading':
            if (message || progress !== undefined) {
              updateToastMessage(current.toastId, message || current.operation)
              if (progress !== undefined) {
                updateToastProgress(current.toastId, progress)
              }
            }
            break
        }
      }

      // Remove completed operations after delay
      if (state === 'success' || state === 'error') {
        setTimeout(() => {
          setLoadingStates(prev => {
            const newPrev = { ...prev }
            delete newPrev[id]
            return newPrev
          })
        }, 3000)
      }

      return { ...prev, [id]: updated }
    })
  }, [])

  const stopLoading = useCallback((id: string) => {
    setLoadingStates(prev => {
      const newPrev = { ...prev }
      delete newPrev[id]
      return newPrev
    })
  }, [])

  // Convenience methods for common operations
  const executeWithFeedback = useCallback(async <T>(
    operation: () => Promise<T>,
    options: {
      operationName: string
      successMessage?: string
      errorMessage?: string
      loadingMessage?: string
      showProgress?: boolean
      progressCallback?: (progress: number) => void
    }
  ): Promise<T | null> => {
    const {
      operationName,
      successMessage,
      errorMessage,
      loadingMessage,
      showProgress = false,
      progressCallback
    } = options

    let loadingId: string | null = null
    let progressId: string | null = null

    try {
      // Start loading state
      loadingId = startLoading(operationName, loadingMessage)

      // Start progress if requested
      if (showProgress) {
        progressId = startProgress(operationName, loadingMessage || operationName, undefined, false)
      }

      // Execute operation with optional progress updates
      const result = await operation()

      // Update progress to completion
      if (progressId && progressCallback) {
        completeProgress(progressId, successMessage || `${operationName} completed successfully`)
      }

      // Update loading state to success
      if (loadingId) {
        updateLoadingState(loadingId, 'success', successMessage || `${operationName} completed`)
      }

      return result
    } catch (error) {
      const errorMsg = errorMessage || 
        (error instanceof Error ? error.message : `${operationName} failed`)

      // Fail progress
      if (progressId) {
        failProgress(progressId, errorMsg)
      }

      // Update loading state to error
      if (loadingId) {
        updateLoadingState(loadingId, 'error', errorMsg)
      }

      console.error(`Operation ${operationName} failed:`, error)
      return null
    }
  }, [startLoading, updateLoadingState, startProgress, updateProgress, completeProgress, failProgress])

  // Form submission with comprehensive feedback
  const submitFormWithFeedback = useCallback(async <T>(
    submitFn: () => Promise<T>,
    options: {
      formId: string
      formName: string
      successMessage?: string
      errorMessage?: string
      fieldValidation?: { [fieldId: string]: { valid: boolean; message: string } }
    }
  ): Promise<T | null> => {
    const {
      formId,
      formName,
      successMessage,
      errorMessage,
      fieldValidation
    } = options

    // Set field-level feedback
    if (fieldValidation) {
      Object.entries(fieldValidation).forEach(([fieldId, validation]) => {
        setFormFieldFeedback(fieldId, fieldId, validation.valid, validation.message)
      })

      // If there are validation errors, don't submit
      const hasErrors = Object.values(fieldValidation).some(v => !v.valid)
      if (hasErrors) {
        showError('Please fix the errors below before submitting')
        return null
      }
    }

    // Clear previous form feedback
    clearAllFormFeedback()

    // Submit with loading feedback
    return executeWithFeedback(submitFn, {
      operationName: formName,
      successMessage: successMessage || `${formName} submitted successfully`,
      errorMessage: errorMessage,
      loadingMessage: `Submitting ${formName}...`
    })
  }, [setFormFieldFeedback, clearAllFormFeedback, showError, executeWithFeedback])

  return {
    // State
    feedbackMessages,
    progressFeedback,
    formFeedback,
    loadingStates,

    // General feedback methods
    addFeedback,
    removeFeedback,
    clearFeedback,

    // Notification methods
    showNotification,
    showSuccess,
    showError,
    showWarning,

    // Progress feedback
    startProgress,
    updateProgress,
    completeProgress,
    failProgress,

    // Form feedback
    setFormFieldFeedback,
    clearFormFieldFeedback,
    clearAllFormFeedback,

    // Loading state
    startLoading,
    updateLoadingState,
    stopLoading,

    // Convenience methods
    executeWithFeedback,
    submitFormWithFeedback
  }
}

// Specialized hooks for specific use cases

// Hook for form feedback management
export function useFormFeedback() {
  const { setFormFieldFeedback, clearFormFieldFeedback, clearAllFormFeedback } = useUserFeedback()

  return {
    setFieldFeedback: setFormFieldFeedback,
    clearFieldFeedback: clearFormFieldFeedback,
    clearAllFeedback: clearAllFormFeedback
  }
}

// Hook for progress tracking
export function useProgressFeedback() {
  const { startProgress, updateProgress, completeProgress, failProgress } = useUserFeedback()

  return {
    startProgress,
    updateProgress,
    completeProgress,
    failProgress
  }
}

// Hook for async operations with loading feedback
export function useAsyncFeedback() {
  const { executeWithFeedback } = useUserFeedback()

  return {
    executeWithFeedback
  }
}

// Hook for notification management
export function useNotifications() {
  const { showSuccess, showError, showWarning, showNotification } = useUserFeedback()

  return {
    success: showSuccess,
    error: showError,
    warning: showWarning,
    info: showNotification
  }
}

// Hook for real-time feedback updates
export function useRealtimeFeedback() {
  const feedback = useUserFeedback()
  const [isConnected, setIsConnected] = useState(false)

  // Simulate real-time updates (replace with actual WebSocket implementation)
  useEffect(() => {
    // This is a placeholder for real-time feedback from server
    // In a real implementation, this would connect to a WebSocket or Server-Sent Events
    setIsConnected(true)
    
    return () => {
      setIsConnected(false)
    }
  }, [])

  return {
    ...feedback,
    isConnected
  }
}

// Hook for accessibility announcements
export function useAccessibilityFeedback() {
  const announceRef = useRef<HTMLDivElement>(null)

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announceRef.current) {
      announceRef.current.textContent = message
      announceRef.current.setAttribute('aria-live', priority)
      
      // Clear after announcement
      setTimeout(() => {
        if (announceRef.current) {
          announceRef.current.textContent = ''
        }
      }, 1000)
    }
  }, [])

  return {
    announce,
    announceRef
  }
}

export default useUserFeedback