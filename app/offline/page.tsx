"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { WifiOff, RefreshCw, ArrowLeft, ShieldAlert } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export default function OfflinePage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isChecking, setIsChecking] = useState(false)
  const [onlineStatus, setOnlineStatus] = useState<boolean>(true)

  // Set document title and monitor browser online/offline status dynamically
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.title = "Offline | PayFix"
      setOnlineStatus(navigator.onLine)

      const handleOnline = () => setOnlineStatus(true)
      const handleOffline = () => setOnlineStatus(false)

      window.addEventListener("online", handleOnline)
      window.addEventListener("offline", handleOffline)

      return () => {
        window.removeEventListener("online", handleOnline)
        window.removeEventListener("offline", handleOffline)
      }
    }
  }, [])

  const handleRetry = async () => {
    setIsChecking(true)
    
    // Simulate a brief delay for a better feedback loop
    await new Promise((resolve) => setTimeout(resolve, 800))

    if (typeof navigator !== "undefined" && navigator.onLine) {
      toast.success("You are back online! Refreshing dashboard...")
      startTransition(() => {
        router.refresh()
        // If we are on the offline route, redirect back to home/dashboard
        router.replace("/")
      })
    } else {
      toast.error("Still offline. Please check your internet connection.")
      setIsChecking(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50/40 via-slate-50 to-blue-50/40 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* Glow Decorations */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-500/10 dark:bg-blue-600/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-indigo-500/10 dark:bg-indigo-600/5 rounded-full blur-3xl -z-10" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="backdrop-blur-md bg-white/60 dark:bg-zinc-900/60 border border-slate-200/50 dark:border-zinc-800/50 shadow-2xl rounded-3xl p-8 max-w-md w-full text-center relative overflow-hidden"
      >
        {/* Animated Accent Indicator */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600" />

        {/* WifiOff Animated Icon */}
        <div className="relative flex items-center justify-center w-24 h-24 mx-auto mb-6">
          <motion.div
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute inset-0 bg-rose-500/10 dark:bg-rose-500/5 rounded-full"
          />
          <motion.div
            animate={{
              scale: [0.9, 1, 0.9],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute w-16 h-16 bg-rose-500/20 dark:bg-rose-500/10 rounded-full flex items-center justify-center"
          />
          <WifiOff className="w-8 h-8 text-rose-500 dark:text-rose-400 relative z-10" />
        </div>

        {/* Text Content */}
        <h2 className="text-2xl font-black text-slate-800 dark:text-zinc-100 tracking-tight mb-2">
          Connection Lost
        </h2>
        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 mb-8 leading-relaxed px-2">
          Your device is currently offline. Don&apos;t worry—your local attendance punch records are saved securely and will sync automatically once connection is restored.
        </p>

        {/* Action Controls */}
        <div className="space-y-4">
          <Button
            onClick={handleRetry}
            disabled={isChecking || isPending}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20 transition-all duration-300 gap-2 shrink-0 disabled:opacity-70"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? "animate-spin" : ""}`} />
            {isChecking ? "Checking Connection..." : "Retry Connection"}
          </Button>

          <Button
            variant="outline"
            onClick={() => router.replace("/")}
            className="w-full h-12 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-all gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to Dashboard
          </Button>
        </div>

        {/* Sync Info Banner */}
        <div className="flex items-center gap-2 justify-center mt-8 pt-6 border-t border-slate-200/50 dark:border-zinc-800/30 text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4 text-indigo-500/70" />
          <span>Offline logs sync active</span>
        </div>
      </motion.div>
    </div>
  )
}
