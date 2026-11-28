"use client"

import React, { createContext, useCallback, useContext, useEffect, useState } from "react"
import { usePathname } from "next/navigation"

interface MobileCameraTransitionContextValue {
    showCameraLaunchShell: () => void
    hideCameraLaunchShell: () => void
}

const MobileCameraTransitionContext = createContext<MobileCameraTransitionContextValue>({
    showCameraLaunchShell: () => {},
    hideCameraLaunchShell: () => {},
})

export function useMobileCameraTransition() {
    return useContext(MobileCameraTransitionContext)
}

/**
 * Keeps the dark attendance camera launch overlay alive at the shared mobile layout
 * boundary so route changes between /mobile and /mobile/attendance never flash white.
 */
export function MobileCameraTransitionProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const [isLaunching, setIsLaunching] = useState(false)

    const showCameraLaunchShell = useCallback(() => {
        setIsLaunching(true)
    }, [])

    const hideCameraLaunchShell = useCallback(() => {
        setIsLaunching(false)
    }, [])

    useEffect(() => {
        if (!isLaunching) return
        if (pathname && pathname !== '/mobile' && !pathname.startsWith('/mobile/attendance')) {
            setIsLaunching(false)
            return
        }
        const safetyTimer = setTimeout(() => {
            setIsLaunching(false)
        }, 8000)
        return () => clearTimeout(safetyTimer)
    }, [isLaunching, pathname])

    return (
        <MobileCameraTransitionContext.Provider value={{ showCameraLaunchShell, hideCameraLaunchShell }}>
            {children}
            {isLaunching && (
                <div className="fixed inset-0 z-[70] bg-slate-950 flex flex-col items-center justify-center p-4">
                    <div className="w-full max-w-md flex flex-col items-center justify-center space-y-5 text-center">
                        <div className="w-52 h-64 rounded-[999px] border-2 border-sky-500/40 bg-slate-900/70 flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full border-2 border-sky-400/30 border-t-sky-400 animate-spin" />
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-sm font-bold text-white tracking-tight">Opening Attendance Camera…</p>
                            <p className="text-[11px] font-medium text-slate-400">Starting live video &amp; verification session</p>
                        </div>
                    </div>
                </div>
            )}
        </MobileCameraTransitionContext.Provider>
    )
}
