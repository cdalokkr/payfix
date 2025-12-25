"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { trpc } from "@/lib/trpc/client"
import { format } from "date-fns"
import { Check, X, Search, User, Edit2, Loader2, Clock, CheckCircle2, XCircle, FileText } from "lucide-react"
import { toast } from "sonner"
import { ModernDialog, ModernDialogContent, ModernDialogHeader, ModernDialogTitle, ModernDialogDescription } from "@/components/ui/modern-dialog"
import { Label } from "@/components/ui/label"
import { MetricCard } from "@/components/dashboard/metric-card"

export function AdminAttendanceVerification() {
    const [searchTerm, setSearchTerm] = useState("")
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [selectedRecord, setSelectedRecord] = useState<any>(null)

    const utils = trpc.useUtils()
    const { data: attendance, isLoading } = trpc.attendance.getAttendance.useQuery({})

    const verifyMutation = trpc.attendance.verifyAttendance.useMutation({
        onSuccess: (data) => {
            toast.success(`Attendance marked as ${data.status}`)
            utils.attendance.getAttendance.invalidate()
        },
        onError: (error) => toast.error(error.message)
    })

    const manualUpdateMutation = trpc.attendance.manualUpdate.useMutation({
        onSuccess: () => {
            toast.success("Record updated successfully")
            setIsEditOpen(false)
            utils.attendance.getAttendance.invalidate()
        },
        onError: (error) => toast.error(error.message)
    })

    const filteredAttendance = attendance?.filter(record =>
        record.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.profile?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleEdit = (record: any) => {
        setSelectedRecord(record)
        setIsEditOpen(true)
    }

    const stats = {
        total: filteredAttendance?.length || 0,
        pending: filteredAttendance?.filter(a => a.status === 'pending').length || 0,
        verified: filteredAttendance?.filter(a => a.status === 'verified').length || 0,
        rejected: filteredAttendance?.filter(a => a.status === 'rejected').length || 0,
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Total Logs"
                    value={stats.total.toString()}
                    icon={<FileText />}
                    iconBgColor="bg-blue-500/20"
                    iconColor="text-blue-700 dark:text-blue-400"
                    borderColor="border-blue-200/50 dark:border-blue-900/50"
                    cardBgColor="bg-blue-50/50 dark:bg-blue-900/5"
                    delay={0.1}
                />
                <MetricCard
                    title="Pending"
                    value={stats.pending.toString()}
                    icon={<Clock />}
                    iconBgColor="bg-amber-500/20"
                    iconColor="text-amber-700 dark:text-amber-400"
                    borderColor="border-amber-200/50 dark:border-amber-900/50"
                    cardBgColor="bg-amber-50/50 dark:bg-amber-900/5"
                    delay={0.2}
                />
                <MetricCard
                    title="Verified"
                    value={stats.verified.toString()}
                    icon={<CheckCircle2 />}
                    iconBgColor="bg-emerald-500/20"
                    iconColor="text-emerald-700 dark:text-emerald-400"
                    borderColor="border-emerald-200/50 dark:border-emerald-900/50"
                    cardBgColor="bg-emerald-50/50 dark:bg-emerald-900/5"
                    delay={0.3}
                />
                <MetricCard
                    title="Rejected"
                    value={stats.rejected.toString()}
                    icon={<XCircle />}
                    iconBgColor="bg-rose-500/20"
                    iconColor="text-rose-700 dark:text-rose-400"
                    borderColor="border-rose-200/50 dark:border-rose-900/50"
                    cardBgColor="bg-rose-50/50 dark:bg-rose-900/5"
                    delay={0.4}
                />
            </div>

            <Card className="border-none shadow-md overflow-hidden bg-card/50 backdrop-blur-sm">
                <CardHeader className="bg-muted/30 pb-6 border-b">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-xl font-bold">Attendance Verification</CardTitle>
                            <CardDescription>Review and approve employee daily logs</CardDescription>
                        </div>
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search employee..."
                                className="pl-10 h-10 bg-background/50 border-muted-foreground/20 focus:border-primary transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Check In</TableHead>
                                    <TableHead>Check Out</TableHead>
                                    <TableHead>Hours</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAttendance?.map((record) => (
                                    <TableRow key={record.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{record.profile?.full_name || 'N/A'}</span>
                                                <span className="text-xs text-muted-foreground">{record.profile?.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{format(new Date(record.date), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell>{record.check_in ? format(new Date(record.check_in), 'hh:mm a') : '--'}</TableCell>
                                        <TableCell>{record.check_out ? format(new Date(record.check_out), 'hh:mm a') : '--'}</TableCell>
                                        <TableCell>{record.working_hours ? `${record.working_hours.toFixed(2)}h` : '--'}</TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                record.status === 'verified' ? 'success' as any :
                                                    record.status === 'rejected' ? 'destructive' : 'secondary'
                                            }>
                                                {record.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                {record.status === 'pending' && (
                                                    <>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                            onClick={() => verifyMutation.mutate({ id: record.id, status: 'verified' })}
                                                            disabled={verifyMutation.isPending}
                                                        >
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => verifyMutation.mutate({ id: record.id, status: 'rejected' })}
                                                            disabled={verifyMutation.isPending}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                )}
                                                <Button size="icon" variant="ghost" onClick={() => handleEdit(record)}>
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {(!filteredAttendance || filteredAttendance.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                            No records found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Manual Update Dialog */}
            <ModernDialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <ModernDialogContent size="md">
                    <ModernDialogHeader>
                        <ModernDialogTitle>Edit Attendance Record</ModernDialogTitle>
                        <ModernDialogDescription>Manually adjust attendance details for this employee.</ModernDialogDescription>
                    </ModernDialogHeader>
                    {selectedRecord && (
                        <form className="space-y-4 pt-4" onSubmit={(e) => {
                            e.preventDefault()
                            const formData = new FormData(e.currentTarget)
                            manualUpdateMutation.mutate({
                                id: selectedRecord.id,
                                status: formData.get('status') as any,
                                remarks: formData.get('remarks') as string,
                            })
                        }}>
                            <div className="space-y-2">
                                <Label>Employee</Label>
                                <div className="p-3 bg-muted/50 rounded-lg text-sm border">
                                    <div className="font-semibold">{selectedRecord.profile?.full_name}</div>
                                    <div className="text-muted-foreground">{selectedRecord.profile?.email}</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Status</Label>
                                <select
                                    name="status"
                                    defaultValue={selectedRecord.status}
                                    className="w-full p-2.5 bg-background border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="verified">Verified</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label>Remarks</Label>
                                <Input name="remarks" defaultValue={selectedRecord.remarks || ""} placeholder="Add a reason for correction..." className="h-10" />
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t mt-6">
                                <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={manualUpdateMutation.isPending} className="px-6 ring-offset-2 hover:ring-2 ring-primary/20 transition-all">
                                    {manualUpdateMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    )}
                </ModernDialogContent>
            </ModernDialog>
        </div>
    )
}
