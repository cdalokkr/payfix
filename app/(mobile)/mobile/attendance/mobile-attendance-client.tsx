"use client"

import { useRouter } from 'next/navigation'
import { MobileAttendanceWizard } from '@/features/mobile/mobile-attendance-wizard'

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

    const handleComplete = () => {
        router.push('/mobile')
        router.refresh()
    }

    const handleCancel = () => {
        router.push('/mobile')
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
