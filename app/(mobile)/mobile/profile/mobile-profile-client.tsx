"use client"

import { useState, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from 'sonner'
import {
    IconCamera,
    IconUser,
    IconMail,
    IconPhone,
    IconBriefcase,
    IconLogout,
    IconLoader2,
    IconCheck,
} from "@tabler/icons-react"
import { trpc } from '@/lib/trpc/client'
import { createClient } from '@/lib/supabase/client'

interface MobileProfileClientProps {
    profile: {
        id: string
        full_name: string | null
        email: string
        avatar_url: string | null
        mobile_no: string | null
        designation: { name: string } | null
        avatar_status: string | null
    }
}

export function MobileProfileClient({ profile }: MobileProfileClientProps) {
    const [isUploading, setIsUploading] = useState(false)
    const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
    const [avatarStatus, setAvatarStatus] = useState(profile.avatar_status)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file')
            return
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be less than 5MB')
            return
        }

        setIsUploading(true)

        try {
            // Upload to Supabase Storage
            const fileName = `${profile.id}-${Date.now()}.${file.name.split('.').pop()}`
            const { error: uploadError, data } = await supabase.storage
                .from('avatars')
                .upload(fileName, file, {
                    upsert: true,
                })

            if (uploadError) throw uploadError

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName)

            // Update profile
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    avatar_url: publicUrl,
                    avatar_status: 'custom'
                })
                .eq('id', profile.id)

            if (updateError) throw updateError

            setAvatarUrl(publicUrl)
            setAvatarStatus('custom')
            toast.success('Profile photo updated!')
        } catch (error) {
            console.error('Upload error:', error)
            toast.error('Failed to upload photo')
        } finally {
            setIsUploading(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        window.location.href = '/login'
    }

    return (
        <div className="space-y-6">
            {/* Profile Header */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col items-center">
                        {/* Avatar with Camera Link */}
                        <div className="relative mb-4">
                            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                                <AvatarImage src={avatarUrl || ''} alt={profile.full_name || ''} key={avatarUrl} />
                                <AvatarFallback className="text-2xl">
                                    {profile.full_name?.charAt(0) || profile.email.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <Link
                                href="/mobile/update-photo"
                                className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
                            >
                                <IconCamera className="w-4 h-4" />
                            </Link>
                        </div>

                        <h2 className="text-xl font-semibold">
                            {profile.full_name || 'Employee'}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {profile.designation?.name || 'Team Member'}
                        </p>

                        {avatarStatus === 'custom' ? (
                            <div className="mt-3 px-3 py-2 rounded-lg bg-green-500/10 text-green-600 text-sm text-center">
                                <IconCheck className="w-4 h-4 inline mr-1" />
                                Photo Verified - Ready for Attendance
                            </div>
                        ) : (
                            <Link href="/mobile/update-photo" className="block mt-3">
                                <div className="px-3 py-2 rounded-lg bg-amber-500/10 text-amber-600 text-sm text-center hover:bg-amber-500/20 transition-colors cursor-pointer">
                                    <IconCamera className="w-4 h-4 inline mr-1" />
                                    Tap here to take a selfie
                                </div>
                            </Link>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Profile Details */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Profile Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                            <IconUser className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Full Name</p>
                            <p className="font-medium">{profile.full_name || 'Not set'}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                            <IconMail className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Email</p>
                            <p className="font-medium">{profile.email}</p>
                        </div>
                    </div>

                    {profile.mobile_no && (
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-muted">
                                <IconPhone className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Phone</p>
                                <p className="font-medium">{profile.mobile_no}</p>
                            </div>
                        </div>
                    )}

                    {profile.designation?.name && (
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-muted">
                                <IconBriefcase className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Designation</p>
                                <p className="font-medium">{profile.designation.name}</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Logout Button */}
            <Button
                variant="outline"
                className="w-full gap-2 text-destructive hover:text-destructive"
                onClick={handleLogout}
            >
                <IconLogout className="w-5 h-5" />
                Sign Out
            </Button>
        </div>
    )
}
