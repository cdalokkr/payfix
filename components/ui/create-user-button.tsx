"use client";

import React from 'react';
import { Loader2, CheckCircle, AlertCircle, UserPlus, Edit, Save, Trash2, Key, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AsyncState = 'idle' | 'loading' | 'success' | 'error';

export type ButtonMode = 'create' | 'edit' | 'delete' | 'reset' | 'search';

// Size configurations matching the ActionButton component
const sizeConfigs = {
  sm: {
    button: 'h-8 text-xs px-3',
    icon: 'w-3 h-3'
  },
  md: {
    button: 'h-9 text-sm px-4',
    icon: 'w-4 h-4'
  },
  lg: {
    button: 'h-10 text-sm px-6',
    icon: 'w-5 h-5'
  }
};

export type AsyncVariant = 'primary' | 'secondary' | 'danger';

interface CreateUserButtonProps extends Omit<React.ComponentProps<'button'>, 'onClick'> {
  /** The async operation to perform when clicked */
  onClick?: () => Promise<void> | void;
  /** Loading text to display */
  loadingText?: string;
  /** Success text to display */
  successText?: string;
  /** Error text to display */
  errorText?: string;
  /** Current async state */
  asyncState?: AsyncState;
  /** Button content when idle */
  children?: React.ReactNode;
  /** Button size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Button mode: create, edit, delete, reset, search */
  mode?: ButtonMode;
  /** Button visual variant mode: primary, secondary, danger */
  variant?: AsyncVariant;
  /** Optional custom icon component to override the default idle icon */
  icon?: React.ComponentType<{ className?: string }>;
}

export default function CreateUserButton({
  onClick,
  loadingText,
  successText,
  errorText,
  asyncState = 'idle',
  disabled,
  children,
  className,
  size = 'lg',
  mode = 'create',
  variant,
  icon: CustomIcon,
  ...props
}: CreateUserButtonProps) {
  const handleClick = async () => {
    if (asyncState === 'loading' || asyncState === 'success' || !onClick) return;
    await onClick();
  };

  const sizeConfig = sizeConfigs[size];
  const effectiveVariant = variant || (mode === 'delete' ? 'danger' : mode === 'edit' ? 'secondary' : 'primary');

  // Default texts and styling based on effectiveVariant and mode
  const defaultTexts = effectiveVariant === 'secondary' ? {
    loadingText: "Updating...",
    successText: "Update Successful!!",
    errorText: "Error (x) Updation failed",
    idleText: children || "Save Changes",
    idleIcon: Save,
    idleBgClass: "bg-[#7C007C]/10 dark:bg-[#7C007C]/20 text-[#7C007C] dark:text-[#F080F0] border border-[#7C007C]/30 hover:bg-[#7C007C] hover:text-white transition-colors duration-200 cursor-pointer font-semibold",
    successBgClass: "bg-[#02A88E] dark:bg-[#0BDBB9] text-white dark:text-[#0A1118] cursor-not-allowed opacity-90 animate-pulse shadow-md font-semibold",
    errorBgClass: "bg-red-600 hover:bg-red-700 text-white font-semibold",
    loadingBgClass: "bg-[#7C007C] text-white cursor-wait font-semibold"
  } : effectiveVariant === 'danger' ? {
    loadingText: "Deleting...",
    successText: "Deletion Successful!!",
    errorText: "Error (x) Deletion failed",
    idleText: children || "Delete",
    idleIcon: Trash2,
    idleBgClass: "bg-orange-600 hover:bg-red-700 text-white shadow-xs hover:shadow-md transition-colors duration-200 cursor-pointer font-semibold",
    successBgClass: "bg-rose-500 dark:bg-rose-600 text-white cursor-not-allowed opacity-90 animate-pulse shadow-md font-semibold",
    errorBgClass: "bg-red-600 hover:bg-red-700 text-white font-semibold",
    loadingBgClass: "bg-red-700 text-white cursor-wait font-semibold"
  } : {
    // Primary Variant (Matching Login Page Sign In Button: Solid Indigo #635BFF -> hover #5249ea)
    loadingText: mode === 'reset' ? "Resetting..." : mode === 'search' ? "Searching..." : "Creating...",
    successText: mode === 'reset' ? "Password Reset !!" : mode === 'search' ? "Record Found !!" : "Creation Successful!!",
    errorText: "Error (x) Operation failed",
    idleText: children || (mode === 'reset' ? "Reset Password" : mode === 'search' ? "Search" : "Create"),
    idleIcon: mode === 'reset' ? Key : mode === 'search' ? Search : UserPlus,
    idleBgClass: "bg-[#635BFF] hover:bg-[#5249ea] text-white shadow-xs hover:shadow-md transition-colors duration-200 cursor-pointer font-semibold",
    successBgClass: "bg-[#02A88E] dark:bg-[#0BDBB9] text-white dark:text-[#0A1118] cursor-not-allowed opacity-90 animate-pulse shadow-md font-semibold",
    errorBgClass: "bg-red-600 hover:bg-red-700 text-white font-semibold",
    loadingBgClass: "bg-[#635BFF] text-white cursor-wait font-semibold"
  };

  const getButtonContent = () => {
    switch (asyncState) {
      case 'loading':
        return {
          text: loadingText || defaultTexts.loadingText,
          icon: <Loader2 className={cn(sizeConfig.icon, "animate-spin mr-2")} />,
          className: defaultTexts.loadingBgClass
        };
      case 'success':
        // For delete mode, show error icon with success text
        if (mode === 'delete') {
          return {
            text: successText || defaultTexts.successText,
            icon: <X className={cn(sizeConfig.icon, "mr-2")} />,
            className: defaultTexts.successBgClass
          };
        }
        return {
          text: successText || defaultTexts.successText,
          icon: <CheckCircle className={cn(sizeConfig.icon, "mr-2")} />,
          className: defaultTexts.successBgClass
        };
      case 'error':
        // If errorText is specifically provided as a prop, use it as priority
        return {
          text: errorText || defaultTexts.errorText,
          icon: <AlertCircle className={cn(sizeConfig.icon, "mr-2")} />,
          className: defaultTexts.errorBgClass
        };
      default: {
        const IdleIcon = CustomIcon || defaultTexts.idleIcon;
        return {
          text: defaultTexts.idleText,
          icon: <IdleIcon className={cn(sizeConfig.icon, "mr-2")} />,
          className: defaultTexts.idleBgClass
        };
      }
    }
  };

  const isDisabled = disabled || asyncState === 'loading' || asyncState === 'success';
  const buttonContent = getButtonContent();

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={cn(
        "inline-flex items-center justify-center font-medium text-white transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-xs disabled:opacity-80 disabled:cursor-not-allowed shrink-0 cursor-pointer",
        "rounded-xl",
        sizeConfig.button,
        buttonContent.className,
        className
      )}
      {...props}
    >
      {buttonContent.icon}
      {buttonContent.text && <span className="whitespace-nowrap">{buttonContent.text}</span>}
    </button>
  );
}