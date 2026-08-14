"use client";

import React from 'react';
import { Loader2, CheckCircle, AlertCircle, UserPlus, Save, Trash2, Key, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AsyncState = 'idle' | 'loading' | 'success' | 'error';

export type ButtonMode = 'create' | 'edit' | 'delete' | 'reset' | 'search';

// Size configurations matching standard dialog buttons
const sizeConfigs = {
  sm: {
    button: 'h-8 text-xs px-3',
    icon: 'w-3.5 h-3.5'
  },
  md: {
    button: 'h-[38px] text-[14px] px-4',
    icon: 'w-4 h-4'
  },
  lg: {
    button: 'h-10 text-[14px] px-6',
    icon: 'w-4.5 h-4.5'
  }
};

export type AsyncVariant = 'primary' | 'secondary' | 'danger';

export interface ModalAsyncButtonProps extends Omit<React.ComponentProps<'button'>, 'onClick'> {
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

export function ModalAsyncButton({
  onClick,
  loadingText,
  successText,
  errorText,
  asyncState = 'idle',
  disabled,
  children,
  className,
  size = 'md',
  mode = 'create',
  variant,
  icon: CustomIcon,
  ...props
}: ModalAsyncButtonProps) {
  const handleClick = async () => {
    if (asyncState === 'loading' || asyncState === 'success' || !onClick) return;
    await onClick();
  };

  const sizeConfig = sizeConfigs[size];
  const effectiveVariant = variant || (mode === 'delete' ? 'danger' : mode === 'edit' ? 'secondary' : 'primary');

  // Exact 3-Mode styling rules per platform design spec
  const defaultTexts = effectiveVariant === 'secondary' ? {
    // Secondary Mode: Edit / Update existing record (Purple -> Darker Purple hover -> Green success)
    loadingText: "Saving Changes...",
    successText: "Update Successful!!",
    errorText: "Error (x) Updation failed",
    idleText: children || "Save Changes",
    idleIcon: Save,
    idleBgClass: "bg-[#7C007C] hover:bg-[#600060] text-white shadow-xs hover:shadow-md transition-colors duration-200 cursor-pointer font-semibold",
    loadingBgClass: "bg-[#6D7684] text-white cursor-wait font-semibold",
    successBgClass: "bg-[#18AE50] text-white cursor-not-allowed opacity-95 animate-pulse shadow-md font-semibold",
    errorBgClass: "bg-red-600 hover:bg-red-700 text-white font-semibold"
  } : effectiveVariant === 'danger' ? {
    // Danger Mode: Delete / Destructive operations (Red-Orange -> Darker Red-Orange hover -> Green/Rose success with X)
    loadingText: "Deleting...",
    successText: "Deletion Successful!!",
    errorText: "Error (x) Deletion failed",
    idleText: children || "Delete",
    idleIcon: Trash2,
    idleBgClass: "bg-[#EA580C] hover:bg-[#C2410C] text-white shadow-xs hover:shadow-md transition-colors duration-200 cursor-pointer font-semibold",
    loadingBgClass: "bg-[#6D7684] text-white cursor-wait font-semibold",
    successBgClass: "bg-[#18AE50] text-white cursor-not-allowed opacity-95 animate-pulse shadow-md font-semibold",
    errorBgClass: "bg-red-700 hover:bg-red-800 text-white font-semibold"
  } : {
    // Primary Mode: Insert / Create new record (Indigo #635BFF -> #5249ea hover -> Green #18AE50 success)
    loadingText: mode === 'reset' ? "Resetting..." : mode === 'search' ? "Searching..." : "Creating...",
    successText: mode === 'reset' ? "Password Reset !!" : mode === 'search' ? "Record Found !!" : "Creation Successful!!",
    errorText: "Error (x) Operation failed",
    idleText: children || (mode === 'reset' ? "Reset Password" : mode === 'search' ? "Search" : "Create"),
    idleIcon: mode === 'reset' ? Key : mode === 'search' ? Search : UserPlus,
    idleBgClass: "bg-[#635BFF] hover:bg-[#5249ea] text-white shadow-xs hover:shadow-md transition-colors duration-200 cursor-pointer font-semibold",
    loadingBgClass: "bg-[#6D7684] text-white cursor-wait font-semibold",
    successBgClass: "bg-[#18AE50] text-white cursor-not-allowed opacity-95 animate-pulse shadow-md font-semibold",
    errorBgClass: "bg-red-600 hover:bg-red-700 text-white font-semibold"
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
        // For delete / danger mode, show cross icon with success text
        if (effectiveVariant === 'danger' || mode === 'delete') {
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
        "inline-flex items-center justify-center font-medium text-white transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-xs disabled:opacity-80 disabled:cursor-not-allowed shrink-0 cursor-pointer rounded-[12px]",
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

// Re-export alias for 100% backward compatibility
export const CreateUserButton = ModalAsyncButton;
export default ModalAsyncButton;