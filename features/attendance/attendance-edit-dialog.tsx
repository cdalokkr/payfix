import React, { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { TimeInput } from "@/components/ui/time-input"
import { Card, CardContent } from "@/components/ui/card"
import { ProfileInfoCell } from "@/components/dashboard/profile-info-cell"
import { Edit, Clock, AlertCircle } from "lucide-react"
import { format, isValid } from "date-fns"
import { cn } from "@/lib/utils"
import CreateUserButton from "@/components/ui/create-user-button"
import { getRecordDayType } from "./attendance-columns"

const attendanceEditSchema = z.object({
    status: z.enum(['pending', 'verified', 'rejected']),
    dayType: z.enum(['Present', 'Half Day', 'Extra Day', 'On Leave', 'Weekly Off', 'Holiday', 'Absent']),
    remarks: z.string().optional(),
    checkIn: z.string().optional().or(z.literal('')),
    checkOut: z.string().optional().or(z.literal('')),
})

type AttendanceEditValues = z.infer<typeof attendanceEditSchema>

interface AttendanceEditDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    record: any | null
    onSave: (values: {
        checkIn: string | null
        checkOut: string | null
        status: 'pending' | 'verified' | 'rejected'
        isHalfDay: boolean
        isExtraDay: boolean
        remarks: string
    }) => void
    isSaving: boolean
    isSuccess?: boolean
}

export function AttendanceEditDialog({
    isOpen,
    onOpenChange,
    record,
    onSave,
    isSaving,
    isSuccess = false
}: AttendanceEditDialogProps) {
    const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<AttendanceEditValues>({
        resolver: zodResolver(attendanceEditSchema),
        defaultValues: {
            status: 'pending',
            dayType: 'Present',
            remarks: '',
            checkIn: '',
            checkOut: '',
        }
    })

    const status = watch('status')
    const dayType = watch('dayType')

    // Initialize form when record changes
    useEffect(() => {
        if (record) {
            const formatTime = (dateStr: string | null) => {
                if (!dateStr) return ""
                const date = new Date(dateStr)
                return isValid(date) ? format(date, "HH:mm") : ""
            }

            const resolvedType = getRecordDayType(record);
            let formDayType: any = resolvedType;
            
            // Map unverified/pending day type states to standard edit day types
            if (resolvedType === 'Marked In' || resolvedType === 'Marked Out') {
                formDayType = 'Present';
            } else if (resolvedType === 'Not marked') {
                formDayType = 'Absent';
            } else if (resolvedType === 'Applied Leave') {
                formDayType = 'On Leave';
            }

            reset({
                status: record.status === 'verified' || record.status === 'rejected' ? record.status : 'pending',
                dayType: formDayType,
                remarks: record.remarks || '',
                checkIn: formatTime(record.check_in),
                checkOut: formatTime(record.check_out),
            })
        }
    }, [record, reset])

    if (!record) return null

    const onSubmit = (values: AttendanceEditValues) => {
        const isHalfDay = values.dayType === 'Half Day';
        const isExtraDay = values.dayType === 'Extra Day';
        
        let remarks = values.remarks || '';
        
        // Auto-keyword injection to remarks for search compatibility
        if (values.dayType === 'On Leave') {
            if (!remarks.toLowerCase().includes('leave')) {
                remarks = remarks ? `Leave: ${remarks}` : 'Leave';
            }
        } else if (values.dayType === 'Weekly Off') {
            if (!remarks.toLowerCase().includes('weekly off') && !remarks.toLowerCase().includes('weekly_off')) {
                remarks = remarks ? `Weekly Off: ${remarks}` : 'Weekly Off';
            }
        } else if (values.dayType === 'Holiday') {
            if (!remarks.toLowerCase().includes('holiday')) {
                remarks = remarks ? `Holiday: ${remarks}` : 'Holiday';
            }
        } else if (values.dayType === 'Absent') {
            if (!remarks.toLowerCase().includes('absent')) {
                remarks = remarks ? `Absent: ${remarks}` : 'Absent';
            }
        }

        onSave({
            checkIn: values.checkIn || null,
            checkOut: values.checkOut || null,
            status: values.status,
            isHalfDay,
            isExtraDay,
            remarks
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[480px] p-6 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
                <DialogHeader className="border-b pb-3">
                    <DialogTitle className="text-lg font-bold flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Edit className="h-5 w-5 text-primary" />
                        </div>
                        Edit Attendance Record
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-1">
                        Update status, day classifications, times, and remarks.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 my-3 text-xs">
                    {/* Employee Info */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60">
                        <ProfileInfoCell profile={record.profile} />
                    </div>

                    {/* Date display */}
                    <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-card flex justify-between items-center">
                        <span className="text-muted-foreground font-medium">Record Date:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                            {format(new Date(record.date), 'MMMM dd, yyyy (EEEE)')}
                        </span>
                    </div>

                    {/* Time Adjustments */}
                    <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Time Adjustment</Label>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold flex items-center gap-1.5">
                                    <Clock className="size-3 text-emerald-500" />
                                    Check In
                                </Label>
                                <TimeInput
                                    {...register('checkIn')}
                                    className="h-[36px] rounded-lg text-xs focus:border-emerald-500/30"
                                    disabled={isSaving}
                                />
                                {errors.checkIn && (
                                    <p className="text-[10px] text-rose-500 flex items-center gap-1">
                                        <AlertCircle className="size-3" /> {errors.checkIn.message}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold flex items-center gap-1.5 text-rose-500">
                                    <Clock className="size-3" />
                                    Check Out
                                </Label>
                                <TimeInput
                                    {...register('checkOut')}
                                    className="h-[36px] rounded-lg text-xs focus:border-rose-500/30"
                                    disabled={isSaving}
                                />
                                {errors.checkOut && (
                                    <p className="text-[10px] text-rose-500 flex items-center gap-1">
                                        <AlertCircle className="size-3" /> {errors.checkOut.message}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Status & Day Type in one row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Verify Status</Label>
                            <Select
                                value={status}
                                onValueChange={(val) => setValue('status', val as any)}
                                disabled={isSaving}
                            >
                                <SelectTrigger className="h-[36px] rounded-lg bg-background w-full text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="verified">Verified</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Day Type</Label>
                            <Select
                                value={dayType}
                                onValueChange={(val) => setValue('dayType', val as any)}
                                disabled={isSaving}
                            >
                                <SelectTrigger className="h-[36px] rounded-lg bg-background w-full text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Present">Present</SelectItem>
                                    <SelectItem value="Half Day">Half Day</SelectItem>
                                    <SelectItem value="Extra Day">Extra Day</SelectItem>
                                    <SelectItem value="On Leave">On Leave</SelectItem>
                                    <SelectItem value="Weekly Off">Weekly Off</SelectItem>
                                    <SelectItem value="Holiday">Holiday</SelectItem>
                                    <SelectItem value="Absent">Absent</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Remarks */}
                    <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Remarks</Label>
                        <Textarea
                            {...register('remarks')}
                            placeholder="Add internal notes or request details..."
                            disabled={isSaving}
                            className="min-h-[64px] py-2 px-3 rounded-lg text-xs resize-none bg-background focus:border-primary/20 transition-all"
                        />
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 w-full mt-2">
                    <Button
                        variant="outline"
                        type="button"
                        className="flex-1 h-[36px] rounded-lg text-xs font-semibold"
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                    >
                        Cancel
                    </Button>
                    <CreateUserButton
                        className="flex-[2] h-[36px] rounded-lg gap-1.5 text-xs font-bold"
                        onClick={() => handleSubmit(onSubmit)()}
                        disabled={isSaving || isSuccess}
                        asyncState={isSaving ? 'loading' : isSuccess ? 'success' : 'idle'}
                        mode="edit"
                    >
                        Update Record
                    </CreateUserButton>
                </div>
            </DialogContent>
        </Dialog>
    )
}
