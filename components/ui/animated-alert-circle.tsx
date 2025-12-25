"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface AnimatedAlertCircleProps {
    className?: string
    size?: number
    strokeWidth?: number
}

export function AnimatedAlertCircle({
    className,
    size = 16,
    strokeWidth = 2
}: AnimatedAlertCircleProps) {
    return (
        <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-current"
            >
                <motion.circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{
                        duration: 0.5,
                        ease: "easeOut",
                        repeat: Infinity,
                        repeatDelay: 2,
                        repeatType: "loop"
                    }}
                />
                <motion.line
                    x1="12"
                    y1="8"
                    x2="12"
                    y2="12"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{
                        duration: 0.3,
                        ease: "easeOut",
                        delay: 0.3,
                        repeat: Infinity,
                        repeatDelay: 2.2, // 2 + 0.5 - 0.3 = 2.2 to sync roughly or just independent loop
                        repeatType: "loop"
                    }}
                />
                <motion.line
                    x1="12"
                    y1="16"
                    x2="12.01"
                    y2="16"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                        duration: 0.2,
                        ease: "easeOut",
                        delay: 0.5,
                        repeat: Infinity,
                        repeatDelay: 2.3,
                        repeatType: "loop"
                    }}
                />
            </svg>
        </div>
    )
}
