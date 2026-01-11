"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TimeInput } from "@/components/ui/time-input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import { format } from "date-fns"
import { CardShell } from "./CardShell"
import { Settings, Calendar as CalendarIcon, Loader2, Check, X, Clock, Palmtree } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card } from "@/components/ui/card"

export function ModeratorOfficeSettings() {
    const utils = trpc.useUtils()
    const { data: settings } = trpc.attendance.getOfficeSettings.useQuery()
    const { data: closures } = trpc.attendance.getOfficeClosures.useQuery()

    const [offDays, setOffDays] = useState<number[]>([])
    const [dailyHours, setDailyHours] = useState<Record<string, { checkIn: string, checkOut: string }>>({})

    useEffect(() => {
        if (settings) {
            setOffDays(settings.off_days || [])
            setDailyHours((settings.daily_working_hours as any) || {})
        }
    }, [settings])

    const updateSettingsMutation = trpc.attendance.updateOfficeSettings.useMutation({
        onSuccess: () => {
            toast.success("Office configuration updated")
            utils.attendance.getOfficeSettings.invalidate()
        },
        onError: (error) => toast.error(error.message)
    })

    // Map numeric day index to day name strings for backend
    const DAY_INDEX_TO_NAME: Record<number, string> = {
        0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
        4: 'thursday', 5: 'friday', 6: 'saturday'
    }

    const handleUpdateSettings = (e: React.FormEvent) => {
        e.preventDefault()
        if (!settings) return

        // Build daily hours for ALL days, using state values or defaults
        const formattedDailyHours: Record<string, { checkIn: string, checkOut: string }> = {}
        const defaultCheckIn = settings.default_check_in.split(':').slice(0, 2).join(':')
        const defaultCheckOut = settings.default_check_out.split(':').slice(0, 2).join(':')

        // Iterate through all 7 days (0-6)
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
            const dayName = DAY_INDEX_TO_NAME[dayIndex]
            const stateHours = dailyHours[dayIndex]

            // Use state hours if available and valid, otherwise use defaults
            if (stateHours && typeof stateHours === 'object' && 'checkIn' in stateHours) {
                formattedDailyHours[dayName] = stateHours as { checkIn: string, checkOut: string }
            } else {
                formattedDailyHours[dayName] = { checkIn: defaultCheckIn, checkOut: defaultCheckOut }
            }
        }

        updateSettingsMutation.mutate({
            defaultCheckIn: settings.default_check_in,
            defaultCheckOut: settings.default_check_out,
            offDays: offDays,
            dailyWorkingHours: formattedDailyHours
        })
    }

    const toggleOffDay = (day: number) => {
        setOffDays(prev =>
            prev.includes(day)
                ? prev.filter(d => d !== day)
                : [...prev, day]
        )
    }

    const handleDailyHourChange = (dayIndex: number, type: 'checkIn' | 'checkOut', value: string) => {
        setDailyHours(prev => ({
            ...prev,
            [dayIndex]: {
                ...prev[dayIndex] || {
                    checkIn: settings?.default_check_in.split(':').slice(0, 2).join(':') || "10:00",
                    checkOut: settings?.default_check_out.split(':').slice(0, 2).join(':') || "19:00"
                },
                [type]: value
            }
        }))
    }

    const DAYS = [
        { label: 'Sunday', short: 'Sun', value: 0 },
        { label: 'Monday', short: 'Mon', value: 1 },
        { label: 'Tuesday', short: 'Tue', value: 2 },
        { label: 'Wednesday', short: 'Wed', value: 3 },
        { label: 'Thursday', short: 'Thu', value: 4 },
        { label: 'Friday', short: 'Fri', value: 5 },
        { label: 'Saturday', short: 'Sat', value: 6 },
    ]

    const closureColumns: ColumnDef<any>[] = [
        {
            accessorKey: "date",
            header: "Date",
            cell: ({ row }) => (
                <div className="flex items-center gap-3 pl-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <CalendarIcon className="h-4 w-4" />
                    </div>
                    {format(new Date(row.original.date), 'MMM dd, yyyy')}
                </div>
            )
        },
        {
            accessorKey: "reason",
            header: "Reason & Type",
            cell: ({ row }) => (
                <div className="flex flex-col gap-1">
                    <span className="font-medium">{row.original.reason}</span>
                    <Badge variant="outline" className={cn(
                        "w-fit text-[10px] px-2 h-5 font-bold uppercase tracking-wider",
                        row.original.type === 'holiday' ? "text-amber-600 border-amber-200 bg-amber-50" : "text-rose-600 border-rose-200 bg-rose-50"
                    )}>{row.original.type}</Badge>
                </div>
            )
        }
    ]

    return (
        <Tabs defaultValue="schedule" className="w-full">
            <div className="flex items-center justify-between mb-8">
                <TabsList className="bg-muted/50 p-1.5 h-auto gap-1">
                    <TabsTrigger
                        value="schedule"
                        className="h-11 px-8 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary font-extrabold transition-all gap-2"
                    >
                        <Settings className="size-4" />
                        Office Schedule
                    </TabsTrigger>
                    <TabsTrigger
                        value="holiday"
                        className="h-11 px-8 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary font-extrabold transition-all gap-2"
                    >
                        <Palmtree className="size-4" />
                        Office Holiday
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="schedule" className="space-y-8 focus-visible:outline-none focus-visible:ring-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-12">
                        <CardShell
                            title="Company Office Settings"
                            description="Configure day-wise working hours and weekly off days"
                            icon={Settings}
                            className="xl:col-span-12"
                            contentClassName="p-6 border-t border-muted/20"
                        >
                            <Card className="shadow-lg border-primary/5 overflow-hidden bg-background/40 backdrop-blur-sm">
                                {settings && (
                                    <form onSubmit={handleUpdateSettings} className="flex flex-col">
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader className="bg-muted/40 border-b border-muted/20">
                                                    <TableRow className="hover:bg-transparent">
                                                        <TableHead className="w-[80px] font-extrabold text-[11px] uppercase tracking-wider py-4 pl-10 text-primary/80">Select</TableHead>
                                                        <TableHead className="w-[150px] font-extrabold text-[11px] uppercase tracking-wider py-4 text-primary/80">Day</TableHead>
                                                        <TableHead className="w-[180px] font-extrabold text-[11px] uppercase tracking-wider py-4 text-primary/80">Week Day Status</TableHead>
                                                        <TableHead className="font-extrabold text-[11px] uppercase tracking-wider py-4 text-primary/80">Check-In Time</TableHead>
                                                        <TableHead className="font-extrabold text-[11px] uppercase tracking-wider py-4 text-primary/80">Check-Out Time</TableHead>
                                                        <TableHead className="w-[100px] font-extrabold text-[11px] uppercase tracking-wider py-4 text-primary/80 text-right pr-10">Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {DAYS.map((day) => {
                                                        const isOffDay = offDays.includes(day.value)
                                                        const isWorkingDay = !isOffDay
                                                        const hours = dailyHours[day.value] || {
                                                            checkIn: settings.default_check_in.split(':').slice(0, 2).join(':'),
                                                            checkOut: settings.default_check_out.split(':').slice(0, 2).join(':')
                                                        }

                                                        return (
                                                            <TableRow
                                                                key={day.value}
                                                                className={cn(
                                                                    "group/row transition-colors duration-200 border-muted/10",
                                                                    isWorkingDay ? "hover:bg-muted/20" : "bg-rose-50/30 hover:bg-rose-50/50"
                                                                )}
                                                            >
                                                                <TableCell className="py-2 pl-10">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleOffDay(day.value)}
                                                                        className={cn(
                                                                            "relative flex items-center justify-center size-8 rounded-lg border transition-all duration-300",
                                                                            isWorkingDay
                                                                                ? "bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm"
                                                                                : "bg-rose-50 border-rose-200 text-rose-600 shadow-sm"
                                                                        )}
                                                                        title={isWorkingDay ? "Set as Off Day" : "Set as Working Day"}
                                                                    >
                                                                        {isWorkingDay ? (
                                                                            <>
                                                                                <Check className="size-4 stroke-[3] group-hover/row:hidden" />
                                                                                <X className="size-4 stroke-[3] hidden group-hover/row:block text-rose-600" />
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <X className="size-4 stroke-[3] group-hover/row:hidden" />
                                                                                <Check className="size-4 stroke-[3] hidden group-hover/row:block text-emerald-600" />
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                </TableCell>

                                                                <TableCell className="py-2">
                                                                    <span className={cn(
                                                                        "font-bold text-sm tracking-tight transition-colors",
                                                                        isWorkingDay ? "text-foreground" : "text-rose-600/70"
                                                                    )}>
                                                                        {day.label}
                                                                    </span>
                                                                </TableCell>

                                                                <TableCell className="py-2">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className={cn(
                                                                            "text-[10px] font-bold uppercase tracking-wider",
                                                                            isWorkingDay ? "text-emerald-600" : "text-rose-600"
                                                                        )}>
                                                                            {isWorkingDay ? "Working Day" : "Off Day"}
                                                                        </span>
                                                                    </div>
                                                                </TableCell>

                                                                <TableCell className="py-2">
                                                                    <div className={cn(
                                                                        "transition-all duration-300",
                                                                        isOffDay ? "opacity-30 pointer-events-none scale-95 origin-left" : "opacity-100"
                                                                    )}>
                                                                        <div className="max-w-[140px]">
                                                                            <TimeInput
                                                                                step="1"
                                                                                value={hours.checkIn}
                                                                                onChange={(e: any) => handleDailyHourChange(day.value, 'checkIn', e.target.value)}
                                                                                className="h-8 bg-muted/20 border-transparent hover:bg-muted/40"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </TableCell>

                                                                <TableCell className="py-2">
                                                                    <div className={cn(
                                                                        "transition-all duration-300",
                                                                        isOffDay ? "opacity-30 pointer-events-none scale-95 origin-left" : "opacity-100"
                                                                    )}>
                                                                        <div className="max-w-[140px]">
                                                                            <TimeInput
                                                                                step="1"
                                                                                value={hours.checkOut}
                                                                                onChange={(e: any) => handleDailyHourChange(day.value, 'checkOut', e.target.value)}
                                                                                className="h-8 bg-muted/20 border-transparent hover:bg-muted/40"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </TableCell>

                                                                <TableCell className="py-2 pr-10">
                                                                    <div className="flex justify-end">
                                                                        <Badge
                                                                            variant="outline"
                                                                            className={cn(
                                                                                "text-[9px] font-bold tracking-widest uppercase py-0.5 px-2",
                                                                                isWorkingDay
                                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                                                            )}
                                                                        >
                                                                            {isWorkingDay ? "Active" : "Inactive"}
                                                                        </Badge>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>

                                        <div className="p-8 bg-muted/10 border-t border-muted/20 flex items-center justify-between">
                                            <p className="text-xs text-muted-foreground italic max-w-sm">
                                                Click the checkmark buttons to toggle weekly off days. Working hours are automatically disabled for off-days.
                                            </p>
                                            <Button
                                                type="submit"
                                                disabled={updateSettingsMutation.isPending}
                                                className="h-12 px-12 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                            >
                                                {updateSettingsMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Settings className="mr-2 size-4" />}
                                                Save Configuration
                                            </Button>
                                        </div>
                                    </form>
                                )}
                            </Card>
                        </CardShell>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="holiday" className="space-y-8 focus-visible:outline-none focus-visible:ring-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <CardShell
                        title="Office Closures & Holidays"
                        description="Scheduled holidays and office closures (Read-only for Moderators)"
                        icon={CalendarIcon}
                        className="xl:col-span-12"
                        contentClassName="p-0 min-h-fit"
                    >
                        <div className="max-h-[600px] overflow-auto border-t border-muted/20">
                            <DataTable
                                columns={closureColumns}
                                data={closures || []}
                                isLoading={!closures}
                                hidePagination={true}
                                emptyIcon={<Palmtree className="size-12 text-muted-foreground/20" />}
                                emptyMessage="No office closures scheduled"
                            />
                        </div>
                    </CardShell>
                </div>
            </TabsContent>
        </Tabs>
    )
}
