'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type SimpleAsyncState = 'idle' | 'loading' | 'success';

export interface SimpleAsyncButtonProps extends React.ComponentProps<'button'> {
  /** The async operation to perform when clicked */
  onClick?: () => Promise<void> | void;
  /** Loading text to display */
  loadingText?: string;
  /** Success text to display */
  successText?: string;
  /** Duration to show success state before resetting (ms) */
  successDuration?: number;
  /** Whether to reset to idle state automatically */
  autoReset?: boolean;
  /** Button content when idle */
  children?: React.ReactNode;
  /** Button variant */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Whether the button should take full width */
  fullWidth?: boolean;
}

export function SimpleAsyncButton({
  onClick,
  loadingText = 'Loading...',
  successText = 'Success!',
  successDuration = 1500,
  autoReset = true,
  className,
  variant,
  size,
  disabled,
  fullWidth = false,
  children,
  ...props
}: SimpleAsyncButtonProps) {
  const [state, setState] = useState<SimpleAsyncState>('idle');

  useEffect(() => {
    if (autoReset && state === 'success') {
      const timer = setTimeout(() => {
        setState('idle');
      }, successDuration);
      return () => clearTimeout(timer);
    }
  }, [state, autoReset, successDuration]);
  
  // Note: Auto-reset disabled for success state to prevent user confusion during redirections
  // Users can still manually interact after success, error states still reset automatically

  const handleClick = async () => {
    if (state === 'loading' || !onClick || disabled) return;

    setState('loading');

    try {
      await onClick();
      setState('success');
    } catch (error) {
      console.error('SimpleAsyncButton: Operation failed:', error);
      setState('idle'); // Reset to idle on error
    }
  };

  const getButtonContent = () => {
    switch (state) {
      case 'loading':
        return (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            {loadingText}
          </>
        );
      case 'success':
        return (
          <>
            <CheckCircle className="mr-2 h-4 w-4" aria-hidden="true" />
            {successText}
          </>
        );
      default:
        return children;
    }
  };

  const getButtonStyle = () => {
    if (state === 'success') {
      return {
        backgroundColor: '#16a34a', // green-600
        color: 'white',
        borderColor: '#16a34a',
      } as React.CSSProperties;
    }
    return undefined;
  };

  const isDisabled = disabled || state === 'loading';

  return (
    <Button
      onClick={handleClick}
      disabled={isDisabled}
      variant={variant}
      size={size}
      style={getButtonStyle()}
      className={cn(
        fullWidth && 'w-full',
        state === 'loading' && 'cursor-wait',
        state === 'success' && 'hover:bg-green-700',
        className
      )}
      aria-live={state === 'loading' ? 'polite' : 'off'}
      aria-busy={state === 'loading'}
      {...props}
    >
      {getButtonContent()}
      
      {/* Screen reader only status for accessibility */}
      <span className="sr-only">
        {state === 'loading' && 'Loading'}
        {state === 'success' && 'Success'}
        {state === 'idle' && 'Idle'}
      </span>
    </Button>
  );
}