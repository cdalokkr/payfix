"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface AnimatedCheckCircleProps {
    className?: string
    size?: number
    strokeWidth?: number
}

export function AnimatedCheckCircle({
    className,
    size = 16,
    strokeWidth = 2
}: AnimatedCheckCircleProps) {
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
                <motion.path
                    d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{
                        duration: 0.4,
                        ease: "easeOut",
                        repeat: Infinity,
                        repeatDelay: 2,
                        repeatType: "loop"
                    }}
                />
                <motion.path
                    d="M9 12L11 14L15 10"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{
                        duration: 0.3,
                        ease: "easeOut",
                        delay: 0.2,
                        repeat: Infinity,
                        repeatDelay: 2.1,
                        repeatType: "loop"
                    }}
                />
            </svg>
        </div>
    )
}
