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
  /** Button mode: create or edit */
  mode?: ButtonMode;
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
  icon: CustomIcon,
  ...props
}: CreateUserButtonProps) {
  const handleClick = async () => {
    if (asyncState === 'loading' || asyncState === 'success' || !onClick) return;
    await onClick();
  };

  const sizeConfig = sizeConfigs[size];

  // Default texts and styling based on mode
  const defaultTexts = mode === 'create' ? {
    loadingText: "Creating user ...",
    successText: "User Created !! Successfull",
    errorText: "Error (x) User Creation failed",
    idleText: children || "Create User",
    idleIcon: UserPlus,
    idleBgClass: "bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-blue-500/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]",
    successBgClass: "bg-green-600 cursor-not-allowed opacity-90 animate-pulse",
    errorBgClass: "bg-red-600 hover:bg-red-700",
    loadingBgClass: "bg-gray-600 cursor-wait"
  } : mode === 'delete' ? {
    loadingText: "Deleting...",
    successText: "User Deleted!!",
    errorText: "Error (x) Deletion failed",
    idleText: children || "Delete User",
    idleIcon: Trash2,
    idleBgClass: "bg-destructive hover:bg-destructive/90",
    successBgClass: "bg-red-600 cursor-not-allowed opacity-90 animate-pulse",
    errorBgClass: "bg-red-600 hover:bg-red-700",
    loadingBgClass: "bg-gray-600 cursor-wait"
  } : mode === 'reset' ? {
    loadingText: "Resetting...",
    successText: "Password Reset !!",
    errorText: "Error (x) Reset failed",
    idleText: children || "Reset Password",
    idleIcon: Key,
    idleBgClass: "bg-amber-600 hover:bg-amber-700 shadow-lg hover:shadow-amber-500/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]",
    successBgClass: "bg-green-600 cursor-not-allowed opacity-90 animate-pulse",
    errorBgClass: "bg-red-600 hover:bg-red-700",
    loadingBgClass: "bg-gray-600 cursor-wait"
  } : mode === 'search' ? {
    loadingText: "Searching...",
    successText: "Record Found !!",
    errorText: "No Record Found",
    idleText: children || "Search",
    idleIcon: Search,
    idleBgClass: "bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-blue-500/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]",
    successBgClass: "bg-green-600 cursor-not-allowed opacity-90 animate-pulse",
    errorBgClass: "bg-red-600 cursor-not-allowed opacity-90 animate-pulse",
    loadingBgClass: "bg-gray-600 cursor-wait"
  } : {
    loadingText: "Updating...",
    successText: "Update Successful!!",
    errorText: "Error (x) Updation failed",
    idleText: children || "Update User",
    idleIcon: Save,
    idleBgClass: "bg-purple-600 hover:bg-purple-700 shadow-lg hover:shadow-purple-500/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]",
    successBgClass: "bg-[#02A88E] dark:bg-[#0BDBB9] text-black dark:text-[#0A1118] cursor-not-allowed opacity-90 animate-pulse shadow-md",
    errorBgClass: "bg-red-600 hover:bg-red-700",
    loadingBgClass: "bg-gray-600 cursor-wait"
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
        "inline-flex items-center justify-center font-medium text-white transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm disabled:opacity-80 disabled:cursor-not-allowed",
        "rounded-md w-full",
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