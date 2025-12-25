"use client";

import { useState, useRef, useLayoutEffect, useMemo, useEffect } from "react";
import { motion, AnimatePresence, HTMLMotionProps } from "framer-motion";
import { CheckCircle, AlertCircle, UserPlus, Save, LogIn, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AnimatedCheckCircle } from "@/components/ui/animated-check-circle";
import { AnimatedAlertCircle } from "@/components/ui/animated-alert-circle";

// Modern spinner with smooth acceleration and clean design
const ModernSpinner = ({ className }: { className?: string }) => (
  <motion.div
    className={cn("relative", className)}
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.8 }}
    transition={{ duration: 0.2 }}
  >
    <motion.div
      className="w-full h-full border-2 border-current border-t-transparent rounded-full opacity-20"
    />
    <motion.div
      className="absolute inset-0 w-full h-full border-2 border-current border-t-transparent rounded-full"
      animate={{ rotate: 360 }}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        ease: "linear"
      }}
    />
  </motion.div>
);

export type AsyncState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncButtonProps extends HTMLMotionProps<"button"> {
  /** The async operation to perform when clicked */
  onClick?: () => Promise<void> | void;
  /** Loading text to display */
  loadingText?: string;
  /** Success text to display on button */
  successText?: string;
  /** Error text to display on button */
  errorText?: string;
  /** Success text to display in toast (overrides successText for toast only) */
  toastSuccessText?: string;
  /** Error text to display in toast (overrides errorText for toast only) */
  toastErrorText?: string;
  /** Whether form has errors that should prevent success state */
  hasFormErrors?: boolean;
  /** Duration to show states before resetting (ms) - new API */
  duration?: number;
  /** Duration to show success state before resetting (ms) - backward compatibility */
  successDuration?: number;
  /** Duration to show error state before resetting (ms) - backward compatibility */
  errorDuration?: number;
  /** Whether to reset to idle state automatically */
  autoReset?: boolean;
  /** Custom icons for different states */
  icons?: {
    idle?: React.ReactNode;
    loading?: React.ReactNode;
    success?: React.ReactNode;
    error?: React.ReactNode;
  };
  /** Callback when state changes */
  onStateChange?: (state: AsyncState) => void;
  /** Button content when idle */
  children?: React.ReactNode;
  /** Button variant - modern system with backward compatibility */
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  /** Button size */
  size?: 'sm' | 'md' | 'lg' | 'default' | 'icon';
  /** Whether to use adaptive width calculation to prevent visual shifting */
  customWidth?: boolean;
  /** Whether to show toast notifications on success/error */
  showToast?: boolean;
  /** Controlled state from parent */
  state?: AsyncState;
  /** Toast position strategy */
  toastPosition?: 'global' | 'button-top';
}

export default function AsyncButton({
  onClick,
  loadingText = 'Loading...',
  successText = 'Success!',
  errorText = 'Error occurred',
  toastSuccessText,
  toastErrorText,
  hasFormErrors = false,
  duration = 2000,
  successDuration,
  errorDuration,
  autoReset = true,
  icons = {},
  onStateChange,
  className,
  variant = 'primary',
  size = 'md',
  disabled,
  children,
  customWidth = false,
  showToast = false,
  state: controlledState,
  toastPosition = 'global',
  ...props
}: AsyncButtonProps) {
  const [internalState, setInternalState] = useState<AsyncState>('idle');
  const state = controlledState !== undefined ? controlledState : internalState;
  const setState = (s: AsyncState) => {
    if (controlledState === undefined) setInternalState(s);
    onStateChange?.(s);
  };

  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);
  const [localToast, setLocalToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Memoize text set for measurement (modern optimization)
  const allTexts = useMemo(
    () => [children?.toString() || 'Button', loadingText, successText, errorText],
    [children, loadingText, successText, errorText]
  );

  // Pre-measure max width before first paint (only when customWidth is true)
  useLayoutEffect(() => {
    if (!customWidth) {
      setContainerWidth(undefined);
      return;
    }

    const temp = document.createElement("span");
    temp.style.visibility = "hidden";
    temp.style.position = "absolute";
    temp.style.whiteSpace = "nowrap";
    temp.style.font = getComputedStyle(document.body).font;
    temp.className = "inline-flex items-center justify-center font-medium text-sm"; // approximate style

    document.body.appendChild(temp);

    let maxWidth = 0;
    for (const text of allTexts) {
      temp.textContent = text;
      maxWidth = Math.max(maxWidth, temp.offsetWidth);
    }

    document.body.removeChild(temp);
    setContainerWidth(maxWidth + 48); // padding buffer for icons
  }, [allTexts, customWidth]);



  // ... existing imports

  // ... inside AsyncButton component
  const defaultIcons = {
    loading: <ModernSpinner className="w-4 h-4" />,
    success: <AnimatedCheckCircle className="w-4 h-4" />,
    error: <AnimatedAlertCircle className="w-4 h-4" />,
  };

  const currentIcons = {
    idle: <LogIn className="w-4 h-4" />,
    ...defaultIcons,
    ...icons
  };

  useEffect(() => {
    onStateChange?.(state);

    // Announce state change to screen readers for accessibility
    if (state === 'success' || state === 'error') {
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.style.position = 'absolute';
      announcement.style.left = '-10000px';
      announcement.style.width = '1px';
      announcement.style.height = '1px';
      announcement.style.overflow = 'hidden';
      announcement.textContent = state === 'success' ? 'Operation completed successfully' : 'Operation failed';
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);
    }
  }, [state, onStateChange]);

  const handleToast = (message: string, type: 'success' | 'error') => {
    if (!showToast) return;

    if (toastPosition === 'global') {
      if (type === 'success') toast.success(message);
      else toast.error(message);
    } else {
      setLocalToast({ message, type });
      // Auto dismiss local toast
      setTimeout(() => setLocalToast(null), 3000);
    }
  };

  const handleClick = async () => {
    if (state === 'loading' || state === 'success' || !onClick) return;

    setState('loading');
    setLocalToast(null);

    try {
      await onClick();

      // If there are form errors, show error state instead of success
      if (hasFormErrors) {
        setState('error');
        handleToast(toastErrorText || errorText, 'error');

        // Reset to idle state using the appropriate duration
        const errorDur = errorDuration || duration;
        if (autoReset) {
          setTimeout(() => setState('idle'), errorDur);
        }
      } else {
        setState('success');
        handleToast(toastSuccessText || successText, 'success');

        // Success state persists - no auto-reset to allow for redirection
        // Users can click again once the state naturally clears (e.g., after redirection)
        const successDur = successDuration || duration;
        if (autoReset) {
          // setTimeout(() => setInternalState('idle'), successDur); // Commented out to prevent reset on success
        }
      }
    } catch (error) {
      setState('error');

      // If the error is an object with a message, use it. Otherwise use default errorText
      const message = error instanceof Error ? error.message : errorText;
      handleToast(toastErrorText || message, 'error');

      // Reset to idle state using the appropriate duration
      const errorDur = errorDuration || duration;
      if (autoReset) {
        setTimeout(() => setState('idle'), errorDur);
      }
    }
  };

  // 🎨 Enhanced color system supporting both new and old variants
  const variantColorMap = {
    primary: { base: "bg-blue-600", hover: "hover:bg-blue-700" },
    secondary: { base: "bg-gray-600", hover: "hover:bg-gray-700" },
    success: { base: "bg-green-600", hover: "hover:bg-green-700" },
    danger: { base: "bg-red-600", hover: "hover:bg-red-700" },
    // Legacy variants
    default: { base: "bg-blue-600", hover: "hover:bg-blue-700" },
    destructive: { base: "bg-red-600", hover: "hover:bg-red-700" },
    outline: { base: "border-2 border-gray-300 bg-transparent", hover: "hover:bg-gray-100" },
    ghost: { base: "bg-transparent", hover: "hover:bg-gray-100" },
    link: { base: "bg-transparent underline-offset-4", hover: "hover:underline hover:bg-gray-100" },
  } as const;

  const { base, hover } = variantColorMap[variant as keyof typeof variantColorMap] || variantColorMap.primary;

  const colorMap: Record<AsyncState, string> = {
    idle: `${base} ${hover}`,
    loading: "!bg-gray-600 !hover:bg-gray-700 !cursor-wait !bg-none",
    success: "!bg-green-600 !bg-none !cursor-wait !text-white !opacity-100 animate-pulse",
    error: "!bg-red-600 !hover:bg-red-700 !animate-pulse !bg-none",
  };

  // 📏 Size map with backward compatibility
  const sizeMap = {
    sm: "px-3 py-1.5 text-xs gap-1 rounded-md",
    md: "px-4 py-2 text-sm gap-2 rounded-md",
    lg: "px-6 py-3 text-base gap-3 rounded-md",
    default: "px-4 py-2 text-sm gap-2 rounded-md",
    icon: "h-10 w-10 gap-0 rounded-md",
  };

  const renderIcon = () => {
    if (state === 'idle' && currentIcons.idle) return currentIcons.idle;
    if (state === 'loading' && currentIcons.loading) return currentIcons.loading;
    if (state === 'success' && currentIcons.success) return currentIcons.success;
    if (state === 'error' && currentIcons.error) return currentIcons.error;
    return null;
  };

  const renderText = () => {
    switch (state) {
      case 'loading':
        return loadingText;
      case 'success':
        return successText;
      case 'error':
        return errorText;
      default:
        return children;
    }
  };

  // Separate width classes from className to prevent initial flash
  const getWidthClasses = () => {
    if (customWidth) {
      return ""; // No width classes when using custom width
    }
    return "w-full"; // Use full width when customWidth is false
  };

  // Filter out width-related classes from className to prevent conflicts
  const filteredClassName = useMemo(() => {
    if (!className) return "";
    return className
      .split(' ')
      .filter(cls => !cls.startsWith('w-') && !cls.includes('width'))
      .join(' ');
  }, [className]);

  const buttonContent = (
    <motion.button
      ref={buttonRef}
      {...props}
      type={props.type || "button"}
      onClick={handleClick}
      disabled={state === 'loading' || state === 'success' || disabled}
      animate={{
        scale: state === 'error' ? 0.96 : 1,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cn(
        "inline-flex items-center justify-center font-medium text-white transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm disabled:opacity-80 disabled:cursor-not-allowed",
        "text-white dark:text-gray-100",
        sizeMap[size],
        (!customWidth && toastPosition !== 'button-top') ? getWidthClasses() : "w-full",
        filteredClassName,
        state !== 'idle' && colorMap[state], // Apply state colors LAST to override filteredClassName
        state === 'idle' && colorMap.idle
      )}
      aria-live={state === 'loading' ? 'polite' : 'off'}
      aria-busy={state === 'loading'}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          className="flex items-center"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.18 }}
        >
          {renderIcon()}
          <span className="ml-2 whitespace-nowrap">{renderText()}</span>
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );

  // Render with wrapper if needed (customWidth OR button-top toast)
  if (customWidth || toastPosition === 'button-top') {
    return (
      <div
        ref={containerRef}
        style={customWidth ? { width: containerWidth } : undefined}
        className={cn(
          "relative inline-block",
          // If not custom width, pass the width classes to the container
          !customWidth && getWidthClasses()
        )}
      >
        <AnimatePresence>
          {localToast && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50",
                "flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg border",
                "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800",
                "text-sm font-medium whitespace-nowrap",
                localToast.type === 'error' ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
              )}
            >
              {localToast.type === 'error' ? (
                <AlertCircle className="w-4 h-4" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              {localToast.message}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-gray-900 border-b border-r border-gray-200 dark:border-gray-800 rotate-45" />
            </motion.div>
          )}
        </AnimatePresence>
        {buttonContent}
      </div>
    );
  }

  return buttonContent;
}

export function LoginButton({
  successDuration = 4000,
  loadingText: customLoadingText,
  successText: customSuccessText,
  errorText: customErrorText,
  toastSuccessText: customToastSuccessText,
  toastErrorText: customToastErrorText,
  hasFormErrors,
  showToast = false,
  toastPosition = 'button-top',
  ...props
}: AsyncButtonProps & {
  hasFormErrors?: boolean;
  loadingText?: string;
  successText?: string;
  errorText?: string;
  toastSuccessText?: string;
  toastErrorText?: string;
  showToast?: boolean;
  toastPosition?: 'global' | 'button-top';
}) {
  // Use custom texts if provided, otherwise use defaults
  const loadingText = customLoadingText || "Authenticating..."
  const successText = customSuccessText || " Redirecting to Dashboard .."
  const errorText = customErrorText || (hasFormErrors ? "Please fix form errors" : "Login failed! Please try again")

  // Default toast messages as requested
  const toastSuccessText = customToastSuccessText || "Login Successfull !! "
  const toastErrorText = customToastErrorText || " Check Error Message "

  return (
    <AsyncButton
      loadingText={loadingText}
      successText={successText}
      errorText={errorText}
      toastSuccessText={toastSuccessText}
      toastErrorText={toastErrorText}
      successDuration={successDuration}
      showToast={showToast}
      toastPosition={toastPosition}
      {...props}
    />
  );
}

export function SaveButton({ successDuration = 2000, variant = 'success', ...props }: Omit<AsyncButtonProps, 'loadingText' | 'successText'>) {
  return (
    <AsyncButton
      loadingText="Saving..."
      successText="Saved !!"
      successDuration={successDuration}
      variant={variant}
      {...props}
    />
  );
}

export function DeleteButton({ successDuration = 2000, ...props }: Omit<AsyncButtonProps, 'loadingText' | 'successText' | 'errorText'>) {
  return (
    <AsyncButton
      loadingText="Deleting..."
      successText="Deleted successfully!"
      errorText="Failed to delete"
      successDuration={successDuration}
      {...props}
    />
  );
}

export function SubmitButton({ successDuration = 2000, ...props }: Omit<AsyncButtonProps, 'loadingText' | 'successText'>) {
  return (
    <AsyncButton
      loadingText="Submitting..."
      successText="Submitted successfully!"
      successDuration={successDuration}
      {...props}
    />
  );
}
