'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AsyncState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncCallbackHandlers {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onStateChange?: (state: AsyncState, previousState: AsyncState) => void;
}

export interface EnhancedAsyncButtonProps extends React.ComponentProps<'button'> {
  /** The async operation to perform when clicked */
  onClick?: () => Promise<void> | void;
  /** Loading text to display */
  loadingText?: string;
  /** Success text to display */
  successText?: string;
  /** Error text to display */
  errorText?: string;
  /** Duration to show success state before resetting (ms) */
  successDuration?: number;
  /** Duration to show error state before resetting (ms) */
  errorDuration?: number;
  /** Duration to timeout the operation (ms) */
  timeoutDuration?: number;
  /** Whether to reset to idle state automatically */
  autoReset?: boolean;
  /** Custom icons for different states */
  icons?: {
    loading?: React.ReactNode;
    success?: React.ReactNode;
    error?: React.ReactNode;
  };
  /** Enhanced callback handlers */
  callbacks?: AsyncCallbackHandlers;
  /** Button content when idle */
  children?: React.ReactNode;
  /** Button variant */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Whether to show the error state briefly before auto-reset */
  showErrorBriefly?: boolean;
  /** Custom CSS classes for different states */
  stateClasses?: {
    success?: string;
    error?: string;
  };
  /** Enable retry functionality on error */
  enableRetry?: boolean;
}

export function EnhancedAsyncButton({
  onClick,
  loadingText = 'Loading...',
  successText = 'Success!',
  errorText = 'Error occurred',
  successDuration = 2000,
  errorDuration = 3000,
  timeoutDuration = 30000,
  autoReset = true,
  icons = {},
  callbacks = {},
  className,
  variant,
  size,
  disabled,
  children,
  showErrorBriefly = true,
  stateClasses = {},
  enableRetry = true,
  ...props
}: EnhancedAsyncButtonProps) {
  const [state, setState] = useState<AsyncState>('idle');
  const [previousState, setPreviousState] = useState<AsyncState>('idle');
  const [error, setError] = useState<Error | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const defaultIcons = {
    loading: <Loader2 className="mr-2 h-4 w-4 animate-spin" />,
    success: <CheckCircle className="mr-2 h-4 w-4" />,
    error: <AlertCircle className="mr-2 h-4 w-4" />,
  };

  const currentIcons = { ...defaultIcons, ...icons };

  // Enhanced state change handler
  const handleStateChange = (newState: AsyncState) => {
    console.log(`Enhanced AsyncButton: State changed from ${previousState} to ${newState}`);
    setPreviousState(state);
    callbacks.onStateChange?.(newState, state);
  };

  // Timeout management
  useEffect(() => {
    if (state === 'loading' && timeoutDuration > 0) {
      timeoutRef.current = setTimeout(() => {
        console.log('Enhanced AsyncButton: Operation timed out');
        setState('error');
        setError(new Error('Operation timed out'));
        setState('error');
        callbacks.onError?.(new Error('Operation timed out'));
      }, timeoutDuration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [state, timeoutDuration, callbacks]);

  // Enhanced auto-reset with error handling (success state no longer auto-resets)
  useEffect(() => {
    handleStateChange(state);

    // Only auto-reset error states, not success states to prevent user confusion during redirections
    if (autoReset && (state === 'error' && showErrorBriefly)) {
      const duration = errorDuration;
      console.log(`Enhanced AsyncButton: Auto-reset enabled for error state, will reset in ${duration}ms`);
      
      retryTimeoutRef.current = setTimeout(() => {
        setState('idle');
        setError(null);
        // Announce state change to screen readers
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.style.position = 'absolute';
        announcement.style.left = '-10000px';
        announcement.style.width = '1px';
        announcement.style.height = '1px';
        announcement.style.overflow = 'hidden';
        announcement.textContent = 'Operation completed, button ready for next action';
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 1000);
      }, duration);

      return () => {
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
      };
    }
  }, [state, autoReset, successDuration, errorDuration, showErrorBriefly]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  const handleClick = async () => {
    if (state === 'loading' || !onClick) return;

    // Clear any existing timeouts
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);

    console.log('Enhanced AsyncButton: Starting async operation, setting state to loading');
    setState('loading');
    setError(null);

    try {
      console.log('Enhanced AsyncButton: Executing onClick function');
      await onClick();
      console.log('Enhanced AsyncButton: Operation successful, setting state to success');
      setState('success');
      callbacks.onSuccess?.();
    } catch (error) {
      console.error('Enhanced AsyncButton: Operation failed, setting state to error:', error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      setError(errorObj);
      setState('error');
      callbacks.onError?.(errorObj);
    }
  };

  // Retry functionality
  const handleRetry = () => {
    if (enableRetry && state === 'error') {
      setError(null);
      handleClick();
    }
  };

  const getButtonContent = () => {
    switch (state) {
      case 'loading':
        return (
          <>
            {currentIcons.loading}
            {loadingText}
          </>
        );
      case 'success':
        return (
          <>
            {currentIcons.success}
            {successText}
          </>
        );
      case 'error':
        return (
          <>
            {currentIcons.error}
            {enableRetry ? (
              <span className="flex items-center gap-2">
                {errorText}
                {showErrorBriefly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRetry();
                    }}
                    className="h-4 px-2 text-xs ml-2"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                )}
              </span>
            ) : (
              errorText
            )}
          </>
        );
      default:
        return children;
    }
  };

  const getButtonVariant = () => {
    if (state === 'success' || state === 'error') return undefined;
    return variant;
  };

  const getButtonStyle = () => {
    if (state === 'error') {
      return {
        backgroundColor: '#dc2626', // red-600
        color: 'white',
        borderColor: '#dc2626',
        '--hover-bg': '#b91c1c' // red-700
      } as React.CSSProperties;
    }
    // Success state now uses class-based styling with blurred green effect
    return undefined;
  };

  const getEnhancedClasses = () => {
    const baseClasses = [
      'transition-all duration-300 ease-in-out transform',
      'hover:scale-[1.02] active:scale-[0.98]',
    ];

    if (state === 'success') {
      // Success state uses blurred green styling instead of muted
      baseClasses.push(
        'bg-green-500/40', // Semi-transparent green background with increased opacity

        'border-green-500/30', // Semi-transparent green border
        'text-green-700', // Dark green text
        'animate-pulse' // Pulse animation
      );
    } else if (state === 'error') {
      baseClasses.push('animate-bounce');
    } else if (state === 'loading') {
      baseClasses.push('cursor-wait');
    }

    return cn(
      ...baseClasses,
      stateClasses.success && state === 'success' && stateClasses.success,
      stateClasses.error && state === 'error' && stateClasses.error,
      className
    );
  };

  return (
    <Button
      onClick={handleClick}
      disabled={state === 'loading' || disabled}
      variant={getButtonVariant()}
      size={size}
      style={getButtonStyle()}
      className={getEnhancedClasses()}
      aria-live={state === 'loading' ? 'polite' : 'off'}
      aria-busy={state === 'loading'}
      aria-describedby={state === 'error' && error ? 'error-message' : undefined}
      {...props}
    >
      {getButtonContent()}
      {state === 'error' && error && (
        <div
          id="error-message"
          className="sr-only"
          role="alert"
        >
          {error.message}
        </div>
      )}
    </Button>
  );
}

// Pre-configured enhanced variants for common use cases
export function EnhancedLoginButton({ 
  successDuration = 4000, 
  timeoutDuration = 15000,
  ...props 
}: Omit<EnhancedAsyncButtonProps, 'loadingText' | 'successText'>) {
  return (
    <EnhancedAsyncButton
      loadingText="Authenticating..."
      successText="Success! Redirecting..."
      successDuration={successDuration}
      timeoutDuration={timeoutDuration}
      {...props}
    />
  );
}

export function EnhancedSaveButton({ 
  successDuration = 2000, 
  timeoutDuration = 10000,
  ...props 
}: Omit<EnhancedAsyncButtonProps, 'loadingText' | 'successText'>) {
  return (
    <EnhancedAsyncButton
      loadingText="Saving..."
      successText="Saved successfully!"
      successDuration={successDuration}
      timeoutDuration={timeoutDuration}
      {...props}
    />
  );
}

export function EnhancedDeleteButton({ 
  successDuration = 2000, 
  timeoutDuration = 10000,
  ...props 
}: Omit<EnhancedAsyncButtonProps, 'loadingText' | 'successText' | 'errorText'>) {
  return (
    <EnhancedAsyncButton
      loadingText="Deleting..."
      successText="Deleted successfully!"
      errorText="Failed to delete"
      successDuration={successDuration}
      timeoutDuration={timeoutDuration}
      enableRetry={true}
      {...props}
    />
  );
}

export function EnhancedSubmitButton({ 
  successDuration = 2000, 
  timeoutDuration = 10000,
  ...props 
}: Omit<EnhancedAsyncButtonProps, 'loadingText' | 'successText'>) {
  return (
    <EnhancedAsyncButton
      loadingText="Submitting..."
      successText="Submitted successfully!"
      successDuration={successDuration}
      timeoutDuration={timeoutDuration}
      {...props}
    />
  );
}
