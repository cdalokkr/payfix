"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  onLoadingStatusChange,
  src,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  const [status, setStatus] = React.useState<"idle" | "loading" | "loaded" | "error">("loading")

  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full transition-opacity duration-500",
        status === "loaded" ? "opacity-100" : "opacity-0",
        className
      )}
      onLoadingStatusChange={(s) => {
        setStatus(s)
        onLoadingStatusChange?.(s)
      }}
      src={src === "" ? undefined : src}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-secondary flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
