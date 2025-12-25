"use client"

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Edit,
  Save,
  X,
  Trash2,
  UserPlus,
  Eye,
  Settings,
  Loader2,
  Users,
  BarChart3,
  Key,
  Lock,
  UserCheck,
  UserX
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Type definitions
export interface ActionButtonProps {
  action: 'edit' | 'save' | 'cancel' | 'delete' | 'add' | 'view' | 'settings' | 'reset' | 'dashboard-blue' | 'dashboard-orange' | 'dashboard-purple' | 'activate' | 'deactivate'
  variant?: 'button' | 'icon-only'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  children?: React.ReactNode
  onClick?: (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void
  href?: string
  className?: string
  'aria-label'?: string
  'data-testid'?: string
}

// Default icons for each action type
const ACTION_ICONS = {
  edit: Edit,
  save: Save,
  cancel: X,
  delete: Trash2,
  add: UserPlus,
  view: Eye,
  settings: Settings,
  'dashboard-blue': Users,
  'dashboard-orange': BarChart3,
  'dashboard-purple': Settings,
  reset: Lock,
  activate: UserCheck,
  deactivate: UserX
}

// Size configurations
const sizeConfigs = {
  sm: {
    button: 'h-8 text-xs px-3',
    icon: 'h-3.5 w-3.5',
    iconOnly: 'h-8 w-8'
  },
  md: {
    button: 'h-9 text-sm px-4',
    icon: 'h-4 w-4',
    iconOnly: 'h-9 w-9'
  },
  lg: {
    button: 'h-10 text-sm px-6',
    icon: 'h-5 w-5',
    iconOnly: 'h-10 w-10'
  }
}

// Theme configurations based on existing patterns
const actionThemes = {
  edit: {
    base: 'bg-white/90 dark:bg-slate-900/90 hover:border-purple-500 text-purple-700 dark:text-purple-400 border-purple-200/60 group/btn backdrop-blur-sm',
    fill: 'bg-purple-500/10 border-purple-500/20',
    icon: 'text-purple-600 dark:text-purple-400 group-hover/btn:text-purple-500',
    shadow: 'hover:shadow-[0_0_15px_-3px_rgba(168,85,247,0.4)]',
    gradient: ''
  },
  save: {
    base: 'bg-white/90 dark:bg-slate-900/90 hover:border-green-500 text-green-700 dark:text-green-400 border-green-200/60 group/btn backdrop-blur-sm',
    fill: 'bg-green-500/10 border-green-500/20',
    icon: 'text-green-600 dark:text-green-400 group-hover/btn:text-green-500',
    shadow: 'hover:shadow-[0_0_15px_-3px_rgba(34,197,94,0.4)]',
    gradient: ''
  },
  cancel: {
    base: 'bg-white/90 dark:bg-slate-900/90 hover:border-red-500 text-red-700 dark:text-red-400 border-red-200/60 group/btn backdrop-blur-sm',
    fill: 'bg-red-500/10 border-red-500/20',
    icon: 'text-red-600 dark:text-red-400 group-hover/btn:text-red-500',
    shadow: 'hover:shadow-[0_0_15px_-3px_rgba(239,68,68,0.4)]',
    gradient: ''
  },
  delete: {
    base: 'bg-white/90 dark:bg-slate-900/90 hover:border-red-500 text-red-700 dark:text-red-400 border-red-200/60 group/btn backdrop-blur-sm',
    fill: 'bg-red-500/10 border-red-500/20',
    icon: 'text-red-600 dark:text-red-400 group-hover/btn:text-red-500',
    shadow: 'hover:shadow-[0_0_15px_-3px_rgba(239,68,68,0.4)]',
    gradient: ''
  },
  add: {
    base: 'bg-white/90 dark:bg-slate-900/90 hover:border-purple-500 text-purple-700 dark:text-purple-400 border-purple-200/60 group/btn backdrop-blur-sm',
    fill: 'bg-purple-500/10 border-purple-500/20',
    icon: 'text-purple-600 dark:text-purple-400 group-hover/btn:text-purple-500',
    shadow: 'hover:shadow-[0_0_15px_-3px_rgba(168,85,247,0.4)]',
    gradient: ''
  },
  view: {
    base: 'bg-white/90 dark:bg-slate-900/90 hover:border-indigo-500 text-indigo-700 dark:text-indigo-400 border-indigo-200/60 group/btn backdrop-blur-sm',
    fill: 'bg-indigo-500/10 border-indigo-500/20',
    icon: 'text-indigo-600 dark:text-indigo-400 group-hover/btn:text-indigo-500',
    shadow: 'hover:shadow-[0_0_15px_-3px_rgba(99,102,241,0.4)]',
    gradient: ''
  },
  settings: {
    base: 'bg-white/90 dark:bg-slate-900/90 hover:border-gray-500 text-gray-700 dark:text-gray-400 border-gray-200/60 group/btn backdrop-blur-sm',
    fill: 'bg-gray-500/10 border-gray-500/20',
    icon: 'text-gray-600 dark:text-gray-400 group-hover/btn:text-gray-500',
    shadow: 'hover:shadow-[0_0_15px_-3px_rgba(107,114,128,0.4)]',
    gradient: ''
  },
  reset: {
    base: 'bg-white/90 dark:bg-slate-900/90 hover:border-amber-500 text-amber-700 dark:text-amber-400 border-amber-200/60 group/btn backdrop-blur-sm',
    fill: 'bg-amber-500/10 border-amber-500/20',
    icon: 'text-amber-600 dark:text-amber-400 group-hover/btn:text-amber-500',
    shadow: 'hover:shadow-[0_0_15px_-3px_rgba(245,158,11,0.4)]',
    gradient: ''
  },
  'dashboard-blue': {
    base: 'bg-white/90 dark:bg-slate-900/90 hover:border-blue-500 text-blue-700 dark:text-blue-400 border-blue-200/60 group/action-button overflow-hidden group/btn backdrop-blur-sm',
    fill: 'bg-blue-500/10 border-blue-500/20',
    icon: 'text-blue-600 dark:text-blue-400 group-hover/btn:text-blue-500',
    shadow: 'hover:shadow-[0_0_20px_-5px_rgba(59,130,246,0.6)]',
    gradient: 'from-blue-400/0 via-blue-400/20 to-blue-400/0'
  },
  'dashboard-orange': {
    base: 'bg-white/90 dark:bg-slate-900/90 hover:border-orange-500 text-orange-700 dark:text-orange-400 border-orange-200/60 group/action-button overflow-hidden group/btn backdrop-blur-sm',
    fill: 'bg-orange-500/10 border-orange-500/20',
    icon: 'text-orange-600 dark:text-orange-400 group-hover/btn:text-orange-500',
    shadow: 'hover:shadow-[0_0_20px_-5px_rgba(249,115,22,0.6)]',
    gradient: 'from-orange-400/0 via-orange-400/20 to-orange-400/0'
  },
  'dashboard-purple': {
    base: 'bg-white/90 dark:bg-slate-900/90 hover:border-purple-500 text-purple-700 dark:text-purple-400 border-purple-200/60 group/action-button overflow-hidden group/btn backdrop-blur-sm',
    fill: 'bg-purple-500/10 border-purple-500/20',
    icon: 'text-purple-600 dark:text-purple-400 group-hover/btn:text-purple-500',
    shadow: 'hover:shadow-[0_0_20px_-5px_rgba(168,85,247,0.6)]',
    gradient: 'from-purple-400/0 via-purple-400/20 to-purple-400/0'
  },
  activate: {
    base: 'bg-white/90 dark:bg-slate-900/90 hover:border-green-500 text-green-700 dark:text-green-400 border-green-200/60 group/btn backdrop-blur-sm',
    fill: 'bg-green-500/10 border-green-500/20',
    icon: 'text-green-600 dark:text-green-400 group-hover/btn:text-green-500',
    shadow: 'hover:shadow-[0_0_15px_-3px_rgba(34,197,94,0.4)]',
    gradient: ''
  },
  deactivate: {
    base: 'bg-white/90 dark:bg-slate-900/90 hover:border-red-500 text-red-700 dark:text-red-400 border-red-200/60 group/btn backdrop-blur-sm',
    fill: 'bg-red-500/10 border-red-500/20',
    icon: 'text-red-600 dark:text-red-400 group-hover/btn:text-red-500',
    shadow: 'hover:shadow-[0_0_15px_-3px_rgba(239,68,68,0.4)]',
    gradient: ''
  }
}

// Create a motion component from the Next.js Link
const MotionLink = motion.create(Link)

/**
 * Comprehensive ActionButton Component
 * 
 * A reusable button component with consistent styling, animations, and accessibility
 * that supports all common action types throughout the application.
 */
export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({
    action,
    variant = 'button',
    size = 'md',
    loading = false,
    disabled = false,
    icon: customIcon,
    children,
    onClick,
    href,
    className,
    'aria-label': ariaLabel,
    'data-testid': testId,
    ...props
  }, ref) => {
    const IconComponent = customIcon || ACTION_ICONS[action]
    const theme = actionThemes[action]
    const sizeConfig = sizeConfigs[size]
    const isDisabled = disabled || loading
    const getAccessibleLabel = () => {
      if (ariaLabel) return ariaLabel
      if (variant === 'icon-only' && !children) {
        const actionLabels = {
          edit: 'Edit',
          save: 'Save',
          cancel: 'Cancel',
          delete: 'Delete',
          add: 'Add',
          view: 'View',
          settings: 'Settings',
          reset: 'Reset Password',
          'dashboard-blue': 'Dashboard Action',
          'dashboard-orange': 'Dashboard Action',
          'dashboard-purple': 'Dashboard Action',
          activate: 'Activate User',
          deactivate: 'Deactivate User'
        }
        return actionLabels[action]
      }
      return undefined
    }

    const ButtonContent = (
      <>
        {/* Background Fade Layer (Glassmorphism) */}
        <span
          className={cn(
            "absolute inset-0 transition-opacity duration-300 opacity-0 group-hover/btn:opacity-100 border rounded-[inherit]",
            theme.fill
          )}
        />

        {/* Gradient Animation for Dashboard Themes */}
        {theme.gradient && (
          <span className={`absolute inset-0 bg-gradient-to-r ${theme.gradient} translate-x-[-100%] group-hover/action-button:translate-x-[100%] transition-transform duration-700 pointer-events-none rounded-[inherit]`} />
        )}

        <motion.div
          className="flex items-center justify-center relative z-10"
        >
          {loading ? (
            <Loader2
              className={cn(
                sizeConfig.icon,
                'animate-spin',
                theme.icon
              )}
            />
          ) : (
            <IconComponent
              className={cn(
                sizeConfig.icon,
                theme.icon,
                children && (variant === 'button' ? 'mr-2' : ''),
                "transition-colors duration-200"
              )}
            />
          )}
        </motion.div>

        {/* Button text */}
        {children && variant === 'button' && (
          <motion.span
            className={cn(
              "relative z-10 transition-colors duration-200"
            )}
            initial={{ opacity: 1 }}
            animate={loading ? { opacity: 0.5 } : { opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {loading ? `${children}...` : children}
          </motion.span>
        )}
      </>
    )

    const buttonClasses = cn(
      // Base button styles
      'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-300',
      'border focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
      'outline-none disabled:pointer-events-none disabled:opacity-50',
      'relative overflow-hidden active:scale-95',

      // Size configurations
      variant === 'icon-only'
        ? sizeConfig.iconOnly
        : sizeConfig.button,

      // Theme application
      theme.base,

      // Hover effects
      !isDisabled && !theme.gradient && theme.shadow,

      // Loading state
      loading && 'cursor-wait',

      // Custom className
      className
    )

    const motionProps = {
      whileHover: !isDisabled ? {
        transition: { duration: 0.2 }
      } : undefined,
      whileTap: !isDisabled ? {
        scale: 0.98,
        transition: { duration: 0.1 }
      } : undefined,
      animate: loading ? {
        scale: 0.98,
        opacity: 0.8,
        transition: { duration: 0.2 }
      } : {}
    }

    if (href && !isDisabled) {
      return (
        <MotionLink
          href={href}
          className={buttonClasses}
          onClick={onClick as React.MouseEventHandler<HTMLAnchorElement>}
          data-testid={testId}
          aria-label={getAccessibleLabel()}
          {...motionProps}
        >
          {ButtonContent}
        </MotionLink>
      )
    }

    return (
      <motion.button
        ref={ref}
        type="button"
        className={buttonClasses}
        disabled={isDisabled}
        onClick={onClick}
        data-testid={testId}
        aria-disabled={isDisabled}
        aria-label={getAccessibleLabel()}
        {...props}
        {...motionProps}
      >
        {ButtonContent}
      </motion.button>
    )
  }
)

ActionButton.displayName = 'ActionButton'

// Export convenience components for each action type
export const EditButton = React.forwardRef<HTMLButtonElement, Omit<ActionButtonProps, 'action'>>(
  (props, ref) => <ActionButton ref={ref} action="edit" {...props} />
)
EditButton.displayName = 'EditButton'

export const SaveButton = React.forwardRef<HTMLButtonElement, Omit<ActionButtonProps, 'action'>>(
  (props, ref) => <ActionButton ref={ref} action="save" {...props} />
)
SaveButton.displayName = 'SaveButton'

export const CancelButton = React.forwardRef<HTMLButtonElement, Omit<ActionButtonProps, 'action'>>(
  (props, ref) => <ActionButton ref={ref} action="cancel" {...props} />
)
CancelButton.displayName = 'CancelButton'

export const DeleteButton = React.forwardRef<HTMLButtonElement, Omit<ActionButtonProps, 'action'>>(
  (props, ref) => <ActionButton ref={ref} action="delete" {...props} />
)
DeleteButton.displayName = 'DeleteButton'

export const AddButton = React.forwardRef<HTMLButtonElement, Omit<ActionButtonProps, 'action'>>(
  (props, ref) => <ActionButton ref={ref} action="add" {...props} />
)
AddButton.displayName = 'AddButton'

export const ViewButton = React.forwardRef<HTMLButtonElement, Omit<ActionButtonProps, 'action'>>(
  (props, ref) => <ActionButton ref={ref} action="view" {...props} />
)
ViewButton.displayName = 'ViewButton'

export const SettingsButton = React.forwardRef<HTMLButtonElement, Omit<ActionButtonProps, 'action'>>(
  (props, ref) => <ActionButton ref={ref} action="settings" {...props} />
)
SettingsButton.displayName = 'SettingsButton'

export const ResetPasswordButton = React.forwardRef<HTMLButtonElement, Omit<ActionButtonProps, 'action'>>(
  (props, ref) => <ActionButton ref={ref} action="reset" {...props} />
)
ResetPasswordButton.displayName = 'ResetPasswordButton'

export const ActivateButton = React.forwardRef<HTMLButtonElement, Omit<ActionButtonProps, 'action'>>(
  (props, ref) => <ActionButton ref={ref} action="activate" {...props} />
)
ActivateButton.displayName = 'ActivateButton'

export const DeactivateButton = React.forwardRef<HTMLButtonElement, Omit<ActionButtonProps, 'action'>>(
  (props, ref) => <ActionButton ref={ref} action="deactivate" {...props} />
)
DeactivateButton.displayName = 'DeactivateButton'

export default ActionButton