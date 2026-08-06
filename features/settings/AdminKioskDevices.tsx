'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Monitor, Key, MapPin, Plus, Trash2, Copy, ExternalLink, ShieldCheck, Zap, RefreshCw, Check, Tablet } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import Link from 'next/link'

export function AdminKioskDevices() {
    const utils = trpc.useUtils()
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [name, setName] = useState('')
    const [locationId, setLocationId] = useState<string>('')
    const [copiedCode, setCopiedCode] = useState<string | null>(null)

    const { data: devices, isLoading: isDevicesLoading } = trpc.admin.kioskDevices.getAll.useQuery()
    const { data: locations } = trpc.admin.officeLocations.getAll.useQuery()

    const createMutation = trpc.admin.kioskDevices.create.useMutation({
        onSuccess: (newDevice) => {
            toast.success(`Kiosk device "${newDevice.name}" registered! Pairing Code: ${newDevice.pairing_code}`)
            setIsAddOpen(false)
            setName('')
            setLocationId('')
            utils.admin.kioskDevices.getAll.invalidate()
        },
        onError: (err) => {
            toast.error(err.message || 'Failed to register kiosk device')
        }
    })

    const deleteMutation = trpc.admin.kioskDevices.delete.useMutation({
        onSuccess: () => {
            toast.success('Kiosk device removed')
            utils.admin.kioskDevices.getAll.invalidate()
        },
        onError: (err) => {
            toast.error(err.message || 'Failed to remove device')
        }
    })

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) {
            toast.error('Device name is required')
            return
        }
        createMutation.mutate({
            name: name.trim(),
            locationId: locationId && locationId !== 'none' ? locationId : null,
        })
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        setCopiedCode(text)
        toast.success('Pairing code copied to clipboard!')
        setTimeout(() => setCopiedCode(null), 3000)
    }

    const kioskUrl = typeof window !== 'undefined' ? `${window.location.origin}/kiosk` : '/kiosk'

    return (
        <div className="space-y-6">
            {/* Header & Launch Kiosk Section */}
            <Card className="border-border bg-card shadow-sm">
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                                <Monitor className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-bold text-foreground">
                                    Express Selfie Kiosk Terminals
                                </CardTitle>
                                <CardDescription className="text-muted-foreground mt-0.5">
                                    Register entrance tablet terminals, bind them to Geofenced Office Locations, and pair securely using Kiosk Keys.
                                </CardDescription>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                onClick={() => setIsAddOpen(true)}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                            >
                                <Plus className="h-4 w-4 mr-2" /> Register Kiosk Device
                            </Button>
                            <Button asChild variant="outline" className="border-sky-500/30 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 font-semibold">
                                <Link href="/kiosk" target="_blank">
                                    Launch Kiosk <ExternalLink className="h-4 w-4 ml-1.5" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-4 rounded-xl bg-muted/40 border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                        <div className="space-y-1">
                            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Universal Kiosk Terminal URL</div>
                            <code className="text-sm font-mono font-bold text-sky-600 dark:text-sky-400">
                                {kioskUrl}
                            </code>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(kioskUrl)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Link
                        </Button>
                    </div>

                    {/* Features Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm pt-2">
                        <div className="p-3.5 rounded-xl bg-card border border-border space-y-1">
                            <div className="flex items-center gap-2 font-bold text-foreground">
                                <Key className="h-4 w-4 text-amber-500" /> Pairing Key Security
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Terminals require an authentic Kiosk Key. Only your company&apos;s employees are loaded.
                            </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-card border border-border space-y-1">
                            <div className="flex items-center gap-2 font-bold text-foreground">
                                <MapPin className="h-4 w-4 text-emerald-500" /> GPS Geofence Bound
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Terminal punches are verified against assigned Office Location coordinates.
                            </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-card border border-border space-y-1">
                            <div className="flex items-center gap-2 font-bold text-foreground">
                                <Zap className="h-4 w-4 text-sky-500" /> 100% Offline Mode
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Works seamlessly during internet outages, queuing punches locally and auto-syncing when online.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Registered Devices List */}
            <Card className="border-border bg-card shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold text-foreground flex items-center justify-between">
                        <span>Paired Kiosk Terminals ({devices?.length || 0})</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => utils.admin.kioskDevices.getAll.invalidate()}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isDevicesLoading ? (
                        <div className="py-8 text-center text-muted-foreground text-sm">
                            Loading registered kiosk devices...
                        </div>
                    ) : !devices || devices.length === 0 ? (
                        <div className="py-12 text-center border-2 border-dashed border-border rounded-xl space-y-3">
                            <div className="mx-auto w-12 h-12 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center">
                                <Tablet className="h-6 w-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-foreground">No Kiosk Devices Registered</h4>
                                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                                    Register your first office entrance tablet/device to generate a secure Pairing Key and bind it to a Geofenced Location.
                                </p>
                            </div>
                            <Button onClick={() => setIsAddOpen(true)} size="sm" className="mt-2 font-semibold">
                                <Plus className="h-4 w-4 mr-1.5" /> Register Kiosk Device
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {devices.map((device) => (
                                <div
                                    key={device.id}
                                    className="p-4 rounded-xl bg-card border border-border hover:border-sky-500/30 transition-all space-y-3 shadow-xs"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-foreground text-base">{device.name}</h4>
                                                <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                                                    Active
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <MapPin className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                                                <span>
                                                    {device.locationName
                                                        ? `${device.locationName} (${device.locationRadius || 200}m geofence)`
                                                        : 'No Location Bound (Global)'}
                                                </span>
                                            </div>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => deleteMutation.mutate({ id: device.id })}
                                            className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 h-8 w-8"
                                            title="Remove Device"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* Pairing Key Box */}
                                    <div className="p-3 rounded-lg bg-muted/60 border border-border flex items-center justify-between gap-2">
                                        <div className="space-y-0.5">
                                            <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">Pairing Key</div>
                                            <code className="text-sm font-mono font-bold text-sky-600 dark:text-sky-400 tracking-wider">
                                                {device.pairingCode}
                                            </code>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => copyToClipboard(device.pairingCode)}
                                            className="h-8 text-xs font-bold gap-1"
                                        >
                                            {copiedCode === device.pairingCode ? (
                                                <>
                                                    <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="h-3.5 w-3.5" /> Copy Key
                                                </>
                                            )}
                                        </Button>
                                    </div>

                                    {device.lastSeenAt && (
                                        <div className="text-[11px] text-muted-foreground text-right">
                                            Last Active: {new Date(device.lastSeenAt).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Register Kiosk Device Modal */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Tablet className="h-5 w-5 text-sky-500" /> Register Kiosk Device
                        </DialogTitle>
                        <DialogDescription>
                            Create a new entrance terminal record. A unique Pairing Key will be generated automatically.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreate} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="device-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Device Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="device-name"
                                placeholder="e.g. Main Gate Tablet #1, Reception iPad"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="font-medium"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="device-location" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Assign Office Location (GPS Geofence)
                            </Label>
                            <Select value={locationId} onValueChange={setLocationId}>
                                <SelectTrigger id="device-location">
                                    <SelectValue placeholder="Select Office Location..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No Location Bound (Global Access)</SelectItem>
                                    {locations?.map((loc) => (
                                        <SelectItem key={loc.id} value={loc.id}>
                                            📍 {loc.name} ({loc.radiusMeters || (loc as any).radius_meters || 200}m radius)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-muted-foreground">
                                Geofence verification will ensure punches are only accepted when the terminal is physically inside this office boundary.
                            </p>
                        </div>

                        <DialogFooter className="pt-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsAddOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={createMutation.isPending || (createMutation as any).isLoading || !name.trim()}
                                className="bg-sky-600 hover:bg-sky-700 text-white font-bold"
                            >
                                {createMutation.isPending || (createMutation as any).isLoading ? 'Generating Key...' : 'Register & Generate Key'}
                            </Button>
                        </DialogFooter>

                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
