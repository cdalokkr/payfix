// ActionButton Component - Type Declarations
// This file provides TypeScript definitions for the ActionButton component system

import React from 'react'

// Export all ActionButton related types
export type ActionType = 'edit' | 'save' | 'cancel' | 'delete' | 'add' | 'view' | 'settings'
export type ActionButtonVariant = 'button' | 'icon-only'
export type ActionButtonSize = 'sm' | 'md' | 'lg'

export interface ActionButtonProps extends React.ComponentProps<'button'> {
  // Required
  action: ActionType
  
  // Optional styling
  variant?: ActionButtonVariant
  size?: ActionButtonSize
  
  // State management
  loading?: boolean
  disabled?: boolean
  
  // Content
  icon?: React.ComponentType<any>
  children?: React.ReactNode
  
  // Event handling
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  
  // Accessibility
  'aria-label'?: string
  'data-testid'?: string
  
  // Additional styling
  className?: string
}

// Convenience component type definitions
export type EditButtonProps = Omit<ActionButtonProps, 'action'>
export type SaveButtonProps = Omit<ActionButtonProps, 'action'>
export type CancelButtonProps = Omit<ActionButtonProps, 'action'>
export type DeleteButtonProps = Omit<ActionButtonProps, 'action'>
export type AddButtonProps = Omit<ActionButtonProps, 'action'>
export type ViewButtonProps = Omit<ActionButtonProps, 'action'>
export type SettingsButtonProps = Omit<ActionButtonProps, 'action'>

// Animation variant types
export interface AnimationVariants {
  initial: React.CSSProperties
  hover: React.CSSProperties & { transition?: React.CSSProperties }
  tap: React.CSSProperties & { transition?: React.CSSProperties }
  loading: React.CSSProperties & { transition?: React.CSSProperties }
}

// Theme configuration types
export interface ActionTheme {
  base: string
  icon: string
  shadow: string
}

export interface ActionThemes {
  edit: ActionTheme
  save: ActionTheme
  cancel: ActionTheme
  delete: ActionTheme
  add: ActionTheme
  view: ActionTheme
  settings: ActionTheme
}

// Size configuration types
export interface SizeConfig {
  button: string
  icon: string
  iconOnly: string
}

export interface SizeConfigs {
  sm: SizeConfig
  md: SizeConfig
  lg: SizeConfig
}

// Component forward ref types
export type ActionButtonRef = HTMLButtonElement
export type EditButtonRef = HTMLButtonElement
export type SaveButtonRef = HTMLButtonElement
export type CancelButtonRef = HTMLButtonElement
export type DeleteButtonRef = HTMLButtonElement
export type AddButtonRef = HTMLButtonElement
export type ViewButtonRef = HTMLButtonElement
export type SettingsButtonRef = HTMLButtonElement

// Re-export React types for convenience
export type { MouseEvent, ComponentProps } from 'react'

// Default export type
export type { ActionButtonProps as default }