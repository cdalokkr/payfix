'use client'

import React, { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { LoadingSpinner, SpinnerSize } from '@/components/shared/LoadingSpinner'
import { LoadingPriority } from '@/components/ui/loading-states'
import { XIcon } from 'lucide-react'

// Loading states for user operations
export enum UserOperationModalState {
  LOADING_USERS = 'loading_users',
  FETCHING_RECORDS = 'fetching_records',
  PROCESSING = 'processing',
  SAVING_CHANGES = 'saving_changes',
  DELETING_USER = 'deleting_user',
  CREATING_USER = 'creating_user',
  UPDATING_USER = 'updating_user',
  SEARCHING_USERS = 'searching_users',
  EXPORTING_DATA = 'exporting_data',
  IMPORTING_DATA = 'importing_data'
}

// Configuration for each loading state
export interface UserOperationModalConfig {
  message: string
  description?: string
  priority: LoadingPriority
  showCloseButton: boolean
  canBeCancelled: boolean
  progress?: {
    current: number
    total: number
    label: string
  }
}

// Configuration mapping for different operation states
export const USER_OPERATION_MODAL_CONFIG: Record<UserOperationModalState, UserOperationModalConfig> = {
  [UserOperationModalState.LOADING_USERS]: {
    message: 'Loading user data...',
    description: 'Fetching user information from the database',
    priority: LoadingPriority.HIGH,
    showCloseButton: false,
    canBeCancelled: false
  },
  [UserOperationModalState.FETCHING_RECORDS]: {
    message: 'Fetching records from database...',
    description: 'Retrieving user records and permissions',
    priority: LoadingPriority.MEDIUM,
    showCloseButton: false,
    canBeCancelled: false
  },
  [UserOperationModalState.PROCESSING]: {
    message: 'Please wait while we load user information',
    description: 'Processing your request',
    priority: LoadingPriority.HIGH,
    showCloseButton: false,
    canBeCancelled: false
  },
  [UserOperationModalState.SAVING_CHANGES]: {
    message: 'Saving changes...',
    description: 'Updating user information',
    priority: LoadingPriority.HIGH,
    showCloseButton: false,
    canBeCancelled: false
  },
  [UserOperationModalState.DELETING_USER]: {
    message: 'Removing user...',
    description: 'Deleting user account and associated data',
    priority: LoadingPriority.CRITICAL,
    showCloseButton: false,
    canBeCancelled: false
  },
  [UserOperationModalState.CREATING_USER]: {
    message: 'Creating user...',
    description: 'Setting up new user account',
    priority: LoadingPriority.HIGH,
    showCloseButton: false,
    canBeCancelled: false
  },
  [UserOperationModalState.UPDATING_USER]: {
    message: 'Updating user...',
    description: 'Modifying user information',
    priority: LoadingPriority.HIGH,
    showCloseButton: false,
    canBeCancelled: false
  },
  [UserOperationModalState.SEARCHING_USERS]: {
    message: 'Searching users...',
    description: 'Searching for matching users',
    priority: LoadingPriority.MEDIUM,
    showCloseButton: true,
    canBeCancelled: true
  },
  [UserOperationModalState.EXPORTING_DATA]: {
    message: 'Exporting data...',
    description: 'Generating export file',
    priority: LoadingPriority.LOW,
    showCloseButton: true,
    canBeCancelled: true
  },
  [UserOperationModalState.IMPORTING_DATA]: {
    message: 'Importing data...',
    description: 'Processing imported data',
    priority: LoadingPriority.MEDIUM,
    showCloseButton: false,
    canBeCancelled: false
  }
}

// Main modal overlay props
export interface UserOperationModalOverlayProps {
  isVisible: boolean
  state: UserOperationModalState
  onClose?: () => void
  onCancel?: () => void
  className?: string
  backdrop?: boolean
  zIndex?: number
  showProgress?: boolean
  customMessage?: string
  customDescription?: string
  priority?: LoadingPriority
  size?: SpinnerSize
}

// Progress bar component for operations with progress tracking
function ProgressBar({ 
  current, 
  total, 
  label, 
  className 
}: { 
  current: number
  total: number
  label: string
  className?: string 
}) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className={cn('w-full max-w-xs space-y-2', className)}>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{percentage}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300 ease-out relative overflow-hidden"
          style={{ width: `${percentage}%` }}
        >
          {/* Animated shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </div>
      <div className="text-xs text-muted-foreground text-center">
        {current} of {total} completed
      </div>
    </div>
  )
}

// Enhanced backdrop with blur effect
function ModalBackdrop({ 
  isVisible, 
  zIndex = 9999,
  onClick 
}: { 
  isVisible: boolean
  zIndex?: number
  onClick?: () => void 
}) {
  return (
    <div
      className={cn(
        'fixed inset-0 bg-black/50 backdrop-blur-sm transition-all duration-300 ease-in-out',
        isVisible 
          ? 'opacity-100 pointer-events-auto' 
          : 'opacity-0 pointer-events-none'
      )}
      style={{ zIndex }}
      onClick={onClick}
      aria-hidden="true"
    />
  )
}

// Close button component
function CloseButton({ 
  onClose, 
  className,
  disabled = false 
}: { 
  onClose?: () => void
  className?: string
  disabled?: boolean 
}) {
  if (!onClose) return null

  return (
    <button
      type="button"
      onClick={onClose}
      disabled={disabled}
      className={cn(
        'absolute top-4 right-4 rounded-xs opacity-70 transition-opacity',
        'hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        'ring-offset-background',
        className
      )}
      aria-label="Close modal"
    >
      <XIcon className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">Close</span>
    </button>
  )
}

// Cancel button component for cancellable operations
function CancelButton({ 
  onCancel, 
  className,
  loading = false 
}: { 
  onCancel?: () => void
  className?: string
  loading?: boolean 
}) {
  if (!onCancel) return null

  return (
    <button
      type="button"
      onClick={onCancel}
      disabled={loading}
      className={cn(
        'px-4 py-2 text-sm font-medium rounded-md',
        'bg-muted hover:bg-muted/80',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'transition-colors duration-200',
        className
      )}
    >
      {loading ? 'Cancelling...' : 'Cancel'}
    </button>
  )
}

// Main UserOperationModalOverlay component
export function UserOperationModalOverlay({
  isVisible,
  state,
  onClose,
  onCancel,
  className,
  backdrop = true,
  zIndex = 9999,
  showProgress = false,
  customMessage,
  customDescription,
  priority: propPriority,
  size = 'lg'
}: UserOperationModalOverlayProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [showContent, setShowContent] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  // Get configuration for current state
  const config = USER_OPERATION_MODAL_CONFIG[state] || USER_OPERATION_MODAL_CONFIG[UserOperationModalState.PROCESSING]
  const priority = propPriority || config.priority

  // Handle visibility animation
  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true)
      setShowContent(true)
      
      // Store the currently focused element for restoration
      previousActiveElement.current = document.activeElement as HTMLElement
      
      // Focus the modal when it appears
      const timer = setTimeout(() => {
        modalRef.current?.focus()
      }, 100)
      
      return () => clearTimeout(timer)
    } else {
      setIsAnimating(false)
      
      // Delay hiding content until animation completes
      const timer = setTimeout(() => {
        setShowContent(false)
        
        // Restore focus to previously focused element
        if (previousActiveElement.current) {
          previousActiveElement.current.focus()
          previousActiveElement.current = null
        }
      }, 300)
      
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isVisible && (onClose || onCancel)) {
        event.preventDefault()
        if (config.canBeCancelled && onCancel) {
          onCancel()
        } else if (onClose) {
          onClose()
        }
      }
    }

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isVisible, onClose, onCancel, config.canBeCancelled])

  // Don't render anything if not visible and not animating
  if (!showContent && !isAnimating) {
    return null
  }

  const message = customMessage || config.message
  const description = customDescription || config.description

  return (
    <>
      {/* Backdrop */}
      {backdrop && (
        <ModalBackdrop
          isVisible={isAnimating}
          zIndex={zIndex}
          onClick={config.canBeCancelled ? onCancel : undefined}
        />
      )}

      {/* Modal Content */}
      <div
        ref={modalRef}
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center p-4',
          'transition-all duration-300 ease-in-out',
          isAnimating
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-95',
          className
        )}
        style={{ zIndex: zIndex + 1 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        tabIndex={-1}
      >
        <div
          className={cn(
            'relative bg-background rounded-lg shadow-lg border',
            'max-w-md w-full mx-auto',
            'animate-in fade-in-0 zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            'duration-200'
          )}
        >
          {/* Close button for non-critical operations */}
          <CloseButton
            onClose={config.showCloseButton ? onClose : undefined}
            disabled={!config.canBeCancelled && !onClose}
          />

          <div className="p-6 space-y-6">
            {/* Loading Spinner */}
            <div className="flex justify-center">
              <LoadingSpinner
                size={size}
                className="text-primary"
              />
            </div>

            {/* Progress Bar (if available) */}
            {showProgress && config.progress && (
              <ProgressBar
                current={config.progress.current}
                total={config.progress.total}
                label={config.progress.label}
              />
            )}

            {/* Message */}
            <div className="text-center space-y-2">
              <h3 
                id="modal-title"
                className="text-lg font-semibold leading-none tracking-tight"
              >
                {message}
              </h3>
              
              {description && (
                <p 
                  id="modal-description"
                  className="text-sm text-muted-foreground"
                >
                  {description}
                </p>
              )}
            </div>

            {/* Cancel Button for cancellable operations */}
            {config.canBeCancelled && onCancel && (
              <div className="flex justify-center">
                <CancelButton
                  onCancel={onCancel}
                  loading={isAnimating && state === UserOperationModalState.SEARCHING_USERS}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// Convenience component for common use cases
export function UserOperationLoadingModal({
  isLoading,
  operation = UserOperationModalState.PROCESSING,
  onClose,
  ...props
}: {
  isLoading: boolean
  operation?: UserOperationModalState
  onClose?: () => void
} & Omit<UserOperationModalOverlayProps, 'isVisible' | 'state'>) {
  return (
    <UserOperationModalOverlay
      isVisible={isLoading}
      state={operation}
      onClose={isLoading ? undefined : onClose}
      {...props}
    />
  )
}

// Export individual modal components for specific operations
export const UserCreationModal = (props: Omit<UserOperationModalOverlayProps, 'state'>) => (
  <UserOperationModalOverlay state={UserOperationModalState.CREATING_USER} {...props} />
)

export const UserDeletionModal = (props: Omit<UserOperationModalOverlayProps, 'state'>) => (
  <UserOperationModalOverlay state={UserOperationModalState.DELETING_USER} {...props} />
)

export const UserUpdateModal = (props: Omit<UserOperationModalOverlayProps, 'state'>) => (
  <UserOperationModalOverlay state={UserOperationModalState.UPDATING_USER} {...props} />
)

export const DataExportModal = (props: Omit<UserOperationModalOverlayProps, 'state'>) => (
  <UserOperationModalOverlay state={UserOperationModalState.EXPORTING_DATA} {...props} />
)

export const DataImportModal = (props: Omit<UserOperationModalOverlayProps, 'state'>) => (
  <UserOperationModalOverlay state={UserOperationModalState.IMPORTING_DATA} {...props} />
)

export default UserOperationModalOverlay