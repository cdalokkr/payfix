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
            "xl:col-span-6 shadow-xl border-primary/10 overflow-hidden flex flex-col h-full bg-background/50 backdrop-blur-sm pt-0 hover:bg-background/80 transition-colors group cursor-default hover:border-primary/20",
            className
        )}>
            <CardHeader className="border-b border-muted/20 bg-muted/50 transition-colors p-0 overflow-hidden group-hover:bg-muted/80">
                <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 group/header cursor-default">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary shadow-sm">
                            <Icon size={24} weight="duotone" className="h-6 w-6" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-bold">{title}</CardTitle>
                            {description && <CardDescription>{description}</CardDescription>}
                        </div>
                    </div>
                    {headerActions && (
                        <div className="flex items-center gap-2">
                            {headerActions}
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className={cn("p-4 flex flex-1 justify-center min-h-[500px]", contentClassName)}>
                {isInnerCard ? (
                    <Card className="w-full p-4 md:p-6 bg-background/40 backdrop-blur-md border border-primary/5 shadow-inner rounded-3xl flex flex-col items-center justify-center overflow-hidden transition-all duration-500 hover:bg-background/60 group/innercard">
                        {children}
                    </Card>
                ) : (
                    <div className="w-full">
                        {children}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
