"use client"

import React, { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import {
    IconMapPin,
    IconPlus,
    IconPencil,
    IconTrash,
    IconLoader2,
    IconLocation,
    IconCircleCheck,
    IconCircleX
} from "@tabler/icons-react"
import { trpc } from "@/lib/trpc/client"
import { type OfficeLocation } from "@/lib/services/geofence.service"

interface LocationForm {
    name: string
    address: string
    latitude: string
    longitude: string
    radiusMeters: number
    isActive: boolean
}

const defaultForm: LocationForm = {
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    radiusMeters: 200,
    isActive: true,
}

export function AdminOfficeLocations() {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState<LocationForm>(defaultForm)
    const [isGettingLocation, setIsGettingLocation] = useState(false)

    const utils = trpc.useUtils()

    const { data: locations, isLoading } = trpc.admin.officeLocations.getAll.useQuery()

    const addLocation = trpc.admin.officeLocations.add.useMutation({
        onSuccess: () => {
            toast.success('Office location added successfully')
            utils.admin.officeLocations.getAll.invalidate()
            setIsDialogOpen(false)
            setForm(defaultForm)
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to add location')
        },
    })

    const updateLocation = trpc.admin.officeLocations.update.useMutation({
        onSuccess: () => {
            toast.success('Office location updated successfully')
            utils.admin.officeLocations.getAll.invalidate()
            setIsDialogOpen(false)
            setForm(defaultForm)
            setEditingId(null)
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to update location')
        },
    })

    const deleteLocation = trpc.admin.officeLocations.delete.useMutation({
        onSuccess: () => {
            toast.success('Office location deleted')
            utils.admin.officeLocations.getAll.invalidate()
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to delete location')
        },
    })

    const handleEdit = useCallback((location: OfficeLocation) => {
        setEditingId(location.id)
        setForm({
            name: location.name,
            address: location.address || '',
            latitude: String(location.latitude),
            longitude: String(location.longitude),
            radiusMeters: location.radiusMeters,
            isActive: location.isActive,
        })
        setIsDialogOpen(true)
    }, [])

    const handleDelete = useCallback((id: string, name: string) => {
        if (confirm(`Are you sure you want to delete "${name}"?`)) {
            deleteLocation.mutate({ id })
        }
    }, [deleteLocation])

    const handleGetCurrentLocation = useCallback(async () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by this browser')
            return
        }

        setIsGettingLocation(true)
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0,
                })
            })

            setForm(prev => ({
                ...prev,
                latitude: position.coords.latitude.toFixed(7),
                longitude: position.coords.longitude.toFixed(7),
            }))
            toast.success('Location captured!')
        } catch (error: unknown) {
            const geoError = error as GeolocationPositionError
            console.error('Geolocation error:', geoError.code, geoError.message)

            switch (geoError.code) {
                case 1: // PERMISSION_DENIED
                    toast.error('Location permission denied. Please enable location access in your browser settings.')
                    break
                case 2: // POSITION_UNAVAILABLE
                    toast.error('Location unavailable. Try entering coordinates manually from Google Maps.')
                    break
                case 3: // TIMEOUT
                    toast.error('Location request timed out. Please try again or enter coordinates manually.')
                    break
                default:
                    toast.error('Unable to get location. Try entering coordinates manually from Google Maps.')
            }
        } finally {
            setIsGettingLocation(false)
        }
    }, [])

    const handleSubmit = useCallback(() => {
        const lat = parseFloat(form.latitude)
        const lng = parseFloat(form.longitude)

        if (!form.name.trim()) {
            toast.error('Please enter a location name')
            return
        }

        if (isNaN(lat) || lat < -90 || lat > 90) {
            toast.error('Please enter a valid latitude (-90 to 90)')
            return
        }

        if (isNaN(lng) || lng < -180 || lng > 180) {
            toast.error('Please enter a valid longitude (-180 to 180)')
            return
        }

        if (editingId) {
            updateLocation.mutate({
                id: editingId,
                name: form.name,
                address: form.address || undefined,
                latitude: lat,
                longitude: lng,
                radiusMeters: form.radiusMeters,
                isActive: form.isActive,
            })
        } else {
            addLocation.mutate({
                name: form.name,
                address: form.address || undefined,
                latitude: lat,
                longitude: lng,
                radiusMeters: form.radiusMeters,
            })
        }
    }, [form, editingId, addLocation, updateLocation])

    const handleDialogClose = useCallback(() => {
        setIsDialogOpen(false)
        setForm(defaultForm)
        setEditingId(null)
    }, [])

    const isSubmitting = addLocation.isPending || updateLocation.isPending

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <IconMapPin className="w-5 h-5" />
                            Office Locations
                        </CardTitle>
                        <CardDescription>
                            Manage office locations for attendance geofencing
                        </CardDescription>
                    </div>
                    <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                        <IconPlus className="w-4 h-4" />
                        Add Location
                    </Button>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <IconLoader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : !locations?.length ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <IconMapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No office locations configured</p>
                            <p className="text-sm">Add your first office location to enable geofencing</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Address</TableHead>
                                    <TableHead>Coordinates</TableHead>
                                    <TableHead>Radius</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {locations.map((location) => (
                                    <TableRow key={location.id}>
                                        <TableCell className="font-medium">
                                            {location.name}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                                            {location.address || '-'}
                                        </TableCell>
                                        <TableCell className="font-mono text-sm">
                                            {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                                        </TableCell>
                                        <TableCell>{location.radiusMeters}m</TableCell>
                                        <TableCell>
                                            {location.isActive ? (
                                                <span className="inline-flex items-center gap-1 text-green-600">
                                                    <IconCircleCheck className="w-4 h-4" />
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                                    <IconCircleX className="w-4 h-4" />
                                                    Inactive
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEdit(location)}
                                                >
                                                    <IconPencil className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(location.id, location.name)}
                                                    disabled={deleteLocation.isPending}
                                                >
                                                    <IconTrash className="w-4 h-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingId ? 'Edit Office Location' : 'Add Office Location'}
                        </DialogTitle>
                        <DialogDescription>
                            Configure the office location and geofence radius
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Location Name *</Label>
                            <Input
                                id="name"
                                value={form.name}
                                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g., Main Office, Branch Office"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="address">Address</Label>
                            <Input
                                id="address"
                                value={form.address}
                                onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
                                placeholder="Full address (optional)"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="latitude">Latitude *</Label>
                                <Input
                                    id="latitude"
                                    value={form.latitude}
                                    onChange={(e) => setForm(prev => ({ ...prev, latitude: e.target.value }))}
                                    placeholder="e.g., 28.6139"
                                    type="number"
                                    step="0.0000001"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="longitude">Longitude *</Label>
                                <Input
                                    id="longitude"
                                    value={form.longitude}
                                    onChange={(e) => setForm(prev => ({ ...prev, longitude: e.target.value }))}
                                    placeholder="e.g., 77.2090"
                                    type="number"
                                    step="0.0000001"
                                />
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            onClick={handleGetCurrentLocation}
                            disabled={isGettingLocation}
                            className="w-full gap-2"
                        >
                            {isGettingLocation ? (
                                <IconLoader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <IconLocation className="w-4 h-4" />
                            )}
                            Use Current Location
                        </Button>

                        <p className="text-xs text-muted-foreground text-center">
                            💡 <strong>Tip:</strong> If location doesn't work, get coordinates from{' '}
                            <a
                                href="https://www.google.com/maps"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline"
                            >
                                Google Maps
                            </a>{' '}
                            (right-click on location → copy coordinates)
                        </p>

                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <Label>Geofence Radius</Label>
                                <span className="text-sm font-medium">{form.radiusMeters}m</span>
                            </div>
                            <Slider
                                value={[form.radiusMeters]}
                                onValueChange={(values: number[]) => setForm(prev => ({ ...prev, radiusMeters: values[0] }))}
                                min={50}
                                max={1000}
                                step={50}
                            />
                            <p className="text-xs text-muted-foreground">
                                Employees within this radius can mark attendance
                            </p>
                        </div>

                        {editingId && (
                            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                                <div>
                                    <p className="text-sm font-medium">Active Status</p>
                                    <p className="text-xs text-muted-foreground">
                                        Inactive locations won&apos;t allow attendance marking
                                    </p>
                                </div>
                                <Switch
                                    checked={form.isActive}
                                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, isActive: checked }))}
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={handleDialogClose}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting && <IconLoader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {editingId ? 'Update' : 'Add'} Location
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

export default AdminOfficeLocations
