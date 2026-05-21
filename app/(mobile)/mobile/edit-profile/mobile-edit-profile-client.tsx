"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from 'sonner'
import { motion } from "framer-motion"
import {
    ArrowLeft as IconArrowLeft,
    User as IconUser,
    Phone as IconPhone,
    Calendar as IconCalendar,
    Loader2 as IconLoader2,
    Check as IconCheck,
    Save as IconDeviceFloppy,
} from "lucide-react"
import { trpc } from '@/lib/trpc/client'
import { Calendar28 } from "@/components/ui/calendar-28"

interface MobileEditProfileClientProps {
    profile: {
        id: string
        first_name: string | null
        last_name: string | null
        middle_name: string | null
        full_name: string | null
        email: string
        mobile_no: string | null
        date_of_birth: string | null
        sex: string | null
    }
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error'

export function MobileEditProfileClient({ profile }: MobileEditProfileClientProps) {
    const router = useRouter()
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
    const utils = trpc.useUtils()

    // Form state
    const [firstName, setFirstName] = useState(profile.first_name || '')
    const [lastName, setLastName] = useState(profile.last_name || '')
    const [middleName, setMiddleName] = useState(profile.middle_name || '')
    const [mobileNo, setMobileNo] = useState(profile.mobile_no || '')
    const [dateOfBirth, setDateOfBirth] = useState(profile.date_of_birth || '')
    const [sex, setSex] = useState<string>(profile.sex || '')

    // Update mutation
    const updateMutation = trpc.profile.update.useMutation({
        onSuccess: () => {
            toast.success('Profile updated successfully!')
            setSaveStatus('success')
            utils.profile.get.invalidate()
            setTimeout(() => {
                router.push('/mobile/profile')
            }, 1000)
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to update profile')
            setSaveStatus('error')
            setTimeout(() => setSaveStatus('idle'), 2000)
        }
    })

    const handleSave = () => {
        setSaveStatus('saving')

        // Validate required fields
        if (!firstName.trim()) {
            toast.error('First name is required')
            setSaveStatus('idle')
            return
        }
        if (!lastName.trim()) {
            toast.error('Last name is required')
            setSaveStatus('idle')
            return
        }

        // Validate mobile number format
        if (mobileNo && !/^\d{10}$/.test(mobileNo)) {
            toast.error('Mobile number must be exactly 10 digits')
            setSaveStatus('idle')
            return
        }

        updateMutation.mutate({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            middleName: middleName.trim() || undefined,
            mobileNo: mobileNo || undefined,
            dateOfBirth: dateOfBirth || undefined,
            sex: sex as 'male' | 'female' | undefined,
        })
    }

    return (
        <div className="min-h-screen bg-background pb-24">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b">
                <div className="flex items-center gap-3 px-4 h-14">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.back()}
                        className="rounded-xl"
                    >
                        <IconArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-lg font-bold">Edit Profile</h1>
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={saveStatus === 'saving'}
                        className="rounded-xl px-4"
                    >
                        {saveStatus === 'saving' ? (
                            <>
                                <IconLoader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : saveStatus === 'success' ? (
                            <>
                                <IconCheck className="w-4 h-4 mr-2" />
                                Saved!
                            </>
                        ) : (
                            <>
                                <IconDeviceFloppy className="w-4 h-4 mr-2" />
                                Save
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Form Content */}
            <div className="p-4 space-y-4">
                {/* Personal Information Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <IconUser className="w-5 h-5 text-primary" />
                                Personal Information
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Update your basic details
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName" className="text-xs font-medium">
                                        First Name *
                                    </Label>
                                    <Input
                                        id="firstName"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="First name"
                                        className="rounded-xl h-11"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName" className="text-xs font-medium">
                                        Last Name *
                                    </Label>
                                    <Input
                                        id="lastName"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="Last name"
                                        className="rounded-xl h-11"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="middleName" className="text-xs font-medium">
                                    Middle Name (Optional)
                                </Label>
                                <Input
                                    id="middleName"
                                    value={middleName}
                                    onChange={(e) => setMiddleName(e.target.value)}
                                    placeholder="Middle name"
                                    className="rounded-xl h-11"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="sex" className="text-xs font-medium">
                                    Gender
                                </Label>
                                <Select value={sex} onValueChange={setSex}>
                                    <SelectTrigger className="rounded-xl h-11">
                                        <SelectValue placeholder="Select gender" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="male">Male</SelectItem>
                                        <SelectItem value="female">Female</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Contact Information Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <IconPhone className="w-5 h-5 text-primary" />
                                Contact Information
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Your contact details
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-muted-foreground">
                                    Email (Read-only)
                                </Label>
                                <Input
                                    value={profile.email}
                                    disabled
                                    className="rounded-xl h-11 bg-muted/50"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="mobileNo" className="text-xs font-medium">
                                    Mobile Number
                                </Label>
                                <Input
                                    id="mobileNo"
                                    value={mobileNo}
                                    onChange={(e) => setMobileNo(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                    placeholder="10-digit mobile number"
                                    className="rounded-xl h-11"
                                    inputMode="numeric"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Enter 10-digit mobile number without country code
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Date of Birth Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <IconCalendar className="w-5 h-5 text-primary" />
                                Date of Birth
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <Calendar28
                                    id="dateOfBirth"
                                    value={dateOfBirth && dateOfBirth.includes('-') ? (() => {
                                        const [year, month, day] = dateOfBirth.split('-')
                                        return `${day}/${month}/${year}`
                                    })() : dateOfBirth || ""}
                                    onChange={(value) => {
                                        if (value) {
                                            const [day, month, year] = value.split('/')
                                            if (day && month && year) {
                                                setDateOfBirth(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
                                            }
                                        } else {
                                            setDateOfBirth("")
                                        }
                                    }}
                                    label=""
                                    className="rounded-xl h-11 border border-input"
                                    removeSpacing={true}
                                    minAge={13}
                                    maxAge={120}
                                    defaultAge={18}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    )
}
