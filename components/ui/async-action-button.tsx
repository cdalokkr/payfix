"use client"

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Check, UserCheck, UserX, Trash2, Power, Edit2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AsyncActionButtonProps {
  action: 'activate' | 'deactivate' | 'delete' | 'edit' | 'suspend'
  size?: 'sm' | 'md' | 'lg'
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => Promise<any> | void
  disabled?: boolean
  className?: string
  title?: string
  status?: 'idle' | 'processing' | 'success' | 'error' // Controlled mode
}

const ACTION_ICONS = {
  activate: UserCheck,
  deactivate: UserX,
  suspend: Power,
  delete: Trash2,
  edit: Edit2,
}

const sizeConfigs = {
  sm: {
    button: 'h-8 w-8 rounded-lg',
    icon: 'h-4 w-4',
  },
  md: {
    button: 'h-9 w-9 rounded-xl',
    icon: 'h-4.5 w-4.5',
  },
  lg: {
    button: 'h-10 w-10 rounded-xl',
    icon: 'h-5 w-5',
  }
}

const actionThemes = {
  activate: {
    base: 'bg-white/90 dark:bg-slate-900/90 hover:border-emerald-500 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30 backdrop-blur-sm',
    fill: 'bg-emerald-500/10 border-emerald-500/20',
    icon: 'text-emerald-600 dark:text-emerald-400',
    shadow: 'hover:shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]',
  },
  deactivate: {
    base: 'bg-white/90 dark:bg-slate-900/90 hover:border-rose-500 text-rose-700 dark:text-rose-450 border-rose-200 dark:border-rose-900/30 backdrop-blur-sm',
    fill: 'bg-rose-500/10 border-rose-500/20',
    icon: 'text-rose-600 dark:text-rose-400',
    shadow: 'hover:shadow-[0_0_15px_-3px_rgba(244,63,94,0.4)]',
  },
  suspend: {
    base: 'bg-white/90 dark:bg-slate-900/90 hover:border-amber-500 text-amber-700 dark:text-amber-400 border-amber-250 dark:border-amber-900/30 backdrop-blur-sm',
    fill: 'bg-amber-500/10 border-amber-500/20',
    icon: 'text-amber-600 dark:text-amber-400',
    shadow: 'hover:shadow-[0_0_15px_-3px_rgba(245,158,11,0.4)]',
  },
  delete: {
    base: 'bg-white/90 dark:bg-slate-900/90 hover:border-red-500 text-red-700 dark:text-red-400 border-red-200/60 backdrop-blur-sm',
    fill: 'bg-red-500/10 border-red-500/20',
    icon: 'text-red-600 dark:text-red-450',
    shadow: 'hover:shadow-[0_0_15px_-3px_rgba(239,68,68,0.4)]',
  },
  edit: {
    base: 'bg-white/90 dark:bg-slate-900/90 hover:border-purple-500 text-purple-700 dark:text-purple-400 border-purple-200/60 backdrop-blur-sm',
    fill: 'bg-purple-500/10 border-purple-500/20',
    icon: 'text-purple-600 dark:text-purple-400',
    shadow: 'hover:shadow-[0_0_15px_-3px_rgba(168,85,247,0.4)]',
  }
}

export function AsyncActionButton({
  action,
  size = 'sm',
  onClick,
  disabled = false,
  className,
  title,
  status: controlledStatus,
}: AsyncActionButtonProps) {
  const [internalStatus, setInternalStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
  
  // Use controlled status if provided, otherwise internal status
  const currentStatus = controlledStatus !== undefined ? controlledStatus : internalStatus
  
  const IconComponent = ACTION_ICONS[action]
  const theme = actionThemes[action]
  const sizeConfig = sizeConfigs[size]
  const isButtonDisabled = disabled || currentStatus === 'processing'

  // Automatically reset success back to idle after a delay if in uncontrolled mode
  useEffect(() => {
    if (controlledStatus === undefined && internalStatus === 'success') {
      const timer = setTimeout(() => {
        setInternalStatus('idle')
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [internalStatus, controlledStatus])

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isButtonDisabled) return
    if (!onClick) return

    if (controlledStatus !== undefined) {
      // Controlled mode: just bubble up the click
      onClick(e)
      return
    }

    // Uncontrolled mode: handle async state transitions
    setInternalStatus('processing')
    try {
      await onClick(e)
      setInternalStatus('success')
    } catch (err) {
      console.error('Action failed:', err)
      setInternalStatus('idle')
    }
  }

  return (
    <motion.button
      type="button"
      title={title}
      disabled={isButtonDisabled}
      onClick={handleClick}
      className={cn(
        'inline-flex items-center justify-center border transition-all duration-300',
        'outline-none focus-visible:ring-2 focus-visible:ring-primary/50 relative overflow-hidden',
        sizeConfig.button,
        theme.base,
        !isButtonDisabled && theme.shadow,
        currentStatus === 'processing' && 'cursor-wait',
        className
      )}
      whileHover={!isButtonDisabled ? { scale: 1.05 } : undefined}
      whileTap={!isButtonDisabled ? { scale: 0.95 } : undefined}
    >
      {/* Dynamic Background Hover Fill */}
      <span
        className={cn(
          "absolute inset-0 transition-opacity duration-300 opacity-0 hover:opacity-100 border rounded-[inherit]",
          currentStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/20' : theme.fill
        )}
      />

      <AnimatePresence mode="wait">
        {currentStatus === 'processing' ? (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            <Loader2 className={cn(sizeConfig.icon, 'animate-spin text-primary')} />
          </motion.div>
        ) : currentStatus === 'success' ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            <Check className={cn(sizeConfig.icon, 'text-emerald-600 dark:text-emerald-400')} />
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            <IconComponent className={cn(sizeConfig.icon, theme.icon)} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
