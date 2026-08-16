import React, { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

import Image from "next/image"

interface UserAvatarProps {
    src?: string | null
    alt?: string
    initials: string
    className?: string
}

export function UserAvatar({ src, alt, initials, className }: UserAvatarProps) {
    const [hasError, setHasError] = useState(false)

    // Reset error state if image source changes
    useEffect(() => {
        setHasError(false)
    }, [src])

    if (!src || hasError) {
        return (
            <div
                className={cn(
                    "flex size-full items-center justify-center rounded-full bg-primary/10 text-primary font-semibold select-none",
                    className
                )}
            >
                {initials}
            </div>
        )
    }

    return (
        <div className={cn("relative aspect-square size-full rounded-full overflow-hidden shrink-0", className)}>
            <img
                src={src}
                alt={alt || "User avatar"}
                onError={() => {
                    console.warn(`[UserAvatar] Failed to load image: ${src}. Falling back to initials.`);
                    setHasError(true);
                }}
                className="size-full object-cover rounded-full"
                loading="eager"
            />
        </div>
    )
}
