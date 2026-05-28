import React, { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { TimeInput } from "@/components/ui/time-input"
import { Card, CardContent } from "@/components/ui/card"
import { ProfileInfoCell } from "@/components/dashboard/profile-info-cell"
import { Edit, Clock, AlertCircle } from "lucide-react"
import { format, isValid } from "date-fns"
import { cn } from "@/lib/utils"
import CreateUserButton from "@/components/ui/create-user-button"

const attendanceEditSchema = z.object({
    status: z.enum(['pending', 'verified', 'rejected']),
    isHalfDay: z.boolean(),
    remarks: z.string().optional(),
    checkIn: z.string().min(1, "Check-in time is required"),
    checkOut: z.string().min(1, "Check-out time is required"),
})

type AttendanceEditValues = z.infer<typeof attendanceEditSchema>

interface AttendanceEditSheetProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    record: any | null
    onSave: (values: AttendanceEditValues) => void
    isSaving: boolean
    isSuccess?: boolean
}

export function AttendanceEditSheet({
    isOpen,
    onOpenChange,
    record,
    onSave,
    isSaving,
    isSuccess = false
}: AttendanceEditSheetProps) {
    const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<AttendanceEditValues>({
        resolver: zodResolver(attendanceEditSchema),
        defaultValues: {
            status: 'pending',
            isHalfDay: false,
            remarks: '',
            checkIn: '',
            checkOut: '',
        }
    })

    const status = watch('status')
    const isHalfDay = watch('isHalfDay')

    // Initialize form when record changes
    useEffect(() => {
        if (record) {
            const formatTime = (dateStr: string | null) => {
                if (!dateStr) return ""
                const date = new Date(dateStr)
                return isValid(date) ? format(date, "HH:mm") : ""
            }

            reset({
                status: record.status,
                isHalfDay: record.is_half_day || false,
                remarks: record.remarks || '',
                checkIn: formatTime(record.check_in),
                checkOut: formatTime(record.check_out),
            })
        }
    }, [record, reset])

    if (!record) return null

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md flex flex-col">
                <SheetHeader className="border-b pb-3">
                    <SheetTitle className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Edit className="h-5 w-5 text-primary" />
                        </div>
                        Edit Attendance
                    </SheetTitle>
                    <SheetDescription>
                        Update status, times and remarks for this attendance record.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto py-1 px-3.5">
                    <Card className="shadow-xs bg-muted/5 hover:bg-muted/10 transition-colors rounded-xl overflow-hidden border border-muted-foreground/15 hover:border-primary/20">
                        <CardContent className="px-3.5 pt-2 pb-2.5 space-y-3">
                            {/* Employee Info */}
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Employee Info</Label>
                                <div className="p-2.5 bg-background rounded-xl border border-dashed border-muted-foreground/15">
                                    <ProfileInfoCell profile={record.profile} />
                                </div>
                            </div>

                            {/* Time Adjustments */}
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1 text-blue-600">Time Adjustment</Label>
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
                                            <p className="text-[10px] text-rose-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
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
                                            <p className="text-[10px] text-rose-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                                                <AlertCircle className="size-3" /> {errors.checkOut.message}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Status & Half Day in one row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                                <div className="space-y-1 w-full">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Status</Label>
                                    <Select
                                        value={status}
                                        onValueChange={(val) => setValue('status', val as any)}
                                    >
                                        <SelectTrigger className="h-[36px] rounded-lg bg-background w-full text-xs">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="verified">Verified</SelectItem>
                                            <SelectItem value="rejected">Rejected</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className={cn(
                                    "p-2.5 rounded-lg border transition-colors flex items-center justify-between gap-2.5 h-[36px] w-full px-3",
                                    isHalfDay ? "bg-amber-500/5 border-amber-500/20" : "bg-background"
                                )}>
                                    <Label htmlFor="sheet-half-day" className="font-bold text-[11px] cursor-pointer whitespace-nowrap">Half Day</Label>
                                    <Checkbox
                                        id="sheet-half-day"
                                        checked={isHalfDay}
                                        onCheckedChange={(checked) => setValue('isHalfDay', !!checked)}
                                        className="size-3.5 rounded"
                                    />
                                </div>
                            </div>

                            {/* Remarks */}
                            <div className="space-y-1.5 pb-1">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Remarks</Label>
                                <Textarea
                                    {...register('remarks')}
                                    placeholder="Add internal notes or reasons for rejection..."
                                    className="min-h-[72px] py-2 px-3 rounded-lg text-xs resize-none bg-background focus:border-primary/20 transition-all"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2.5 pt-2 border-t border-muted-foreground/10 w-full">
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
                                    onClick={() => handleSubmit(onSave)()}
                                    disabled={isSaving || isSuccess}
                                    asyncState={isSaving ? 'loading' : isSuccess ? 'success' : 'idle'}
                                    mode="edit"
                                >
                                    Update Record
                                </CreateUserButton>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </SheetContent>
        </Sheet>
    )
}
