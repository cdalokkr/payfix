'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Loader2, CheckCircle } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'
import { clearAllPrefetchStatus } from '@/lib/prefetch-status'
import { clearCacheByTier } from '@/hooks/use-realtime-dashboard-data'
import { motion, AnimatePresence } from 'framer-motion'
import { Progress } from '@/components/ui/progress'

interface LogoutModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function LogoutModal({ isOpen, onOpenChange }: LogoutModalProps) {
  const [contentLoading, setContentLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const [shouldAutoClose, setShouldAutoClose] = useState(false)

  const router = useRouter()
  const queryClient = useQueryClient()

  const loadingMessages = [
    "Signing out from your account...",
    "Clearing session data...",
    "Removing cached information...",
    "Cleaning up user preferences...",
    "Finalizing logout process...",
    "Redirecting to login page..."
  ]

  // Calculate progress percentage
  const progress = Math.min(100, Math.max(0, ((currentMessageIndex + 1) / loadingMessages.length) * 100))

  const logoutMutation = trpc.auth.logout.useMutation()

  // PERFORMANCE FIX: Store mutation in a ref to avoid dependency array issues
  // This prevents the effect from re-running when the mutation object reference changes
  const logoutMutationRef = useRef(logoutMutation)
  logoutMutationRef.current = logoutMutation

  // Reset states when modal opens
  useEffect(() => {
    if (isOpen) {
      setContentLoading(true)
      setIsSuccess(false)
      setCurrentMessageIndex(0)
      setIsLoggingOut(false)
      setLogoutError(null)
      setShouldAutoClose(false)
    }
  }, [isOpen])


  // Trigger logout when modal opens with async step-by-step execution
  // PERFORMANCE FIX: Use ref for mutation to prevent multiple effect triggers
  // The mutation object reference changes on every render, causing unnecessary re-runs (6+ times)
  // By using a ref, we only trigger logout when isOpen changes to true and other conditions are met
  useEffect(() => {
    console.log('[LOGOUT-MODAL] Effect triggered: isOpen=', isOpen, 'contentLoading=', contentLoading, 'isSuccess=', isSuccess, 'isLoggingOut=', isLoggingOut)
    if (isOpen && contentLoading && !isSuccess && !isLoggingOut) {
      console.log('[LOGOUT-MODAL] Initiating logout process')
      setIsLoggingOut(true)
      // Dispatch event to notify other components (like DashboardLayout) to stop fetching data
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('loggingOut'))
      }

      // Async function to execute logout with optimized speed
      const executeLogoutSteps = async () => {
        try {
          console.log('[LOGOUT-MODAL] Step 0: Signing out...')
          // Start the mutation which does the heavy lifting on server
          const logoutPromise = logoutMutationRef.current.mutateAsync()

          // Concurrent cleanup of client-side data while server processes
          const cleanupPromise = (async () => {
            try {
              // Clear profile storage
              localStorage.removeItem('userProfile')
              sessionStorage.removeItem('sessionProfile')

              // Clear React Query cache
              queryClient.clear()

              // Clear prefetch status and multi-tier cache
              clearAllPrefetchStatus()
              clearCacheByTier()

              console.log('[LOGOUT-MODAL] Client-side cleanup completed')
            } catch (error) {
              console.warn('[LOGOUT-MODAL] Client cleanup warning:', error)
            }
          })()

          // Eagerly prefetch login route so final redirection is instant
          router.prefetch('/login')

          // Map messages to shorter intervals for better UX feel (reduced from 400ms to 80ms)
          setCurrentMessageIndex(1) // Clearing data
          await new Promise(resolve => setTimeout(resolve, 80))

          setCurrentMessageIndex(3) // Cleanup
          await Promise.all([logoutPromise, cleanupPromise])

          setCurrentMessageIndex(5) // Finalizing (reduced from 300ms to 80ms)
          await new Promise(resolve => setTimeout(resolve, 80))

          // All steps complete - show success
          setIsSuccess(true)
          setContentLoading(false)

          // Crisp, professional transition after success animation (reduced from 1200ms to 450ms)
          setTimeout(() => {
            console.log('[LOGOUT-MODAL] Immediate redirecting to /login')
            onOpenChange(false)
            window.location.replace('/login')
          }, 450)

        } catch (error) {
          console.error('[LOGOUT-MODAL] Logout failed, forcing redirect:', error)
          // Secure fallback: always clear and redirect
          localStorage.clear()
          sessionStorage.clear()
          onOpenChange(false)
          window.location.replace('/login')
        }
      }

      // Execute the async logout steps
      executeLogoutSteps()
    }
  }, [isOpen, contentLoading, isSuccess, isLoggingOut, router, queryClient, onOpenChange])

  return (
    <Dialog open={isOpen} onOpenChange={() => { }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none bg-transparent shadow-none" showCloseButton={false}>
        <div className="bg-white/90 backdrop-blur-2xl border border-white/20 rounded-[2.5rem] p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.1)] relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100/30 blur-3xl rounded-full -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-100/30 blur-3xl rounded-full -ml-16 -mb-16" />

          <DialogHeader className="mb-2">
            <DialogTitle className="text-2xl font-bold text-gray-900 text-center tracking-tight">Safe Sign Out</DialogTitle>
            <DialogDescription className="text-center text-gray-500 text-sm mt-1">
              Securing your session data
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center gap-6 py-6">
            <AnimatePresence mode="wait" initial={false}>
              {isSuccess ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="flex flex-col items-center gap-4 w-full text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{
                      scale: [1, 1.1, 1],
                    }}
                    transition={{
                      delay: 0.15,
                      type: "spring",
                      stiffness: 300,
                      damping: 20,
                      scale: {
                        repeat: Infinity,
                        duration: 2,
                        ease: "easeInOut"
                      }
                    }}
                  >
                    <CheckCircle className="h-12 w-12 text-green-500" aria-hidden="true" />
                  </motion.div>
                  <div className="flex flex-col gap-1">
                    <motion.p
                      className="text-lg font-medium text-green-600"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 1, 1, 0.7, 1] }}
                      transition={{
                        delay: 0.2,
                        opacity: {
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }
                      }}
                    >
                      Securely Signed Out!
                    </motion.p>
                    <motion.p
                      className="text-gray-500 text-sm font-medium"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      Protecting your privacy...
                    </motion.p>
                    {logoutError && (
                      <motion.p
                        className="text-xs text-amber-600 mt-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                      >
                        Note: {logoutError}
                      </motion.p>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="flex flex-col items-center gap-6 w-full"
                >
                  <div className="relative">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
                  </div>

                  <div className="w-full space-y-4">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentMessageIndex}
                        className="flex flex-col items-center gap-1"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.3 }}
                      >
                        <p className="text-sm font-medium text-foreground text-center">
                          {loadingMessages[currentMessageIndex]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Step {currentMessageIndex + 1} of {loadingMessages.length}
                        </p>
                      </motion.div>
                    </AnimatePresence>

                    <Progress value={progress} className="h-1.5 w-full bg-gray-100" indicatorClassName="bg-gradient-to-r from-blue-600 to-indigo-600" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}