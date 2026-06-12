"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles } from "lucide-react"

const FEATURES = [
    "Geofence-verified check-ins",
    "Anti-spoofing Face ID validation",
    "Leave Management",
    "Chronological Salary Passbook logs",
    "Daily Ticket Log Tracker"
]

export function MobileSplash() {
    const [showSplash, setShowSplash] = useState(false)
    const [progress, setProgress] = useState(0)
    const [displayedText, setDisplayedText] = useState("")
    const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0)
    const [isDeleting, setIsDeleting] = useState(false)

    // Check session storage on mount to show once per session
    useEffect(() => {
        const hasShown = sessionStorage.getItem("mobile_splash_shown")
        if (!hasShown) {
            setShowSplash(true)
            // Progress bar animation
            const interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(interval)
                        setTimeout(() => {
                            setShowSplash(false)
                            sessionStorage.setItem("mobile_splash_shown", "true")
                        }, 500) // Delay before final fade-out
                        return 100
                    }
                    return prev + 1.5
                })
            }, 30)
            return () => clearInterval(interval)
        }
    }, [])

    // Typewriter effect logic
    useEffect(() => {
        if (!showSplash) return

        const fullText = FEATURES[currentFeatureIndex]
        let timer: NodeJS.Timeout

        if (isDeleting) {
            timer = setTimeout(() => {
                setDisplayedText(prev => prev.slice(0, -1))
            }, 25)
        } else {
            timer = setTimeout(() => {
                setDisplayedText(prev => fullText.slice(0, prev.length + 1))
            }, 50)
        }

        if (!isDeleting && displayedText === fullText) {
            timer = setTimeout(() => setIsDeleting(true), 1200)
        } else if (isDeleting && displayedText === "") {
            setIsDeleting(false)
            setCurrentFeatureIndex(prev => (prev + 1) % FEATURES.length)
        }

        return () => clearTimeout(timer)
    }, [displayedText, isDeleting, currentFeatureIndex, showSplash])

    return (
        <AnimatePresence>
            {showSplash && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ 
                        opacity: 0, 
                        y: -30,
                        transition: { duration: 0.5, ease: "easeInOut" } 
                    }}
                    className="fixed inset-0 z-[9999] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6 select-none"
                >
                    {/* Glowing background decorations */}
                    <div className="absolute top-[25%] left-1/2 -translate-x-1/2 w-72 h-72 bg-blue-500/10 dark:bg-blue-600/10 blur-[100px] rounded-full pointer-events-none animate-pulse" />
                    <div className="absolute bottom-[25%] left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />

                    {/* Logo & Branding */}
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
                            className="relative"
                        >
                            {/* Rotating outer dash ring */}
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
                                className="absolute -inset-4 rounded-[2rem] border-2 border-dashed border-blue-500/30 dark:border-blue-400/30"
                            />
                            {/* Glow behind the icon */}
                            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-3xl" />
                            
                            {/* App icon */}
                            <div className="relative w-24 h-24 bg-white dark:bg-slate-900 rounded-3xl flex items-center justify-center shadow-2xl border-2 border-white/10 overflow-hidden">
                                <img
                                    src="/icons/icon-192x192.png"
                                    alt="PayFix Logo"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </motion.div>

                        <div className="text-center space-y-2">
                            <motion.h1
                                initial={{ y: 15, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ duration: 0.5, delay: 0.3 }}
                                className="text-3xl font-black tracking-tight text-white"
                            >
                                PayFix
                            </motion.h1>
                            <motion.p
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ duration: 0.5, delay: 0.4 }}
                                className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.3em]"
                            >
                                Mobile PWA Attendance
                            </motion.p>
                        </div>
                    </div>

                    {/* Typewriter Feature Showcase & Progress Bar */}
                    <div className="w-full max-w-xs space-y-6 pb-12">
                        {/* Glassmorphic message container */}
                        <div className="min-h-[46px] flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
                            <Sparkles className="w-4 h-4 text-blue-400 shrink-0 animate-pulse" />
                            <p className="text-xs font-bold text-slate-200 text-center tracking-wide">
                                {displayedText}
                                <span className="animate-pulse text-blue-500 font-bold ml-0.5">|</span>
                            </p>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-slate-500 font-black tracking-wider uppercase">
                                <span>INITIALIZING</span>
                                <span className="tabular-nums">{Math.round(progress)}%</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
