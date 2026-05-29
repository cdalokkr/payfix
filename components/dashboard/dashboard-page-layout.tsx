"use client"

import React from 'react'
import { usePathname } from 'next/navigation'
import { Fragment } from 'react'
import { cn } from '@/lib/utils'
import { PageHeading } from '@/components/ui/page-heading'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

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
  const pathname = usePathname()

  // Generate breadcrumb from pathname
  const breadcrumbs = React.useMemo(() => {
    if (!pathname) return []
    const parts = pathname.split('/').filter(Boolean)
    return parts.map((part, index) => {
      let name = part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ');
      if (['Admin', 'Moderator', 'Employee', 'Dashboard'].includes(name)) {
        name = 'Dashboard';
      }

      return {
        name,
        href: '/' + parts.slice(0, index + 1).join('/'),
        isLast: index === parts.length - 1
      }
    })
  }, [pathname])

  return (
    <div className="dashboard-wrapper">
      {(heading || description || headerAction) && (
        <div className="flex flex-col gap-2 mb-6">
          {/* Breadcrumbs at the top of page content */}
          {breadcrumbs.length > 0 && (
            <Breadcrumb className="mb-1">
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => (
                  <Fragment key={crumb.href}>
                    {index > 0 && <BreadcrumbSeparator className="text-muted-foreground/30" />}
                    <BreadcrumbItem>
                      {crumb.isLast ? (
                        <BreadcrumbPage className="font-semibold text-foreground tracking-tight">{crumb.name}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          href={crumb.href}
                          className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                        >
                          {crumb.name}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {(heading || description) && (
              <PageHeading
                heading={heading || ''}
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
        </div>
      )}

      <div className={cn(className)}>
        {children}
      </div>
    </div>
  )
}
