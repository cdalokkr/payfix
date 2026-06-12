"use client"

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { MobileAttendanceWizard } from '@/features/mobile/mobile-attendance-wizard'
import { Button } from '@/components/ui/button'

interface MobileAttendanceClientProps {
    profile: {
        id: string
        full_name: string | null
        avatar_url: string | null
    }
    action: 'clock_in' | 'clock_out'
}

export function MobileAttendanceClient({ profile, action }: MobileAttendanceClientProps) {
    const router = useRouter()
    const [isDesktop, setIsDesktop] = useState(false)

    useEffect(() => {
        setIsDesktop(window.innerWidth >= 1024)
        
        const handleResize = () => {
            setIsDesktop(window.innerWidth >= 1024)
        }
        
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const handleComplete = () => {
        // Just navigate to dashboard - tRPC cache invalidation handles data refresh
        router.push('/mobile')
    }

    const handleCancel = () => {
        router.push('/mobile')
    }

    if (isDesktop) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-[2rem] shadow-xl max-w-sm mx-auto space-y-6">
                <div className="w-20 h-20 bg-rose-500/10 rounded-[2rem] flex items-center justify-center text-rose-500 border-2 border-rose-500/20 shadow-lg shadow-rose-500/5 animate-bounce">
                    <span className="text-3xl">💻</span>
                </div>
                <div className="space-y-2">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Desktop View Blocked</h3>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed uppercase tracking-wider">
                        Attendance marking restricted
                    </p>
                    <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 leading-snug px-2">
                        Daily check-in and check-out can only be completed on mobile devices or via the standalone PWA application.
                    </p>
                </div>
                <Button 
                    onClick={() => router.push('/employee')} 
                    className="w-full h-12 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold hover:opacity-90 active:scale-95 transition-all shadow-md"
                >
                    Go to Dashboard
                </Button>
            </div>
        )
    }

    return (
        <MobileAttendanceWizard
            action={action}
            profileImageUrl={profile.avatar_url}
            onComplete={handleComplete}
            onCancel={handleCancel}
        />
    )
}
