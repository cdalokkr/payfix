'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'default'

export interface StatusBadgeProps {
  status: string
  variant?: StatusVariant
  className?: string
}

const statusVariants: Record<string, StatusVariant> = {
  active: 'success',
  inactive: 'error',
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  admin: 'info',
  user: 'default',
  online: 'success',
  offline: 'error',
  loading: 'warning',
}

const variantClasses: Record<StatusVariant, string> = {
  success: 'bg-green-100 text-green-800 hover:bg-green-100',
  warning: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  error: 'bg-red-100 text-red-800 hover:bg-red-100',
  info: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  default: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
}

export function StatusBadge({
  status,
  variant,
  className,
}: StatusBadgeProps) {
  const resolvedVariant = variant || statusVariants[status.toLowerCase()] || 'default'

  return (
    <Badge
      variant="secondary"
      className={cn(
        variantClasses[resolvedVariant],
        'capitalize font-medium',
        className
      )}
    >
      {status}
    </Badge>
  )
}