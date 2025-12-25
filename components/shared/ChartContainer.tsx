'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSpinner } from './LoadingSpinner'

export interface ChartContainerProps {
  title?: string
  children: React.ReactNode
  loading?: boolean
  error?: string | null
  className?: string
  height?: number
}

export function ChartContainer({
  title,
  children,
  loading = false,
  error = null,
  className = '',
  height = 300,
}: ChartContainerProps) {
  if (error) {
    return (
      <Card className={className}>
        {title && (
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex items-center justify-center h-32 text-destructive">
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div
          className="relative"
          style={{ height: `${height}px` }}
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
              <LoadingSpinner size="sm" />
            </div>
          )}
          <div className="h-full w-full">
            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}