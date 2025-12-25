import React from 'react'
import { cn } from '@/lib/utils'
import { PageHeading } from '@/components/ui/page-heading'

interface DashboardPageLayoutProps {
  /**
   * The main heading text to display
   */
  heading?: string

  /**
   * Optional description/subtitle text
   */
  description?: string

  /**
   * Optional action element to display on the right side of the header (e.g. buttons)
   */
  headerAction?: React.ReactNode

  /**
   * The main content of the page
   */
  children: React.ReactNode

  /**
   * Additional CSS classes to apply to the content wrapper
   */
  className?: string
}

/**
 * DashboardPageLayout - A reusable layout component for consistent page structure
 * Enforces consistent padding, spacing, and header alignment across the dashboard.
 */
export function DashboardPageLayout({
  heading,
  description,
  children,
  className,
  headerAction
}: DashboardPageLayoutProps) {
  return (
    <div className="dashboard-wrapper">
      {(heading || description || headerAction) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {heading && (
            <PageHeading
              heading={heading}
              description={description}
              className="mb-0"
            />
          )}
          {headerAction && (
            <div className="flex-shrink-0">
              {headerAction}
            </div>
          )}
        </div>
      )}

      <div className={cn(className)}>
        {children}
      </div>
    </div>
  )
}
