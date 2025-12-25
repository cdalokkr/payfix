"use client"

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ManualAsyncState = 'idle' | 'loading' | 'success' | 'error';

export interface ManualAsyncButtonProps extends Omit<React.ComponentProps<'button'>, 'onError'> {
  /** The async operation to perform when clicked */
  onClick: () => Promise<any>;
  /** Loading text to display */
  loadingText?: string;
  /** Success text to display */
  successText?: string;
  /** Error text to display */
  errorText?: string;
  /** Callback when operation succeeds */
  onSuccess?: () => void;
  /** Callback when operation fails */
  onAsyncError?: (error: Error) => void;
  /** Custom icons for different states */
  icons?: {
    loading?: React.ReactNode;
    success?: React.ReactNode;
    error?: React.ReactNode;
  };
  /** Children to render when idle */
  children?: React.ReactNode;
}

export function ManualAsyncButton({
  onClick,
  loadingText = 'Loading...',
  successText = 'Success!',
  errorText = 'Error occurred',
  onSuccess,
  onAsyncError,
  icons,
  children,
  className,
  disabled,
  ...props
}: ManualAsyncButtonProps) {
  const [state, setState] = useState<ManualAsyncState>('idle');

  const defaultIcons = {
    loading: <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />,
    success: <CheckCircle className="mr-2 h-4 w-4" aria-hidden="true" />,
    error: <AlertCircle className="mr-2 h-4 w-4" aria-hidden="true" />,
  };

  const currentIcons = { ...defaultIcons, ...icons };

  // Use useEffect to handle state timing like the working AsyncButton
  useEffect(() => {
    console.log('ManualAsyncButton: State changed to:', state);

    if (state === 'success') {
      console.log('ManualAsyncButton: Success state reached, calling onSuccess callback');
      onSuccess?.();
    }

    // Auto-reset to idle after success or error states (but keep them visible)
    if (state === 'success' || state === 'error') {
      const duration = state === 'success' ? 2000 : 3000;
      console.log(`ManualAsyncButton: Will reset from ${state} in ${duration}ms`);
      const timer = setTimeout(() => {
        console.log(`ManualAsyncButton: Auto-resetting from ${state} to idle`);
        setState('idle');
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [state, onSuccess]);

  const handleClick = async () => {
    if (disabled || state === 'loading') return;

    console.log('ManualAsyncButton: Starting async operation, setting state to loading');
    setState('loading');

    try {
      console.log('ManualAsyncButton: Executing onClick function');
      await onClick();
      console.log('ManualAsyncButton: Operation successful, setting state to success');
      setState('success');
    } catch (error) {
      console.error('ManualAsyncButton: Operation failed, setting state to error:', error);
      setState('error');
      onAsyncError?.(error as Error);
    }
  };

  const getButtonContent = () => {
    console.log('ManualAsyncButton: getButtonContent called with state:', state);
    
    switch (state) {
      case 'loading':
        console.log('ManualAsyncButton: Rendering loading state with text:', loadingText);
        return (
          <>
            {currentIcons.loading}
            {loadingText}
          </>
        );
      case 'success':
        console.log('ManualAsyncButton: Rendering success state with text:', successText);
        return (
          <>
            {currentIcons.success}
            {successText}
          </>
        );
      case 'error':
        console.log('ManualAsyncButton: Rendering error state with text:', errorText);
        return (
          <>
            {currentIcons.error}
            {errorText}
          </>
        );
      default:
        console.log('ManualAsyncButton: Rendering idle state with children:', children);
        return children;
    }
  };

  const getButtonStyle = () => {
    if (state === 'success') {
      return {
        backgroundColor: '#16a34a', // green-600
        color: 'white',
        borderColor: '#16a34a',
        '--hover-bg': '#15803d' // green-700
      } as React.CSSProperties;
    }
    if (state === 'error') {
      return {
        backgroundColor: '#dc2626', // red-600
        color: 'white',
        borderColor: '#dc2626',
        '--hover-bg': '#b91c1c' // red-700
      } as React.CSSProperties;
    }
    return undefined;
  };

  const isDisabled = disabled || state === 'loading';

  return (
    <Button
      className={cn(
        "relative inline-flex items-center justify-center gap-2 transition-all duration-200",
        state === 'loading' && "cursor-wait opacity-80",
        state === 'success' && "hover:bg-green-700",
        state === 'error' && "hover:bg-red-700",
        className
      )}
      disabled={isDisabled}
      onClick={handleClick}
      style={getButtonStyle()}
      aria-live={state === 'loading' ? 'polite' : 'off'}
      aria-busy={state === 'loading'}
      {...props}
    >
      {getButtonContent()}
      
      {/* Screen reader only status for accessibility */}
      <span className="sr-only">
        {state === 'loading' && 'Loading'}
        {state === 'success' && 'Success'}
        {state === 'error' && 'Error'}
        {state === 'idle' && 'Idle'}
      </span>
    </Button>
  );
}