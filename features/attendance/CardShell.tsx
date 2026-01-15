"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ReactNode } from "react"
import { motion } from "framer-motion"

interface CardShellProps {
    title: string
    description?: string
    icon: any // Lucide or Phosphor icon
    headerActions?: ReactNode
    children: ReactNode
    className?: string
    contentClassName?: string
    isInnerCard?: boolean
}

export function CardShell({
    title,
    description,
    icon: Icon,
    headerActions,
    children,
    className,
    contentClassName,
    isInnerCard = false
}: CardShellProps) {
    return (
        <Card className={cn(
            "shadow-xl border-primary/10 overflow-hidden flex flex-col h-full bg-background/50 backdrop-blur-sm pt-0 transition-all duration-300 group/shell cursor-default hover:border-primary/20",
            className
        )}>
            <CardHeader className="border-b border-muted/20 bg-muted/50 transition-colors p-0 py-4 overflow-hidden group-hover/shell:bg-muted/80">
                <div className="px-6 flex flex-col md:flex-row md:items-center justify-between gap-2 cursor-default">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary shadow-sm transition-transform duration-300 group-hover/shell:scale-110 group-hover/shell:rotate-3">
                            <Icon size={24} weight="duotone" className="h-6 w-6" />
                        </div>
                        <div className="flex flex-col justify-center space-y-1">
                            <CardTitle className="text-lg font-bold leading-none">{title}</CardTitle>
                            {description && <CardDescription className="line-clamp-1 leading-none mb-0">{description}</CardDescription>}
                        </div>
                    </div>
                    {headerActions && (
                        <div className="flex items-center gap-2">
                            {headerActions}
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className={cn("p-4 flex flex-1 flex-col", contentClassName)}>
                {isInnerCard ? (
                    <Card className="w-full p-4 md:p-6 bg-background/40 backdrop-blur-md border border-primary/5 hover:border-primary/10 shadow-inner rounded-3xl flex flex-col items-center justify-center overflow-hidden transition-all duration-500 hover:bg-background/60 h-full">
                        {children}
                    </Card>
                ) : (
                    <div className="w-full h-full">
                        {children}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
