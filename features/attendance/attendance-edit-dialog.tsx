import React, { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
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

    // react-hook-form's watch API is intentionally live and is not React Compiler-memoizable.
    // eslint-disable-next-line react-hooks/incompatible-library
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
            <DialogContent className="max-w-[500px] w-[95vw] sm:w-full p-0 overflow-hidden rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950">
                <DialogHeader className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30">
                    <DialogTitle className="text-base font-bold flex items-center gap-2">
                        <div className="p-1.5 bg-primary/10 rounded-xl shadow-sm">
                            <Edit className="h-4 w-4 text-primary" />
                        </div>
                        Edit Attendance Record
                    </DialogTitle>
                    <DialogDescription className="text-xs font-medium text-muted-foreground ml-9 mt-0.5">
                        Update status, day classifications, times, and remarks.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-4 py-3.5 space-y-4">
                    {/* Employee Info & Date */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 p-2.5 rounded-xl bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/80 dark:to-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 shadow-sm transition-all hover:shadow-md sm:pr-4">
                        <ProfileInfoCell profile={record.profile} />
                        <div className="flex flex-col sm:items-end pl-12 sm:pl-0">
                            <span className="text-[9px] font-semibold tracking-wider uppercase text-muted-foreground mb-0.5">Record Date</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                {format(new Date(record.date), 'MMM dd, yyyy (EEE)')}
                            </span>
                        </div>
                    </div>

                    {/* Unified Attendance Details */}
                    <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1.2fr_1.2fr] gap-3 sm:gap-4 pt-0.5">
                        
                        {/* Time Controls */}
                        <div className="space-y-1">
                            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Clock className="size-3.5 text-emerald-500" />
                                Check In
                            </Label>
                            <TimeInput
                                {...register('checkIn')}
                                className="h-[36px] w-full rounded-xl text-[13px] font-medium tracking-wide focus:border-emerald-500/50 shadow-sm bg-white dark:bg-slate-950 pr-2 pl-[32px]"
                                disabled={isSaving}
                            />
                            {errors.checkIn && (
                                <p className="text-[9px] text-rose-500 flex items-center gap-1 font-medium mt-0.5">
                                    <AlertCircle className="size-3" /> {errors.checkIn.message}
                                </p>
                            )}
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Clock className="size-3.5 text-rose-500" />
                                Check Out
                            </Label>
                            <TimeInput
                                {...register('checkOut')}
                                className="h-[36px] w-full rounded-xl text-[13px] font-medium tracking-wide focus:border-rose-500/50 shadow-sm bg-white dark:bg-slate-950 pr-2 pl-[32px]"
                                disabled={isSaving}
                            />
                            {errors.checkOut && (
                                <p className="text-[9px] text-rose-500 flex items-center gap-1 font-medium mt-0.5">
                                    <AlertCircle className="size-3" /> {errors.checkOut.message}
                                </p>
                            )}
                        </div>

                        {/* Status & Day Type Controls */}
                        <div className="space-y-1">
                            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</Label>
                            <Select
                                value={status}
                                onValueChange={(val) => setValue('status', val as any)}
                                disabled={isSaving}
                            >
                                <SelectTrigger className="h-[36px] w-full rounded-xl bg-white dark:bg-slate-950 shadow-sm text-[13px] font-medium border-slate-200/60 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 transition-colors px-3">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl shadow-lg border-slate-100 dark:border-slate-800">
                                    <SelectItem value="pending" className="rounded-lg m-1 cursor-pointer text-xs">Pending</SelectItem>
                                    <SelectItem value="verified" className="rounded-lg m-1 cursor-pointer font-medium text-emerald-600 dark:text-emerald-400 text-xs">Verified</SelectItem>
                                    <SelectItem value="rejected" className="rounded-lg m-1 cursor-pointer font-medium text-rose-600 dark:text-rose-400 text-xs">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Day Type</Label>
                            <Select
                                value={dayType}
                                onValueChange={(val) => setValue('dayType', val as any)}
                                disabled={isSaving}
                            >
                                <SelectTrigger className="h-[36px] w-full rounded-xl bg-white dark:bg-slate-950 shadow-sm text-[13px] font-medium border-slate-200/60 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 transition-colors px-3">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl shadow-lg border-slate-100 dark:border-slate-800">
                                    <SelectItem value="Present" className="rounded-lg m-1 cursor-pointer text-xs">Present</SelectItem>
                                    <SelectItem value="Half Day" className="rounded-lg m-1 cursor-pointer text-xs">Half Day</SelectItem>
                                    <SelectItem value="Extra Day" className="rounded-lg m-1 cursor-pointer text-xs">Extra Day</SelectItem>
                                    <SelectItem value="On Leave" className="rounded-lg m-1 cursor-pointer text-amber-600 dark:text-amber-500 text-xs">On Leave</SelectItem>
                                    <SelectItem value="Weekly Off" className="rounded-lg m-1 cursor-pointer text-xs">Weekly Off</SelectItem>
                                    <SelectItem value="Holiday" className="rounded-lg m-1 cursor-pointer text-xs">Holiday</SelectItem>
                                    <SelectItem value="Absent" className="rounded-lg m-1 cursor-pointer text-rose-600 dark:text-rose-500 text-xs">Absent</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Remarks */}
                    <div className="space-y-1 pt-0.5">
                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Remarks</Label>
                        <Input
                            {...register('remarks')}
                            placeholder="Add internal notes or request details..."
                            disabled={isSaving}
                            className="h-[36px] w-full px-3.5 rounded-xl text-[13px] bg-white dark:bg-slate-950 shadow-sm border-slate-200/60 dark:border-slate-800/60 focus-visible:border-primary/50 transition-all"
                        />
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col-reverse sm:flex-row gap-2 rounded-b-2xl">
                    <Button
                        variant="outline"
                        type="button"
                        className="w-full sm:flex-1 h-[36px] rounded-xl font-medium shadow-sm bg-white dark:bg-slate-950 text-xs"
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                    >
                        Cancel
                    </Button>
                    <CreateUserButton
                        className="w-full sm:flex-[2] h-[36px] rounded-xl gap-2 font-bold shadow-md text-xs"
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
