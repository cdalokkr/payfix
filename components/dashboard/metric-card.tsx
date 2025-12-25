'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
}

export function MetricCardSkeleton({ title, description, icon, iconBgColor, iconColor, borderColor, gradientColor, cardBgColor }: {
    title?: string
    description?: string
    icon?: React.ReactNode
    iconBgColor?: string
    iconColor?: string
    borderColor?: string
    gradientColor?: string
    cardBgColor?: string
}) {
    return (
        <div className={`h-full relative overflow-hidden rounded-xl border ${borderColor || 'border-transparent'} p-3 ${cardBgColor || 'bg-background/60'} backdrop-blur-xl`}>
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
                    <p className="text-xs text-muted-foreground/50">{description}</p>
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
    disableHover = false
}: MetricCardProps) {
    const [isHovered, setIsHovered] = useState(false)

    // Extract base color from gradient for the glow effect
    const glowColor = gradientColor.includes('blue') ? 'rgba(59, 130, 246, 0.5)' :
        gradientColor.includes('orange') ? 'rgba(249, 115, 22, 0.5)' :
            gradientColor.includes('purple') ? 'rgba(168, 85, 247, 0.5)' :
                gradientColor.includes('green') ? 'rgba(34, 197, 94, 0.5)' :
                    gradientColor.includes('red') ? 'rgba(239, 68, 68, 0.5)' :
                        'rgba(var(--primary), 0.5)';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                type: "spring",
                stiffness: 260,
                damping: 20,
                delay
            }}
            whileHover={disableHover ? {} : {
                y: -4,
                transition: { type: "spring", stiffness: 400, damping: 10 }
            }}
            className="h-full"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div
                className={cn(
                    "relative overflow-hidden h-full transition-all duration-500",
                    "rounded-2xl border bg-background/40 backdrop-blur-2xl",
                    "group shadow-sm",
                    !disableHover && "hover:shadow-2xl hover:bg-background/60",
                    borderColor || 'border-border/50',
                    cardBgColor,
                    className
                )}
                style={{
                    boxShadow: !disableHover && isHovered ? `0 20px 40px -15px ${glowColor}` : undefined
                }}
            >
                {/* Dynamic Shine Effect */}
                {!disableHover && (
                    <motion.div
                        className="absolute inset-0 z-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                        initial={false}
                        animate={isHovered ? {
                            background: [
                                `linear-gradient(110deg, transparent 20%, rgba(255,255,255,0.1) 48%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 52%, transparent 80%)`,
                                `linear-gradient(110deg, transparent 20%, rgba(255,255,255,0.1) 48%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 52%, transparent 80%)`
                            ],
                            backgroundPosition: ['-200% 0%', '200% 0%'],
                        } : {}}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                        style={{ backgroundSize: '200% 100%' }}
                    />
                )}

                {/* Themed Gradient Overlay */}
                {!disableHover && (
                    <div
                        className={cn(
                            "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br pointer-events-none",
                            gradientColor
                        )}
                    />
                )}

                {/* Noise Texture for glassmorphism */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

                {/* Content Wrapper */}
                <div className="relative z-10 h-full p-4 flex flex-col">
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
                                    <p className="text-xs text-muted-foreground/60 leading-tight line-clamp-1 group-hover:text-muted-foreground/80 transition-colors duration-300">
                                        {description}
                                    </p>
                                )}
                            </div>
                            {icon && (
                                <motion.div
                                    className={cn(
                                        "p-2 rounded-xl transition-all duration-500 shadow-sm",
                                        iconBgColor || 'bg-secondary/50',
                                        isHovered && "scale-110 rotate-6 shadow-md"
                                    )}
                                    layout
                                >
                                    {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<React.SVGProps<SVGSVGElement>>, {
                                        className: cn(
                                            "h-5 w-5 transition-colors duration-300",
                                            iconColor || 'text-foreground'
                                        ),
                                        'aria-hidden': true,
                                        strokeWidth: 2.25
                                    }) : icon}
                                </motion.div>
                            )}
                        </div>
                    )}

                    {!children && (
                        <div className="mt-auto">
                            <div className="text-2xl font-bold tracking-tighter text-foreground flex items-baseline gap-2">
                                <AnimatePresence mode="wait">
                                    {loading ? (
                                        <motion.div
                                            key="skeleton"
                                            initial={{ opacity: 0, filter: 'blur(4px)' }}
                                            animate={{ opacity: 1, filter: 'blur(0px)' }}
                                            exit={{ opacity: 0, filter: 'blur(4px)' }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <div className="h-8 w-20 bg-muted/40 rounded-lg animate-pulse" />
                                        </motion.div>
                                    ) : (
                                        <motion.span
                                            key="value"
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                            className="tabular-nums"
                                        >
                                            {value}
                                        </motion.span>
                                    )}
                                </AnimatePresence>

                                {trend && (
                                    <motion.span
                                        initial={{ opacity: 0, x: -5 }}
                                        animate={{ opacity: 1, x: 0 }}
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
                                    </motion.span>
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
        </motion.div>
    )
}
