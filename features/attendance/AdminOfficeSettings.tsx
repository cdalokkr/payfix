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
import { CalendarClock, Settings, Plus, Trash2, Calendar as CalendarIcon, Loader2, Check, X, Clock, ChevronDown, Palmtree } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { DataTable } from "@/components/ui/data-table"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ColumnDef } from "@tanstack/react-table"

const closureSchema = z.object({
    date: z.date({
        message: "A date is required.",
    }),
    type: z.enum(['holiday', 'closed']),
    reason: z.string().min(3, "Reason must be at least 3 characters.").max(50, "Reason must be under 50 characters."),
})

type ClosureFormValues = z.infer<typeof closureSchema>

export function AdminOfficeSettings() {
    const [isCalendarOpen, setIsCalendarOpen] = useState(false)

    const form = useForm<ClosureFormValues>({
        resolver: zodResolver(closureSchema),
        defaultValues: {
            type: 'holiday',
            reason: '',
        }
    })

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

    const addClosureMutation = trpc.attendance.addOfficeClosure.useMutation({
        onSuccess: () => {
            toast.success("Office closure added")
            utils.attendance.getOfficeClosures.invalidate()
            form.reset({
                type: 'holiday',
                reason: '',
                date: undefined
            })
        },
        onError: (error) => {
            if (error.data?.code === 'CONFLICT') {
                toast.error(error.message)
            } else {
                toast.error("Failed to add closure. Please try again.")
            }
        }
    })

    const deleteClosureMutation = trpc.attendance.deleteOfficeClosure.useMutation({
        onSuccess: () => {
            toast.success("Office closure removed")
            utils.attendance.getOfficeClosures.invalidate()
        },
        onError: (error) => toast.error(error.message)
    })

    const handleUpdateSettings = (e: React.FormEvent) => {
        e.preventDefault()
        if (!settings) return

        updateSettingsMutation.mutate({
            defaultCheckIn: settings.default_check_in,
            defaultCheckOut: settings.default_check_out,
            offDays: offDays,
            dailyWorkingHours: dailyHours
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

    const onSubmitClosure = (values: ClosureFormValues) => {
        addClosureMutation.mutate({
            date: format(values.date, 'yyyy-MM-dd'),
            reason: values.reason,
            type: values.type
        })
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
            cell: ({ row }: any) => (
                <div className="flex items-center gap-3 pl-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <CalendarIcon className="h-4 w-4" />
                    </div>
                    {format(new Date(row.original.date), 'MMM dd, yyyy')}
                </div>
            )
        },
        {
            accessorKey: "type",
            header: "Type",
            cell: ({ row }: any) => (
                <Badge variant="outline" className={cn(
                    "w-fit text-[10px] px-2 h-5 font-bold uppercase tracking-wider whitespace-nowrap",
                    row.original.type === 'holiday' ? "text-amber-600 border-amber-200 bg-amber-50" : "text-rose-600 border-rose-200 bg-rose-50"
                )}>
                    {row.original.type === 'holiday' ? 'Festival Holiday' : 'Office Closed'}
                </Badge>
            )
        },
        {
            accessorKey: "reason",
            header: "Reason / Name",
            cell: ({ row }: any) => (
                <span className="font-semibold text-sm text-foreground/80">{row.original.reason}</span>
            )
        },
        {
            id: "actions",
            header: () => <div className="text-right pr-6">Action</div>,
            cell: ({ row }: any) => (
                <div className="text-right pr-4">
                    <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10 h-8 w-8 rounded-full"
                        onClick={() => deleteClosureMutation.mutate({ id: row.original.id })}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
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
                        className="h-11 px-8 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm  transition-all gap-2"
                    >
                        <CalendarClock className="size-5" />
                        Office Schedule
                    </TabsTrigger>
                    <TabsTrigger
                        value="holiday"
                        className="h-11 px-8 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all gap-2"
                    >
                        <Palmtree className="size-5" />
                        Office Holiday
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="schedule" className="space-y-8 focus-visible:outline-none focus-visible:ring-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-12">
                        <CardShell
                            title="Working Schedule Settings"
                            description="Configure day-wise working hours and weekly off days"
                            icon={Settings}
                            className="xl:col-span-12"
                            contentClassName="p-6 border-t border-muted/20"
                        >
                            <Card className="shadow-lg border-primary/5 overflow-hidden bg-background/40 backdrop-blur-sm p-0 hover:border-primary/10 transition-all duration-300 hover:bg-background/50 ">
                                {settings && (
                                    <form onSubmit={handleUpdateSettings} className="flex flex-col">
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader className="bg-muted/40 border-b border-muted/20 hover:bg-transparent transition-all duration-300">
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
                <CardShell
                    title="Office Closure Management"
                    description="Configure official holidays and scheduled office closures"
                    icon={Palmtree}
                    className="xl:col-span-12"
                    contentClassName="p-6"
                >
                    <div className="flex flex-col gap-8">
                        <Card className="shadow-none border border-muted hover:border-primary/20 transition-all p-0 overflow-hidden">
                            <CardHeader className="p-4 border-b border-muted/20 bg-muted/50 hover:bg-muted/80 transition-all">
                                <div className="flex items-center gap-2">
                                    <Plus className="size-6 text-primary border border-primary/20 rounded-lg h-6 w-6" />
                                    <CardTitle className="text-sm font-bold">Add New Closure</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 pt-2">
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmitClosure)} className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
                                            <FormField
                                                control={form.control}
                                                name="date"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col lg:col-span-3">
                                                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Select Date</FormLabel>
                                                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                                            <PopoverTrigger asChild>
                                                                <FormControl>
                                                                    <Button
                                                                        variant={"outline"}
                                                                        className={cn(
                                                                            "w-full h-10 pl-3 text-left font-normal border-muted-foreground/20 hover:bg-muted/10",
                                                                            !field.value && "text-muted-foreground"
                                                                        )}
                                                                    >
                                                                        {field.value ? (
                                                                            format(field.value, "PPP")
                                                                        ) : (
                                                                            <span>Pick a date</span>
                                                                        )}
                                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                                    </Button>
                                                                </FormControl>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0" align="start">
                                                                <Calendar
                                                                    mode="single"
                                                                    captionLayout="dropdown"
                                                                    fromYear={new Date().getFullYear()}
                                                                    toYear={new Date().getFullYear() + 5}
                                                                    selected={field.value}
                                                                    onSelect={(date) => {
                                                                        field.onChange(date)
                                                                        setIsCalendarOpen(false)
                                                                    }}
                                                                    disabled={(date) => {
                                                                        const formatted = format(date, 'yyyy-MM-dd')
                                                                        return closures?.some(c => c.date === formatted) || date < new Date(new Date().setHours(0, 0, 0, 0))
                                                                    }}
                                                                    initialFocus
                                                                />
                                                            </PopoverContent>
                                                        </Popover>
                                                        <div className="h-5">
                                                            <FormMessage className="text-[10px]" />
                                                        </div>
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="type"
                                                render={({ field }) => (
                                                    <FormItem className="lg:col-span-2">
                                                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Closure Type</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="w-full h-10 border-muted-foreground/20 hover:bg-muted/10 flex items-center">
                                                                    <SelectValue placeholder="Select type" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="holiday">Festival Holiday</SelectItem>
                                                                <SelectItem value="closed">Office Closed</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <div className="h-5">
                                                            <FormMessage className="text-[10px]" />
                                                        </div>
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="reason"
                                                render={({ field }) => (
                                                    <FormItem className="lg:col-span-4">
                                                        <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Reason / Name</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="e.g., Diwali, Maintenance" className="h-10 border-muted-foreground/20" {...field} />
                                                        </FormControl>
                                                        <div className="h-5">
                                                            <FormMessage className="text-[10px]" />
                                                        </div>
                                                    </FormItem>
                                                )}
                                            />

                                            <FormItem className="w-full lg:col-span-3">
                                                <FormLabel className="text-[10px] font-bold uppercase tracking-wider text-transparent select-none">Action</FormLabel>
                                                <FormControl>
                                                    <Button
                                                        type="submit"
                                                        disabled={addClosureMutation.isPending}
                                                        className="w-full h-10 font-bold shadow-md transition-all hover:scale-[1.01]"
                                                    >
                                                        {addClosureMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
                                                        Add Holiday
                                                    </Button>
                                                </FormControl>
                                                <div className="h-5" />
                                            </FormItem>
                                        </div>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>

                        <Card className="shadow-none border border-muted hover:border-primary/20 transition-all p-0 overflow-hidden">
                            <CardHeader className="p-4 border-b border-muted/20 bg-muted/50 hover:bg-muted/80 transition-all">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CalendarIcon className="size-6 text-primary border border-primary/20 rounded-lg p-1" />
                                        <CardTitle className="text-sm font-bold">Upcoming Closures</CardTitle>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] font-bold px-2 py-0">
                                        {closures?.length || 0} Listed
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 pt-2">
                                <div className="max-h-[600px] overflow-auto">
                                    <DataTable
                                        columns={closureColumns}
                                        data={closures || []}
                                        isLoading={!closures}
                                        hidePagination={true}
                                        emptyIcon={<CalendarClock className="size-12 text-muted-foreground/20" />}
                                        emptyMessage="No office closures scheduled"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </CardShell>
            </TabsContent>
        </Tabs>
    )
}
