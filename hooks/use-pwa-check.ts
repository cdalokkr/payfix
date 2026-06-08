"use client"

import { useState, useEffect } from 'react'

export function usePwaCheck(initialIsPwa?: boolean) {
    const [isPwa, setIsPwa] = useState<boolean>(initialIsPwa ?? false)
    const [isMobile, setIsMobile] = useState<boolean>(false)
    const [isReady, setIsReady] = useState<boolean>(initialIsPwa !== undefined)

    useEffect(() => {
        const checkPwa = () => {
            // Check if running in standalone mode (PWA)
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone ||
                document.referrer.includes('android-app://')

            // Check if mobile device
            const userAgent = window.navigator.userAgent.toLowerCase()
            const mobile = /iphone|ipad|ipod|android|blackberry|mini|windows\sphone/i.test(userAgent)

            setIsPwa(isStandalone)
            setIsMobile(mobile)
            setIsReady(true)
        }

        checkPwa()
    }, [])

    return { isPwa, isMobile, isReady }
}
