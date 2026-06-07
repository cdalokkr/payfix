"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { format } from "date-fns"
import { Plane, Plus, Loader2 } from "lucide-react"
import { ModernDialog, ModernDialogContent, ModernDialogHeader, ModernDialogTitle, ModernDialogDescription } from "@/components/ui/modern-dialog"
import { cn } from "@/lib/utils"
import { useProfile } from "@/lib/context/profile-context"

export function LeaveApplication() {
    const { profile } = useProfile()
    const [isOpen, setIsOpen] = useState(false)
    const [leaveType, setLeaveType] = useState<string>("")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [reason, setReason] = useState("")
    const [isHalfDay, setIsHalfDay] = useState(false)
    const [halfDayPeriod, setHalfDayPeriod] = useState<"morning" | "afternoon">("morning")

    const utils = trpc.useUtils()
    const { data: leaves, isLoading: isLeavesLoading } = trpc.attendance.getLeaves.useQuery({
        profileId: profile?.id
    })

    const applyMutation = trpc.attendance.applyLeave.useMutation({
        onSuccess: () => {
            toast.success("Leave applied successfully")
            setIsOpen(false)
            utils.attendance.getLeaves.invalidate()
            resetForm()
        },
        onError: (error) => {
            toast.error(error.message)
        }
    })

    const resetForm = () => {
        setLeaveType("")
        setStartDate("")
        setEndDate("")
        setReason("")
        setIsHalfDay(false)
        setHalfDayPeriod("morning")
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!startDate || !endDate) return toast.error("Please select dates")
        applyMutation.mutate({
            leaveType,
            startDate,
            endDate,
            reason,
            isHalfDay,
            halfDayPeriod: isHalfDay ? halfDayPeriod : undefined
        })
    }

    return (
        <div className="flex flex-col gap-6">
            <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-6 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <Plane className="size-5 text-primary" /> Leave Records
                        </CardTitle>
                        <CardDescription>Track your leave applications and their status</CardDescription>
                    </div>
                    <Button onClick={() => setIsOpen(true)} className="font-bold shadow-lg shadow-primary/10 transition-all hover:scale-105">
                        <Plus className="mr-2 size-4" /> Apply For Leave
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[600px] overflow-auto">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="font-bold py-4 pl-6">Type</TableHead>
                                    <TableHead className="font-bold py-4 text-center">Start Date</TableHead>
                                    <TableHead className="font-bold py-4 text-center">End Date</TableHead>
                                    <TableHead className="font-bold py-4 text-center">Status</TableHead>
                                    <TableHead className="font-bold py-4 pr-6">Reason</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {leaves?.map((leave) => (
                                    <TableRow key={leave.id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell className="font-semibold pl-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                                {leave.leave_type || 'N/A'}
                                                {leave.is_half_day && (
                                                    <Badge variant="outline" className="ml-2 text-[10px] h-4 bg-primary/5 border-primary/20 text-primary">
                                                        Half Day ({leave.half_day_period})
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center py-4">{format(new Date(leave.start_date), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell className="text-center py-4">{format(new Date(leave.end_date), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell className="text-center py-4">
                                            <Badge variant={
                                                leave.status === 'approved' ? 'success' as any :
                                                    leave.status === 'rejected' ? 'destructive' : 'secondary'
                                            } className="uppercase text-[10px] font-bold tracking-wider px-2 h-5">
                                                {leave.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate pr-6 py-4 text-muted-foreground">{leave.reason}</TableCell>
                                    </TableRow>
                                ))}
                                {(!leaves || leaves.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <Plane className="h-10 w-10 opacity-20" />
                                                <p>No leave applications found.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <ModernDialog open={isOpen} onOpenChange={setIsOpen}>
                <ModernDialogContent size="md">
                    <ModernDialogHeader>
                        <ModernDialogTitle>Apply for Leave</ModernDialogTitle>
                        <ModernDialogDescription>Fill in the details for your leave request.</ModernDialogDescription>
                    </ModernDialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-6 pt-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Leave Type</Label>
                            <Select value={leaveType} onValueChange={setLeaveType}>
                                <SelectTrigger className="h-11 bg-background">
                                    <SelectValue placeholder="Select leave type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Casual Leave">Casual Leave</SelectItem>
                                    <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                                    <SelectItem value="Earned Leave">Earned Leave</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Start Date</Label>
                                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="h-11 bg-background" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">End Date</Label>
                                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="h-11 bg-background" disabled={isHalfDay} />
                            </div>
                        </div>

                        <div className="flex items-center gap-6 p-4 bg-muted/30 rounded-lg border border-dashed">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isHalfDay"
                                    checked={isHalfDay}
                                    onChange={(e) => {
                                        setIsHalfDay(e.target.checked)
                                        if (e.target.checked) setEndDate(startDate)
                                    }}
                                    className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <Label htmlFor="isHalfDay" className="text-sm font-semibold cursor-pointer">Apply Half Day</Label>
                            </div>

                            {isHalfDay && (
                                <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Period:</Label>
                                    <div className="flex bg-background border rounded-md p-1 gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setHalfDayPeriod("morning")}
                                            className={cn(
                                                "px-3 py-1 text-xs rounded-sm transition-all",
                                                halfDayPeriod === "morning" ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"
                                            )}
                                        >
                                            Morning
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHalfDayPeriod("afternoon")}
                                            className={cn(
                                                "px-3 py-1 text-xs rounded-sm transition-all",
                                                halfDayPeriod === "afternoon" ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"
                                            )}
                                        >
                                            Afternoon
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reason</Label>
                            <Textarea
                                placeholder="Briefly explain the reason for your leave request..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={4}
                                className="bg-background resize-none"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t">
                            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={applyMutation.isPending} className="px-8 font-bold shadow-lg shadow-primary/10 transition-all hover:scale-105">
                                {applyMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                                Submit Application
                            </Button>
                        </div>
                    </form>
                </ModernDialogContent>
            </ModernDialog>
        </div>
    )
}
