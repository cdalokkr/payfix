"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function ModernDialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function ModernDialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function ModernDialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function ModernDialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function ModernDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "fixed inset-0 z-50",
        // More transparent modern backdrop with blur effect
        "bg-black/20 backdrop-blur-sm",
        className
      )}
      {...props}
    />
  )
}

interface ModernDialogContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  showCloseButton?: boolean
  size?: "sm" | "md" | "lg" | "xl" | "full"
  children: React.ReactNode
}

const sizeVariants = {
  sm: "sm:max-w-md",
  md: "sm:max-w-2xl",
  lg: "sm:max-w-4xl",
  xl: "sm:max-w-6xl",
  full: "sm:max-w-[95vw] sm:h-[95vh]"
}

function ModernDialogContent({
  className,
  children,
  showCloseButton = true,
  size = "lg",
  ...props
}: ModernDialogContentProps) {
  // Simple approach: Always ensure there's a DialogPrimitive.Title as direct child
  let foundTitle = false
  let titleContent: React.ReactNode = "Dialog"
  const remainingChildren: React.ReactNode[] = []
  let headerContent: React.ReactElement | null = null
  let appTitleElement: React.ReactElement | null = null
  let hasAppTitle = false

  // Process children to find title, header and extract them
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) {
      const childProps = child.props as any
      const childClassName = childProps.className || ''

      // Check if this is a custom wrapper containing app title (app title with close button)
      if (childClassName.includes('justify-between') &&
        childClassName.includes('flex-shrink-0') &&
        childClassName.includes('bg-muted')) {
        // This is our custom app title wrapper
        appTitleElement = child
        hasAppTitle = true

        // Look for ModernDialogTitle inside this wrapper
        React.Children.forEach(childProps.children, (wrapperChild) => {
          if (React.isValidElement(wrapperChild) && wrapperChild.type === ModernDialogTitle) {
            const titleChild = wrapperChild as React.ReactElement<React.ComponentProps<typeof ModernDialogTitle>>
            foundTitle = true
            titleContent = titleChild.props.children
          }
        })
      } else if (child.type === ModernDialogTitle) {
        // Found a ModernDialogTitle, extract its content and props
        foundTitle = true
        const typedChild = child as React.ReactElement<React.ComponentProps<typeof ModernDialogTitle>>
        titleContent = typedChild.props.children

        // Check if this is an app title (has custom styling)
        const hasCustomStyling = typedChild.props.className &&
          (typedChild.props.className.includes('text-center') ||
            typedChild.props.className.includes('text-lg') ||
            typedChild.props.className.includes('font-bold'))

        if (hasCustomStyling) {
          // This is the app title, keep it for display (don't add to remaining children)
          appTitleElement = typedChild
          hasAppTitle = true
        } else {
          // This is a regular title, add to remaining children
          remainingChildren.push(React.cloneElement(typedChild, {
            key: typedChild.key || `title-${Math.random().toString(36).substr(2, 9)}`
          }))
        }
      } else if (child.type === ModernDialogHeader) {
        // Keep entire header content for fixed header display
        const typedChild = child as React.ReactElement<React.ComponentProps<typeof ModernDialogHeader>>
        headerContent = typedChild
      } else {
        // Ensure other children have keys
        const childWithKey = React.cloneElement(child, {
          key: child.key || `child-${Math.random().toString(36).substr(2, 9)}`
        })
        remainingChildren.push(childWithKey)
      }
    } else {
      // Non-element children (text, etc.)
      remainingChildren.push(child)
    }
  })

  // Always render DialogPrimitive.Title for accessibility - when we have an app title, make it sr-only
  const dialogTitle = foundTitle ? (
    <DialogPrimitive.Title className={hasAppTitle ? "sr-only" : ""}>
      {titleContent}
    </DialogPrimitive.Title>
  ) : (
    <DialogPrimitive.Title className="sr-only">{titleContent}</DialogPrimitive.Title>
  )

  return (
    <ModernDialogPortal data-slot="dialog-portal">
      <ModernDialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          // Base modal styles
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "fixed top-[50%] left-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
          "rounded-xl border shadow-2xl duration-300",

          // Modern padding and sizing
          "p-0 sm:p-8",
          sizeVariants[size],

          // Full-screen option
          size === "full" && [
            "w-[100vw] h-[100vh] sm:w-[95vw] sm:h-[95vh]",
            "top-0 left-0 translate-x-0 translate-y-0",
            "rounded-none sm:rounded-xl"
          ],

          className
        )}
        {...props}
      >
        {/* CRITICAL: DialogPrimitive.Title must be direct child for Radix UI accessibility - ONLY when no app title */}
        {dialogTitle}

        {/* App Title - Fixed at top with close button */}
        {appTitleElement && (
          <div className="flex-shrink-0 border-b bg-muted/10">
            {appTitleElement}
          </div>
        )}

        {/* Fixed Header with content - ENTIRE header in fixed area */}
        {headerContent && (
          <div className="flex-shrink-0 px-6 py-3 border-b bg-background">
            <div className="flex items-center gap-3">
              {(headerContent as React.ReactElement<any>).props.children}
            </div>
          </div>
        )}

        {/* Content area with reduced top spacing */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-6">
          {remainingChildren}
        </div>
      </DialogPrimitive.Content>
    </ModernDialogPortal>
  )
}

function ModernDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col space-y-1.5 text-center sm:text-left",
        "pb-6",
        className
      )}
      {...props}
    />
  )
}

function ModernDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-3 sm:flex-row sm:justify-end",
        "pt-6 border-t",
        className
      )}
      {...props}
    />
  )
}

function ModernDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-2xl leading-none font-bold tracking-tight",
        "bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent",
        className
      )}
      {...props}
    />
  )
}

function ModernDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-base leading-relaxed", className)}
      {...props}
    />
  )
}

export {
  ModernDialog,
  ModernDialogClose,
  ModernDialogContent,
  ModernDialogDescription,
  ModernDialogFooter,
  ModernDialogHeader,
  ModernDialogOverlay,
  ModernDialogPortal,
  ModernDialogTitle,
  ModernDialogTrigger,
}