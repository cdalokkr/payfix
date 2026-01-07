"use client"

import { SettingsView } from "@/features/settings/components/settings-view"
import { useProfile } from '@/lib/context/profile-context'

export default function EmployeeProfilePage() {
    const { profile: user, isLoading } = useProfile()

    if (isLoading) {
        return (
            <div className="container mx-auto pt-6 max-w-5xl">
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading Profiles...</p>
                    </div>
                </div>
            </div>
        )
    }

    return <SettingsView user={user || null} />
}
