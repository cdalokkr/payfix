"use client";

import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, forwardRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Clock,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Target,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";

// State types
export type AsyncState = 'idle' | 'loading' | 'success' | 'error' | 'paused' | 'retrying';

export interface AdvancedAsyncButtonProps {
  /** The async operation to perform when clicked */
  onClick: () => Promise<void> | void;
  /** Initial button text */
  initialText?: string;
  /** Loading state text */
  loadingText?: string;
  /** Success state text */
  successText?: string;
  /** Error state text */
  errorText?: string;
  /** Paused state text */
  pausedText?: string;
  /** Retry state text */
  retryText?: string;
  /** Duration to show success state (ms) */
  successDuration?: number;
  /** Duration to show error state (ms) */
  errorDuration?: number;
  /** Duration to show paused state (ms) */
  pausedDuration?: number;
  /** Operation timeout (ms) */
  timeoutDuration?: number;
  /** Progress animation duration for long operations (ms) */
  progressDuration?: number;
  /** Whether to auto-reset to idle state */
  autoReset?: boolean;
  /** Whether to enable progress indicator for long operations */
  showProgress?: boolean;
  /** Whether to enable retry functionality */
  enableRetry?: boolean;
  /** Whether to enable pause functionality */
  enablePause?: boolean;
  /** Custom icons for different states */
  icons?: {
    idle?: React.ReactNode;
    loading?: React.ReactNode;
    success?: React.ReactNode;
    error?: React.ReactNode;
    paused?: React.ReactNode;
    retrying?: React.ReactNode;
    retry?: React.ReactNode;
    pause?: React.ReactNode;
    resume?: React.ReactNode;
  };
  /** Animation presets */
  preset?: 'default' | 'subtle' | 'dramatic' | 'minimal';
  /** Whether to respect reduced motion preferences */
  respectReducedMotion?: boolean;
  /** Custom CSS classes */
  className?: string;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'outline' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Callback when state changes */
  onStateChange?: (state: AsyncState, previousState: AsyncState) => void;
  /** Callback when operation completes successfully */
  onSuccess?: () => void;
  /** Callback when operation fails */
  onError?: (error: Error) => void;
  /** Callback when retry is requested */
  onRetry?: () => void;
  /** Callback when operation is paused */
  onPause?: () => void;
  /** Callback when operation is resumed */
  onResume?: () => void;
  /** Custom micro-interactions */
  microInteractions?: {
    hover?: boolean;
    tap?: boolean;
    focus?: boolean;
  };
  /** Children content (for idle state) */
  children?: React.ReactNode;
  /** Whether to show loading dots animation */
  showLoadingDots?: boolean;
}

export const AdvancedAsyncButton = forwardRef<HTMLButtonElement, AdvancedAsyncButtonProps>((
  {
    // Core props
    onClick,
    initialText = "Click to start",
    loadingText = "Processing...",
    successText = "Completed successfully!",
    errorText = "Something went wrong",
    pausedText = "Paused",
    retryText = "Retrying...",
    
    // Timing props
    successDuration = 2500,
    errorDuration = 4000,
    pausedDuration = Infinity,
    timeoutDuration = 30000,
    progressDuration = 5000,
    
    // Feature flags
    autoReset = true,
    showProgress = true,
    enableRetry = true,
    enablePause = true,
    respectReducedMotion = true,
    showLoadingDots = false,
    
    // Styling
    className,
    variant = "primary",
    size = "md",
    disabled = false,
    
    // Icons
    icons = {},
    preset = "default",
    
    // Callbacks
    onStateChange,
    onSuccess,
    onError,
    onRetry,
    onPause,
    onResume,
    
    // Micro-interactions
    microInteractions = {
      hover: true,
      tap: true,
      focus: true
    },
    
    children
  },
  ref
) => {
  // State management
  const [state, setState] = useState<AsyncState>('idle');
  const [previousState, setPreviousState] = useState<AsyncState>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);
  const [loadingDots, setLoadingDots] = useState("");
  
  // Refs
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dotsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Reduced motion detection
  const shouldReduceMotion = useReducedMotion();
  const useReducedMotionPref = respectReducedMotion && shouldReduceMotion;

  // Default icons
  const defaultIcons = {
    idle: <Play className="w-4 h-4" />,
    loading: <Loader2 className="w-4 h-4" />,
    success: <CheckCircle className="w-4 h-4" />,
    error: <AlertCircle className="w-4 h-4" />,
    paused: <Pause className="w-4 h-4" />,
    retrying: <RotateCcw className="w-4 h-4" />,
    retry: <RotateCcw className="w-4 h-4" />,
    pause: <Pause className="w-4 h-4" />,
    resume: <Play className="w-4 h-4" />
  };

  const currentIcons = { ...defaultIcons, ...icons };

  // Loading dots animation
  useEffect(() => {
    if (state === 'loading' && showLoadingDots) {
      const sequence = ['.', '..', '...', ''];
      let index = 0;
      
      const animateDots = () => {
        setLoadingDots(sequence[index]);
        index = (index + 1) % sequence.length;
      };
      
      dotsIntervalRef.current = setInterval(animateDots, 500);
      animateDots();
      
      return () => {
        if (dotsIntervalRef.current) {
          clearInterval(dotsIntervalRef.current);
          setLoadingDots("");
        }
      };
    }
  }, [state, showLoadingDots]);

  // Progress indicator for long operations
  useEffect(() => {
    if (state === 'loading' && showProgress && progressDuration > 0) {
      const startTime = Date.now();
      const interval = 50; // Update every 50ms for smooth animation
      
      const updateProgress = () => {
        const elapsed = Date.now() - startTime;
        const newProgress = Math.min((elapsed / progressDuration) * 100, 100);
        setProgress(newProgress);
        
        if (newProgress >= 100) {
          clearInterval(progressIntervalRef.current!);
        }
      };
      
      progressIntervalRef.current = setInterval(updateProgress, interval);
      updateProgress();
      
      return () => {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      };
    } else {
      setProgress(0);
    }
  }, [state, showProgress, progressDuration]);

  // Timeout management
  useEffect(() => {
    if (state === 'loading' && timeoutDuration > 0) {
      timeoutRef.current = setTimeout(() => {
        handleTimeout();
      }, timeoutDuration);
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [state, timeoutDuration]);

  // State change handler
  const handleStateChange = useCallback((newState: AsyncState) => {
    if (newState !== state) {
      setPreviousState(state);
      setState(newState);
      onStateChange?.(newState, state);
    }
  }, [state, onStateChange]);

  // Auto-reset functionality (only for error and paused states, not success)
  useEffect(() => {
    if (autoReset && (state === 'error' || state === 'paused')) {
      const duration = state === 'error' ? errorDuration : pausedDuration;
      
      if (duration !== Infinity) {
        const timer = setTimeout(() => {
          handleStateChange('idle');
        }, duration);
        
        return () => clearTimeout(timer);
      }
    }
    // Success state persists - no auto-reset to allow for redirection
  }, [state, autoReset, successDuration, errorDuration, pausedDuration, handleStateChange]);

  // Handlers
  const handleClick = useCallback(async () => {
    if (state === 'loading' || disabled || !onClick) return;
    
    setState('loading');
    onStateChange?.('loading', state);
    
    try {
      const result = onClick();
      if (result instanceof Promise) {
        await result;
      }
      
      setState('success');
      onStateChange?.('success', 'loading');
      onSuccess?.();
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      setError(errorObj);
      setState('error');
      onStateChange?.('error', 'loading');
      onError?.(errorObj);
    }
  }, [state, disabled, onClick, onStateChange, onSuccess, onError]);

  const handleRetry = useCallback(() => {
    if (enableRetry && state === 'error') {
      setState('retrying');
      onStateChange?.('retrying', 'error');
      onRetry?.();
      
      // Brief retry animation then start again
      setTimeout(() => {
        handleClick();
      }, 800);
    }
  }, [enableRetry, state, onStateChange, onRetry, handleClick]);

  const handlePause = useCallback(() => {
    if (enablePause && state === 'loading') {
      setState('paused');
      onStateChange?.('paused', 'loading');
      onPause?.();
    }
  }, [enablePause, state, onStateChange, onPause]);

  const handleResume = useCallback(() => {
    if (enablePause && state === 'paused') {
      setState('loading');
      onStateChange?.('loading', 'paused');
      onResume?.();
    }
  }, [enablePause, state, onStateChange, onResume]);

  const handleTimeout = useCallback(() => {
    if (state === 'loading') {
      setError(new Error('Operation timed out'));
      setState('error');
      onStateChange?.('error', 'loading');
      onError?.(new Error('Operation timed out'));
    }
  }, [state, onStateChange, onError]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (dotsIntervalRef.current) clearInterval(dotsIntervalRef.current);
    };
  }, []);

  // Get current text content
  const getTextContent = useCallback(() => {
    switch (state) {
      case 'loading':
        return `${loadingText}${showLoadingDots ? loadingDots : ''}`;
      case 'success':
        return successText;
      case 'error':
        return errorText;
      case 'paused':
        return pausedText;
      case 'retrying':
        return retryText;
      default:
        return children || initialText;
    }
  }, [state, loadingText, successText, errorText, pausedText, retryText, initialText, children, showLoadingDots, loadingDots]);

  // Get current icon
  const getCurrentIcon = useCallback(() => {
    const icon = currentIcons[state];
    return icon || defaultIcons[state];
  }, [state, currentIcons]);

  // Get button classes
  const getButtonClasses = useCallback(() => {
    const baseClasses = [
      "relative inline-flex items-center justify-center gap-2 font-medium transition-all duration-300",
      "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      "overflow-hidden",
    ];
    
    // Size classes
    const sizeClasses = {
      sm: "px-3 py-1.5 text-sm rounded-md min-h-[32px]",
      md: "px-4 py-2 text-sm rounded-md min-h-[40px]",
      lg: "px-6 py-3 text-base rounded-lg min-h-[48px]",
      xl: "px-8 py-4 text-lg rounded-lg min-h-[56px]"
    };
    
    // Variant classes (base, hover, focus)
    const variantClasses: Record<string, { base: string; hover: string; focus: string }> = {
      primary: {
        base: "bg-primary text-primary-foreground",
        hover: "hover:bg-primary/90",
        focus: "focus:ring-primary/50"
      },
      secondary: {
        base: "bg-secondary text-secondary-foreground",
        hover: "hover:bg-secondary/80",
        focus: "focus:ring-secondary/50"
      },
      success: {
        base: "bg-green-600 text-white",
        hover: "hover:bg-green-700",
        focus: "focus:ring-green-500/50"
      },
      danger: {
        base: "bg-red-600 text-white",
        hover: "hover:bg-red-700",
        focus: "focus:ring-red-500/50"
      },
      warning: {
        base: "bg-yellow-600 text-white",
        hover: "hover:bg-yellow-700",
        focus: "focus:ring-yellow-500/50"
      },
      outline: {
        base: "border border-input bg-background",
        hover: "hover:bg-accent hover:text-accent-foreground",
        focus: "focus:ring-accent/50"
      },
      ghost: {
        base: "hover:bg-accent hover:text-accent-foreground",
        hover: "hover:bg-accent/80",
        focus: "focus:ring-accent/50"
      }
    };
    
    const currentVariant = variantClasses[variant] || variantClasses.primary;
    
    return cn(
      ...baseClasses,
      sizeClasses[size],
      currentVariant.base,
      currentVariant.hover,
      currentVariant.focus,
      // State-specific classes
      state === 'loading' && "cursor-wait",
      state === 'success' && "shadow-lg",
      state === 'error' && "animate-pulse",
      microInteractions.hover && "hover:scale-[1.02]",
      microInteractions.tap && "active:scale-[0.98]",
      className
    );
  }, [size, variant, state, microInteractions, className]);

  // Animation key for AnimatePresence
  const animationKey = `${state}-${getTextContent()}`;

  // Background animation variants
  const getBackgroundAnimation = useCallback(() => {
    if (useReducedMotionPref) return {};
    
    const animations = {
      idle: { 
        background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.8) 100%)",
        scale: 1,
        borderRadius: "8px"
      },
      loading: { 
        background: "linear-gradient(135deg, hsl(var(--primary)/0.8) 0%, hsl(var(--primary)/0.6) 100%)",
        scale: 1.02,
        borderRadius: "8px"
      },
      success: { 
        background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
        scale: [1, 1.05, 1.02],
        borderRadius: "8px"
      },
      error: { 
        background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
        scale: [1, 0.98, 1.02, 0.99],
        borderRadius: "8px"
      },
      paused: { 
        background: "linear-gradient(135deg, hsl(var(--muted-foreground)) 0%, hsl(var(--muted)/0.8) 100%)",
        scale: 1,
        borderRadius: "8px"
      },
      retrying: { 
        background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        scale: [1, 1.03, 1],
        borderRadius: "8px"
      }
    };
    
    return animations[state];
  }, [state, useReducedMotionPref]);

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={handleClick}
      disabled={disabled || state === 'loading'}
      className={getButtonClasses()}
      aria-live={state === 'loading' ? 'polite' : 'off'}
      aria-busy={state === 'loading'}
      aria-describedby={state === 'error' && error ? 'error-message' : undefined}
      data-state={state}
      data-variant={variant}
      data-size={size}
      onMouseEnter={() => {
        if (microInteractions.hover && !useReducedMotionPref && buttonRef.current) {
          buttonRef.current.style.transform = 'scale(1.02)';
        }
      }}
      onMouseLeave={() => {
        if (microInteractions.hover && !useReducedMotionPref && buttonRef.current) {
          buttonRef.current.style.transform = 'scale(1)';
        }
      }}
      onMouseDown={() => {
        if (microInteractions.tap && !useReducedMotionPref && buttonRef.current) {
          buttonRef.current.style.transform = 'scale(0.98)';
        }
      }}
      onMouseUp={() => {
        if (microInteractions.tap && !useReducedMotionPref && buttonRef.current) {
          buttonRef.current.style.transform = 'scale(1.02)';
        }
      }}
      animate={getBackgroundAnimation()}
      transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
    >
      {/* Progress indicator */}
      {showProgress && state === 'loading' && progress > 0 && (
        <motion.div
          className="absolute bottom-0 left-0 h-1 bg-white/30 rounded-b-md overflow-hidden"
          style={{ width: "100%" }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="h-full bg-white/60"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </motion.div>
      )}
      
      {/* Main content area */}
      <div className="relative flex items-center gap-2">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={animationKey}
            className="flex items-center gap-2"
            initial={useReducedMotionPref ? {} : { opacity: 0, y: 20, scale: 0.8 }}
            animate={useReducedMotionPref ? {} : { opacity: 1, y: 0, scale: 1 }}
            exit={useReducedMotionPref ? {} : { opacity: 0, y: -20, scale: 0.8 }}
            transition={useReducedMotionPref ? {} : { duration: 0.25 }}
            layout
          >
            <motion.div
              className="flex-shrink-0"
              animate={useReducedMotionPref ? {} : {
                scale: state === 'loading' ? [1, 1.1, 1] : 
                       state === 'success' ? [0, 1.2, 1] : 
                       state === 'error' ? [1, 1.3, 1] : 1,
                rotate: state === 'loading' ? 360 : 0
              }}
              transition={useReducedMotionPref ? {} : { duration: 0.2 }}
            >
              {getCurrentIcon()}
            </motion.div>
            <span className="whitespace-nowrap">{getTextContent()}</span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Control buttons for pause/resume/retry */}
      {state === 'loading' && (enablePause || enableRetry) && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
          {enablePause && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePause();
              }}
              className="p-1 rounded-md hover:bg-black/20 transition-colors"
              aria-label="Pause operation"
            >
              {currentIcons.pause}
            </button>
          )}
        </div>
      )}

      {state === 'paused' && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
          {enablePause && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleResume();
              }}
              className="p-1 rounded-md hover:bg-black/20 transition-colors"
              aria-label="Resume operation"
            >
              {currentIcons.resume}
            </button>
          )}
        </div>
      )}

      {state === 'error' && enableRetry && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRetry();
            }}
            className="p-1 rounded-md hover:bg-black/20 transition-colors"
            aria-label="Retry operation"
          >
            {currentIcons.retry}
          </button>
        </div>
      )}

      {/* Accessibility announcements */}
      <span className="sr-only" role="status" aria-live="polite">
        {state === 'loading' && `Loading: ${loadingText}`}
        {state === 'success' && `Success: ${successText}`}
        {state === 'error' && `Error: ${errorText}`}
        {state === 'paused' && `Paused: ${pausedText}`}
        {state === 'retrying' && `Retrying: ${retryText}`}
      </span>

      {/* Error details for screen readers */}
      {state === 'error' && error && (
        <div
          id="error-message"
          className="sr-only"
          role="alert"
        >
          {error.message}
        </div>
      )}
    </motion.button>
  );
});

AdvancedAsyncButton.displayName = "AdvancedAsyncButton";

// Pre-configured variants for common use cases
export const AdvancedLoginButton = forwardRef<HTMLButtonElement, 
  Omit<AdvancedAsyncButtonProps, 'initialText' | 'loadingText' | 'successText' | 'errorText'>
>(({ children, ...props }, ref) => {
  return (
    <AdvancedAsyncButton
      ref={ref}
      initialText="Sign in"
      loadingText="Authenticating"
      successText="Welcome back!"
      errorText="Authentication failed"
      successDuration={3000}
      timeoutDuration={15000}
      variant="primary"
      showProgress={true}
      preset="default"
      {...props}
    >
      {children}
    </AdvancedAsyncButton>
  );
});

export const AdvancedSaveButton = forwardRef<HTMLButtonElement, 
  Omit<AdvancedAsyncButtonProps, 'initialText' | 'loadingText' | 'successText' | 'errorText'>
>(({ children, ...props }, ref) => {
  return (
    <AdvancedAsyncButton
      ref={ref}
      initialText="Save changes"
      loadingText="Saving"
      successText="Saved successfully!"
      errorText="Save failed"
      successDuration={2000}
      timeoutDuration={10000}
      variant="success"
      showProgress={true}
      preset="subtle"
      {...props}
    >
      {children}
    </AdvancedAsyncButton>
  );
});

export const AdvancedDeleteButton = forwardRef<HTMLButtonElement, 
  Omit<AdvancedAsyncButtonProps, 'initialText' | 'loadingText' | 'successText' | 'errorText'>
>(({ children, ...props }, ref) => {
  return (
    <AdvancedAsyncButton
      ref={ref}
      initialText="Delete"
      loadingText="Deleting"
      successText="Deleted successfully!"
      errorText="Delete failed"
      successDuration={2000}
      timeoutDuration={10000}
      variant="danger"
      showProgress={true}
      enableRetry={true}
      preset="dramatic"
      {...props}
    >
      {children}
    </AdvancedAsyncButton>
  );
});

export const AdvancedSubmitButton = forwardRef<HTMLButtonElement, 
  Omit<AdvancedAsyncButtonProps, 'initialText' | 'loadingText' | 'successText' | 'errorText'>
>(({ children, ...props }, ref) => {
  return (
    <AdvancedAsyncButton
      ref={ref}
      initialText="Submit"
      loadingText="Submitting"
      successText="Submitted successfully!"
      errorText="Submission failed"
      successDuration={2500}
      timeoutDuration={30000}
      variant="primary"
      showProgress={true}
      preset="default"
      {...props}
    >
      {children}
    </AdvancedAsyncButton>
  );
});

AdvancedLoginButton.displayName = "AdvancedLoginButton";
AdvancedSaveButton.displayName = "AdvancedSaveButton";
AdvancedDeleteButton.displayName = "AdvancedDeleteButton";
AdvancedSubmitButton.displayName = "AdvancedSubmitButton";