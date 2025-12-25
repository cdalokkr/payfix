'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

// Toast types and priorities
export enum ToastType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  LOADING = 'loading'
}

export enum ToastPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Enhanced toast interface
export interface EnhancedToast {
  id: string
  type: ToastType
  title?: string
  message: string
  priority: ToastPriority
  duration?: number // 0 = persist
  dismissible: boolean
  action?: {
    label: string
    onClick: () => void
  }
  context?: string // For grouping related toasts
  timestamp: number
  progress?: number // For loading toasts
}

// Toast container configuration
interface ToastContainerConfig {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center'
  maxToasts: number
  spacing: number
  defaultDuration: number
  showProgress: boolean
  enableGrouping: boolean
}

// Toast manager class
class ToastManager {
  private toasts: EnhancedToast[] = []
  private listeners: Set<(toasts: EnhancedToast[]) => void> = new Set()
  private config: ToastContainerConfig = {
    position: 'top-right',
    maxToasts: 5,
    spacing: 8,
    defaultDuration: 5000,
    showProgress: true,
    enableGrouping: true
  }

  subscribe(listener: (toasts: EnhancedToast[]) => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getToasts() {
    return [...this.toasts]
  }

  setConfig(config: Partial<ToastContainerConfig>) {
    this.config = { ...this.config, ...config }
    this.notifyListeners()
  }

  // Add a new toast
  add(toast: Omit<EnhancedToast, 'id' | 'timestamp'>): string {
    const id = crypto.randomUUID()
    const newToast: EnhancedToast = {
      ...toast,
      id,
      timestamp: Date.now(),
      duration: toast.duration ?? this.config.defaultDuration
    }

    // Remove toasts with same context if grouping is enabled
    if (this.config.enableGrouping && newToast.context) {
      this.removeToastsByContext(newToast.context, toast.type)
    }

    // Add new toast
    this.toasts.unshift(newToast)

    // Limit number of toasts
    if (this.toasts.length > this.config.maxToasts) {
      this.toasts = this.toasts.slice(0, this.config.maxToasts)
    }

    // Auto-remove after duration (except persistent toasts)
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        this.remove(id)
      }, newToast.duration)
    }

    this.notifyListeners()
    return id
  }

  // Remove toast by ID
  remove(id: string) {
    this.toasts = this.toasts.filter(toast => toast.id !== id)
    this.notifyListeners()
  }

  // Remove toasts by context
  private removeToastsByContext(context: string, type?: ToastType) {
    this.toasts = this.toasts.filter(toast => 
      !(toast.context === context && (!type || toast.type === type))
    )
  }

  // Clear all toasts
  clear(type?: ToastType) {
    if (type) {
      this.toasts = this.toasts.filter(toast => toast.type !== type)
    } else {
      this.toasts = []
    }
    this.notifyListeners()
  }

  // Update toast progress
  updateProgress(id: string, progress: number) {
    const toast = this.toasts.find(t => t.id === id)
    if (toast && toast.type === ToastType.LOADING) {
      toast.progress = Math.max(0, Math.min(100, progress))
      this.notifyListeners()
    }
  }

  // Update toast message
  updateMessage(id: string, message: string, title?: string) {
    const toast = this.toasts.find(t => t.id === id)
    if (toast) {
      toast.message = message
      if (title) toast.title = title
      this.notifyListeners()
    }
  }

  // Batch operations for multiple toasts
  batchAdd(toasts: Omit<EnhancedToast, 'id' | 'timestamp'>[]) {
    const ids: string[] = []
    for (const toast of toasts) {
      ids.push(this.add(toast))
    }
    return ids
  }

  getConfig() {
    return { ...this.config }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.toasts]))
  }
}

// Singleton toast manager
export const toastManager = new ToastManager()

// Toast component
function ToastItem({ 
  toast, 
  onDismiss 
}: { 
  toast: EnhancedToast
  onDismiss: (id: string) => void 
}) {
  const [progress, setProgress] = useState(100)
  const [isVisible, setIsVisible] = useState(false)
  const progressRef = useRef<NodeJS.Timeout | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const getIcon = () => {
    switch (toast.type) {
      case ToastType.SUCCESS:
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case ToastType.ERROR:
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case ToastType.WARNING:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case ToastType.INFO:
        return <Info className="h-5 w-5 text-blue-500" />
      case ToastType.LOADING:
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
    }
  }

  const getBorderColor = () => {
    switch (toast.type) {
      case ToastType.SUCCESS:
        return 'border-l-green-500'
      case ToastType.ERROR:
        return 'border-l-red-500'
      case ToastType.WARNING:
        return 'border-l-yellow-500'
      case ToastType.INFO:
        return 'border-l-blue-500'
      case ToastType.LOADING:
        return 'border-l-blue-500'
    }
  }

  const getBgColor = () => {
    switch (toast.type) {
      case ToastType.SUCCESS:
        return 'bg-green-50 dark:bg-green-950/20'
      case ToastType.ERROR:
        return 'bg-red-50 dark:bg-red-950/20'
      case ToastType.WARNING:
        return 'bg-yellow-50 dark:bg-yellow-950/20'
      case ToastType.INFO:
        return 'bg-blue-50 dark:bg-blue-950/20'
      case ToastType.LOADING:
        return 'bg-blue-50 dark:bg-blue-950/20'
    }
  }

  // Animate in
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  // Progress bar animation for auto-dismiss
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const interval = 50 // Update every 50ms
      const steps = (toast.duration / interval) * 100
      let currentStep = 0

      const updateProgress = () => {
        currentStep++
        const newProgress = Math.max(0, 100 - (currentStep / steps) * 100)
        setProgress(newProgress)

        if (newProgress > 0) {
          progressRef.current = setTimeout(updateProgress, interval)
        }
      }

      // Start progress only when not hovering
      const startProgress = () => {
        if (progressRef.current) {
          clearTimeout(progressRef.current)
        }
        updateProgress()
      }

      const stopProgress = () => {
        if (progressRef.current) {
          clearTimeout(progressRef.current)
        }
      }

      // Auto-start progress
      const startTimer = setTimeout(startProgress, 500)
      
      return () => {
        clearTimeout(startTimer)
        stopProgress()
      }
    }
  }, [toast.duration])

  const handleMouseEnter = () => {
    // Pause progress on hover
    if (progressRef.current) {
      clearTimeout(progressRef.current)
    }
    // Reset hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
  }

  const handleMouseLeave = () => {
    // Resume progress after brief delay
    hoverTimeoutRef.current = setTimeout(() => {
      if (toast.duration && toast.duration > 0) {
        const interval = 50
        const remainingProgress = progress
        const steps = (toast.duration / interval) * (remainingProgress / 100)
        let currentStep = 0

        const updateProgress = () => {
          currentStep++
          const newProgress = Math.max(0, remainingProgress - (currentStep / steps) * remainingProgress)
          setProgress(newProgress)

          if (newProgress > 0) {
            progressRef.current = setTimeout(updateProgress, interval)
          }
        }

        updateProgress()
      }
    }, 500)
  }

  return (
    <Card
      className={cn(
        'border-l-4 shadow-lg transition-all duration-300 ease-out',
        'transform',
        isVisible ? 'translate-x-0 opacity-100' : 
          toastManager.getToasts().find(t => t.id === toast.id) === toast ? 
            'translate-x-full opacity-0' : '-translate-x-full opacity-0',
        getBorderColor(),
        getBgColor()
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {toast.title && (
              <h4 className="text-sm font-semibold text-foreground mb-1">
                {toast.title}
              </h4>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed">
              {toast.message}
            </p>
            
            {/* Action button */}
            {toast.action && (
              <Button
                variant="link"
                size="sm"
                onClick={toast.action.onClick}
                className="p-0 h-auto font-semibold text-primary hover:text-primary/80 mt-2"
              >
                {toast.action.label}
              </Button>
            )}
          </div>

          {/* Dismiss button */}
          {toast.dismissible && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDismiss(toast.id)}
              className="h-6 w-6 text-muted-foreground hover:text-foreground flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Progress bar */}
        {toastManager.getConfig().showProgress && toast.duration && toast.duration > 0 && (
          <div className="mt-3 w-full bg-muted rounded-full h-1">
            <div
              className={cn(
                'h-1 rounded-full transition-all duration-75 ease-linear',
                {
                  'bg-green-500': toast.type === ToastType.SUCCESS,
                  'bg-red-500': toast.type === ToastType.ERROR,
                  'bg-yellow-500': toast.type === ToastType.WARNING,
                  'bg-blue-500': toast.type === ToastType.INFO || toast.type === ToastType.LOADING
                }
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Loading progress */}
        {toast.type === ToastType.LOADING && toast.progress !== undefined && (
          <div className="mt-3 w-full bg-muted rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${toast.progress}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Toast container component
export function ToastContainer({ 
  className,
  ...props 
}: React.ComponentProps<'div'>) {
  const [toasts, setToasts] = useState<EnhancedToast[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const unsubscribe = toastManager.subscribe(setToasts)
    return unsubscribe
  }, [])

  const getPositionClasses = () => {
    const position = toastManager.getConfig().position
    const baseClasses = 'fixed z-50 flex flex-col gap-2 pointer-events-none'

    switch (position) {
      case 'top-left':
        return `${baseClasses} top-4 left-4`
      case 'top-right':
        return `${baseClasses} top-4 right-4`
      case 'bottom-left':
        return `${baseClasses} bottom-4 left-4`
      case 'bottom-right':
        return `${baseClasses} bottom-4 right-4`
      case 'top-center':
        return `${baseClasses} top-4 left-1/2 transform -translate-x-1/2`
      case 'bottom-center':
        return `${baseClasses} bottom-4 left-1/2 transform -translate-x-1/2`
      default:
        return `${baseClasses} top-4 right-4`
    }
  }

  if (!mounted) return null

  return createPortal(
    <div 
      className={cn(getPositionClasses(), className)}
      {...props}
    >
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem
            toast={toast}
            onDismiss={toastManager.remove.bind(toastManager)}
          />
        </div>
      ))}
    </div>,
    document.body
  )
}

// Toast API functions
export function toast(
  message: string,
  options?: {
    title?: string
    type?: ToastType
    priority?: ToastPriority
    duration?: number
    dismissible?: boolean
    action?: { label: string; onClick: () => void }
    context?: string
  }
): string {
  const type = options?.type || ToastType.INFO
  const toastOptions = {
    type,
    title: options?.title,
    message,
    priority: options?.priority || ToastPriority.NORMAL,
    duration: options?.duration ?? (type === ToastType.LOADING ? 0 : toastManager.getConfig().defaultDuration),
    dismissible: options?.dismissible !== false,
    action: options?.action,
    context: options?.context
  }

  return toastManager.add(toastOptions)
}

// Convenience methods for different toast types
export const toastSuccess = (message: string, options?: Parameters<typeof toast>[1]) => 
  toast(message, { type: ToastType.SUCCESS, ...options })

export const toastError = (message: string, options?: Parameters<typeof toast>[1]) => 
  toast(message, { type: ToastType.ERROR, ...options })

export const toastWarning = (message: string, options?: Parameters<typeof toast>[1]) => 
  toast(message, { type: ToastType.WARNING, ...options })

export const toastInfo = (message: string, options?: Parameters<typeof toast>[1]) => 
  toast(message, { type: ToastType.INFO, ...options })

export const toastLoading = (message: string, options?: Parameters<typeof toast>[1]) => 
  toast(message, { type: ToastType.LOADING, ...options })

// Toast management functions
export const dismissToast = (id: string) => toastManager.remove(id)
export const clearAllToasts = (type?: ToastType) => toastManager.clear(type)
export const updateToastProgress = (id: string, progress: number) => 
  toastManager.updateProgress(id, progress)
export const updateToastMessage = (id: string, message: string, title?: string) => 
  toastManager.updateMessage(id, message, title)

// Configuration function
export function configureToasts(config: Partial<ToastContainerConfig>) {
  toastManager.setConfig(config)
}

// Hook for toast management in components
export function useToasts() {
  const [toasts, setToasts] = useState<EnhancedToast[]>([])

  useEffect(() => {
    return toastManager.subscribe(setToasts)
  }, [])

  return {
    toasts,
    // Add toast methods
    add: toast,
    success: toastSuccess,
    error: toastError,
    warning: toastWarning,
    info: toastInfo,
    loading: toastLoading,
    // Management methods
    dismiss: dismissToast,
    clear: clearAllToasts,
    updateProgress: updateToastProgress,
    updateMessage: updateToastMessage
  }
}

// Provider component for React app integration
export function ToastProvider({ 
  children,
  config 
}: {
  children: React.ReactNode
  config?: Partial<ToastContainerConfig>
}) {
  useEffect(() => {
    if (config) {
      configureToasts(config)
    }
  }, [config])

  return (
    <>
      {children}
      <ToastContainer />
    </>
  )
}

export default ToastContainer