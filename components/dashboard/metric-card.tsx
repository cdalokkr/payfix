'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'

export interface MetricCardProps {
    title?: string
    value?: string | number
    description?: string
    icon?: React.ReactNode
    loading?: boolean
    iconBgColor?: string
    iconColor?: string
    borderColor?: string
    gradientColor?: string
    cardBgColor?: string
    delay?: number
    children?: React.ReactNode
    className?: string
    trend?: {
        value: number
        label: string
        positive?: boolean
    }
    disableHover?: boolean
    padding?: string
    topBorderColor?: string
    hoverBorderColor?: string
    hoverShadowColor?: string
}

export function MetricCardSkeleton({ title, description, icon, iconBgColor, iconColor, borderColor, gradientColor, cardBgColor, topBorderColor, hoverBorderColor, hoverShadowColor }: {
    title?: string
    description?: string
    icon?: React.ReactNode
    iconBgColor?: string
    iconColor?: string
    borderColor?: string
    gradientColor?: string
    cardBgColor?: string
    topBorderColor?: string
    hoverBorderColor?: string
    hoverShadowColor?: string
}) {
    return (
        <div className={cn(
            "h-full relative overflow-hidden rounded-xl border p-3 backdrop-blur-md",
            topBorderColor ? "border-t-[5px]" : "",
            borderColor || 'border-transparent',
            topBorderColor,
            hoverBorderColor,
            hoverShadowColor,
            cardBgColor || 'bg-background/60'
        )}>
            <div className="flex flex-col h-full justify-between gap-2">
                {(title || icon) && (
                    <div className="flex justify-between items-start">
                        <h3 className="text-base font-semibold tracking-wide text-foreground">{title}</h3>
                        {icon && (
                            <div className={`p-1.5 rounded-md ${iconBgColor || 'bg-gray-100'} opacity-50`}>
                                {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<React.SVGProps<SVGSVGElement>>, {
                                    className: `h-5 w-5 ${iconColor || 'text-muted-foreground'}`,
                                    'aria-hidden': true,
                                    strokeWidth: 2.5
                                }) : icon}
                            </div>
                        )}
                    </div>
                )}
                <div>
                    <div className="h-8 w-24 bg-muted/50 rounded-md animate-pulse mb-1" />
                    <p className="text-xs text-muted-foreground/50 hidden sm:block">{description}</p>
                </div>
            </div>
        </div>
    )
}

export function MetricCard({
    title,
    value,
    description,
    icon,
    loading,
    iconBgColor,
    iconColor,
    borderColor,
    gradientColor = "from-primary/20 to-primary/5",
    cardBgColor,
    delay = 0,
    children,
    className,
    trend,
    disableHover = false,
    padding = "p-4",
    topBorderColor,
    hoverBorderColor,
    hoverShadowColor
}: MetricCardProps) {
    const [isHovered, setIsHovered] = useState(false)

    return (
        <div
            className={cn(
                "h-full relative overflow-hidden transition-all duration-300 ease-out rounded-2xl border bg-background/40 backdrop-blur-md shadow-xs",
                topBorderColor ? "border-t-[5px]" : "",
                !disableHover && "hover:-translate-y-1",
                !disableHover && !hoverShadowColor && "hover:shadow-md",
                !disableHover && !hoverBorderColor && "hover:border-primary/10",
                borderColor || 'border-border/50',
                topBorderColor,
                hoverBorderColor,
                hoverShadowColor,
                cardBgColor,
                className
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Themed Gradient Overlay */}
            {!disableHover && (
                <div
                    className={cn(
                        "absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br pointer-events-none -z-10",
                        gradientColor
                    )}
                />
            )}

            {/* Content Wrapper */}
            <div className={cn("relative z-10 h-full flex flex-col", padding)}>
                {(title || icon || description) && (
                    <div className="flex justify-between items-start mb-2">
                        <div className="space-y-1">
                            {title && (
                                <h3 className={cn(
                                    "tracking-tight text-foreground/90 transition-all duration-300 text-base font-semibold"
                                )}>
                                    {title}
                                </h3>
                            )}
                            {description && (
                                <p className="text-xs text-muted-foreground/60 leading-tight line-clamp-1 transition-colors duration-300 hidden sm:block">
                                    {description}
                                </p>
                            )}
                        </div>
                        {icon && (
                            <div
                                className={cn(
                                    "p-2 rounded-xl transition-all duration-300 shadow-xs",
                                    iconBgColor || 'bg-secondary/50',
                                    isHovered && "scale-105 shadow-xs"
                                )}
                            >
                                {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<React.SVGProps<SVGSVGElement>>, {
                                    className: cn(
                                        "h-5 w-5 transition-colors duration-300",
                                        iconColor || 'text-foreground'
                                    ),
                                    'aria-hidden': true,
                                    strokeWidth: 2.25
                                }) : icon}
                            </div>
                        )}
                    </div>
                )}

                {!children && (
                    <div className="mt-auto">
                        <div className="text-2xl font-bold tracking-tighter text-foreground flex items-baseline gap-2">
                            {loading ? (
                                <div className="h-6 w-16 bg-muted/30 rounded-md animate-pulse" />
                            ) : (
                                <span className="tabular-nums">
                                    {value}
                                </span>
                            )}

                            {trend && (
                                <span
                                    className={cn(
                                        "text-xs font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5",
                                        trend.positive
                                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                    )}
                                >
                                    {trend.positive ? (
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7 7 7M12 3v18" />
                                        </svg>
                                    ) : (
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7-7-7M12 21V3" />
                                        </svg>
                                    )}
                                    {trend.value}%
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {children && (
                    <div className="flex-1 mt-2">
                        {children}
                    </div>
                )}
            </div>
        </div>
    )
}
