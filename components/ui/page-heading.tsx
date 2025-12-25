import React from 'react'
import { cn } from '@/lib/utils'

export interface PageHeadingProps {
    /**
     * The main heading text to display
     */
    heading: string

    /**
     * Optional description/subtitle text
     */
    description?: string

    /**
     * Visual variant for the heading
     * - 'default': Plain bold text
     * - 'gradient': Gradient text effect
     */
    variant?: 'default' | 'gradient'

    /**
     * Additional CSS classes to apply to the container
     */
    className?: string
}

/**
 * PageHeading - A reusable component for consistent page headers across admin pages
 * 
 * @example
 * ```tsx
 * <PageHeading 
 *   heading="Admin Dashboard" 
 *   description="Overview of your application metrics"
 *   variant="gradient"
 * />
 * ```
 */
export function PageHeading({
    heading,
    description,
    variant = 'default',
    className
}: PageHeadingProps) {
    return (
        <div className={cn("pt-1 mb-2", className)}>
            <h2
                className={cn(
                    "text-2xl font-bold tracking-tight",
                    variant === 'gradient' && "bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent"
                )}
            >
                {heading}
            </h2>
            {description && (
                <p className="text-muted-foreground text-sm">
                    {description}
                </p>
            )}
        </div>
    )
}
