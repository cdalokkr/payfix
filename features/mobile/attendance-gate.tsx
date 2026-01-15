"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    IconAlertCircle,
    IconPhoto,
    IconMapPin,
    IconLogin,
    IconLogout,
    IconLoader2,
} from "@tabler/icons-react"
import { trpc } from "@/lib/trpc/client"
import { MobileAttendanceWizard } from "./mobile-attendance-wizard"

interface AttendanceGateProps {
    profileImageUrl: string | null
    hasProfileImage: boolean
}

export function AttendanceGate({ profileImageUrl, hasProfileImage }: AttendanceGateProps) {
    const [showWizard, setShowWizard] = useState(false)
    const [wizardAction, setWizardAction] = useState<'clock_in' | 'clock_out'>('clock_in')

    // Get today's attendance status using IST date
    const { data: todayStatus, isLoading: statusLoading } = trpc.attendance.getTodayStatus.useQuery({
        localDate: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' }),
    })

    // Get active office locations
    const { data: locations, isLoading: locationsLoading } = trpc.officeLocations.getActive.useQuery()

    const isLoading = statusLoading || locationsLoading
    const hasOfficeLocations = (locations?.length ?? 0) > 0

    // Determine button states
    const canClockIn = todayStatus?.status === 'not_clocked_in'
    const canClockOut = todayStatus?.status === 'clocked_in'
    const isMarked = todayStatus?.status === 'marked'

    // Check blockers
    const blockers: { type: 'profile' | 'location'; message: string; action?: string }[] = []

    if (!hasProfileImage) {
        blockers.push({
            type: 'profile',
            message: 'Please upload a profile photo to enable attendance marking',
            action: 'Upload Photo',
        })
    }

    if (!hasOfficeLocations) {
        blockers.push({
            type: 'location',
            message: 'No office locations configured. Please contact your administrator.',
        })
    }

    const isBlocked = blockers.length > 0

    const handleClockIn = () => {
        if (isBlocked) return
        setWizardAction('clock_in')
        setShowWizard(true)
    }

    const handleClockOut = () => {
        if (isBlocked) return
        setWizardAction('clock_out')
        setShowWizard(true)
    }

    const handleWizardComplete = () => {
        setShowWizard(false)
    }

    const handleWizardCancel = () => {
        setShowWizard(false)
    }

    // Show wizard if active
    if (showWizard) {
        return (
            <MobileAttendanceWizard
                action={wizardAction}
                profileImageUrl={profileImageUrl}
                onComplete={handleWizardComplete}
                onCancel={handleWizardCancel}
            />
        )
    }

    return (
        <div className="space-y-4">
            {/* Blockers */}
            {blockers.map((blocker, index) => (
                <Alert key={index} variant="destructive">
                    {blocker.type === 'profile' ? (
                        <IconPhoto className="h-4 w-4" />
                    ) : (
                        <IconMapPin className="h-4 w-4" />
                    )}
                    <AlertDescription className="flex items-center justify-between">
                        <span>{blocker.message}</span>
                        {blocker.action && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="ml-4"
                                onClick={() => {
                                    // Navigate to profile page
                                    window.location.href = '/employee/profile'
                                }}
                            >
                                {blocker.action}
                            </Button>
                        )}
                    </AlertDescription>
                </Alert>
            ))}

            {/* Attendance Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Today's Attendance</CardTitle>
                    <CardDescription>
                        {new Date().toLocaleDateString('en-IN', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <IconLoader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : isMarked ? (
                        <div className="text-center py-6">
                            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                                <IconAlertCircle className="w-8 h-8 text-green-500" />
                            </div>
                            <p className="text-lg font-medium text-green-600">
                                Attendance Marked ✓
                            </p>
                            <p className="text-sm text-muted-foreground">
                                You have completed today's attendance
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                onClick={handleClockIn}
                                disabled={!canClockIn || isBlocked}
                                className="h-24 flex-col gap-2"
                                variant={canClockIn && !isBlocked ? "default" : "outline"}
                            >
                                <IconLogin className="w-6 h-6" />
                                <span>Office In</span>
                            </Button>
                            <Button
                                onClick={handleClockOut}
                                disabled={!canClockOut || isBlocked}
                                className="h-24 flex-col gap-2"
                                variant={canClockOut && !isBlocked ? "default" : "outline"}
                            >
                                <IconLogout className="w-6 h-6" />
                                <span>Office Out</span>
                            </Button>
                        </div>
                    )}

                    {/* Status indicator */}
                    {!isLoading && !isMarked && (
                        <div className="text-center pt-2">
                            <span className={`text-sm ${canClockIn ? 'text-amber-600' :
                                canClockOut ? 'text-blue-600' :
                                    'text-muted-foreground'
                                }`}>
                                {canClockIn ? '⏰ Not clocked in yet' :
                                    canClockOut ? '🕐 Clock out to complete attendance' :
                                        'Status unknown'}
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Info about geofencing */}
            {!isBlocked && hasOfficeLocations && (
                <p className="text-xs text-center text-muted-foreground">
                    📍 Attendance requires you to be at an office location
                </p>
            )}
        </div>
    )
}

export default AttendanceGate
