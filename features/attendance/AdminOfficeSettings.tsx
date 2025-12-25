"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { format } from "date-fns"
import { Settings, Plus, Trash2, Calendar, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function AdminOfficeSettings() {
    const [closureDate, setClosureDate] = useState("")
    const [closureReason, setClosureReason] = useState("")
    const [closureType, setClosureType] = useState<'holiday' | 'closed'>('holiday')

    const utils = trpc.useUtils()
    const { data: settings } = trpc.attendance.getOfficeSettings.useQuery()
    const { data: closures } = trpc.attendance.getOfficeClosures.useQuery()

    const updateSettingsMutation = trpc.attendance.updateOfficeSettings.useMutation({
        onSuccess: () => {
            toast.success("Office settings updated")
            utils.attendance.getOfficeSettings.invalidate()
        },
        onError: (error) => toast.error(error.message)
    })

    const addClosureMutation = trpc.attendance.addOfficeClosure.useMutation({
        onSuccess: () => {
            toast.success("Office closure added")
            utils.attendance.getOfficeClosures.invalidate()
            setClosureDate("")
            setClosureReason("")
        },
        onError: (error) => toast.error(error.message)
    })

    const deleteClosureMutation = trpc.attendance.deleteOfficeClosure.useMutation({
        onSuccess: () => {
            toast.success("Office closure removed")
            utils.attendance.getOfficeClosures.invalidate()
        },
        onError: (error) => toast.error(error.message)
    })

    const handleUpdateSettings = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        updateSettingsMutation.mutate({
            defaultCheckIn: formData.get('defaultCheckIn') as string,
            defaultCheckOut: formData.get('defaultCheckOut') as string,
        })
    }

    const handleAddClosure = (e: React.FormEvent) => {
        e.preventDefault()
        if (!closureDate || !closureReason) return toast.error("Please fill all fields")
        addClosureMutation.mutate({
            date: closureDate,
            reason: closureReason,
            type: closureType
        })
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 space-y-6">
                <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b pb-6">
                        <CardTitle className="flex items-center gap-2 text-xl font-bold">
                            <Settings className="size-5 text-primary" /> Default Office Hours
                        </CardTitle>
                        <CardDescription>Set the standard working hours for the organization</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {settings && (
                            <form onSubmit={handleUpdateSettings} className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Default Check-In</Label>
                                        <Input type="time" name="defaultCheckIn" defaultValue={settings.default_check_in.split(':').slice(0, 2).join(':')} required className="h-11 bg-background" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Default Check-Out</Label>
                                        <Input type="time" name="defaultCheckOut" defaultValue={settings.default_check_out.split(':').slice(0, 2).join(':')} required className="h-11 bg-background" />
                                    </div>
                                </div>
                                <Button type="submit" disabled={updateSettingsMutation.isPending} className="w-full h-11 font-semibold transition-all hover:ring-2 ring-primary/20">
                                    {updateSettingsMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                                    Save Company Timing
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b pb-6">
                        <CardTitle className="flex items-center gap-2 text-xl font-bold">
                            <Plus className="size-5 text-primary" /> Add Office Closure
                        </CardTitle>
                        <CardDescription>Mark holidays or specific days when the office is closed</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <form onSubmit={handleAddClosure} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Date</Label>
                                    <Input type="date" value={closureDate} onChange={(e) => setClosureDate(e.target.value)} required className="h-11 bg-background" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</Label>
                                    <select
                                        value={closureType}
                                        onChange={(e) => setClosureType(e.target.value as any)}
                                        className="w-full h-11 p-2 bg-background border rounded-md focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    >
                                        <option value="holiday">Festival Holiday</option>
                                        <option value="closed">Office Closed</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reason</Label>
                                <Input value={closureReason} onChange={(e) => setClosureReason(e.target.value)} placeholder="e.g., Diwali, Annual Maintenance" className="h-11 bg-background" />
                            </div>
                            <Button type="submit" disabled={addClosureMutation.isPending} className="w-full h-11 font-semibold transition-all hover:bg-muted" variant="outline">
                                {addClosureMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                                Add Holiday
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>

            <div className="lg:col-span-7">
                <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm h-full overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b pb-6">
                        <CardTitle className="flex items-center gap-2 text-xl font-bold">
                            <Calendar className="size-5 text-primary" /> Upcoming Closures
                        </CardTitle>
                        <CardDescription>Scheduled holidays and office closures</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-[600px] overflow-auto">
                            <Table>
                                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead className="font-bold py-4">Date</TableHead>
                                        <TableHead className="font-bold py-4">Reason & Type</TableHead>
                                        <TableHead className="text-right font-bold py-4 pr-6">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {closures?.map((closure) => (
                                        <TableRow key={closure.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-medium whitespace-nowrap pl-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                                        <Calendar className="h-4 w-4" />
                                                    </div>
                                                    {format(new Date(closure.date), 'MMM dd, yyyy')}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-medium">{closure.reason}</span>
                                                    <Badge variant="outline" className={cn(
                                                        "w-fit text-[10px] px-2 h-5 font-bold uppercase tracking-wider",
                                                        closure.type === 'holiday' ? "text-amber-600 border-amber-200 bg-amber-50" : "text-rose-600 border-rose-200 bg-rose-50"
                                                    )}>{closure.type}</Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6 py-4">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="text-destructive hover:bg-destructive/10 h-8 w-8 rounded-full"
                                                    onClick={() => deleteClosureMutation.mutate({ id: closure.id })}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {(!closures || closures.length === 0) && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-20 text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Calendar className="h-10 w-10 opacity-20" />
                                                    <p>No closures added yet.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
