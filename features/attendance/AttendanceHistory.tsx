"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc/client"
import { format, subDays } from "date-fns"
import { Clock, Calendar } from "lucide-react"
import { useProfile } from "@/lib/context/profile-context"

export function AttendanceHistory() {
    const { profile } = useProfile()
    const endDate = format(new Date(), "yyyy-MM-dd")
    const startDate = format(subDays(new Date(), 30), "yyyy-MM-dd")
    const { data: history, isLoading, isError, refetch } = trpc.attendance.getAttendance.useQuery({
        profileId: profile?.id,
        startDate,
        endDate,
    }, {
        enabled: !!profile?.id
    })

    if (isLoading) return <div>Loading history...</div>
    if (isError) {
        return (
            <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
                <CardContent className="flex flex-col items-center gap-3 py-20 text-center">
                    <p className="text-sm text-destructive">Unable to load attendance history.</p>
                    <button className="text-sm font-medium text-primary underline" onClick={() => refetch()}>
                        Try again
                    </button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm overflow-hidden h-full">
            <CardHeader className="bg-muted/30 border-b pb-6">
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <Calendar className="size-5 text-primary" /> Attendance History
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="max-h-[600px] overflow-auto">
                    <Table>
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                            <TableRow>
                                <TableHead className="font-bold py-4 pl-6">Date</TableHead>
                                <TableHead className="font-bold py-4 text-center">In</TableHead>
                                <TableHead className="font-bold py-4 text-center">Out</TableHead>
                                <TableHead className="font-bold py-4 text-center">Hours</TableHead>
                                <TableHead className="font-bold py-4 text-center pr-6">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {history?.map((record) => (
                                <TableRow key={record.id} className="hover:bg-muted/30 transition-colors">
                                    <TableCell className="font-medium pl-6 py-4">
                                        {format(new Date(record.date), 'MMM dd, yyyy')}
                                    </TableCell>
                                    <TableCell className="text-center py-4">
                                        {record.check_in ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                                                {format(new Date(record.check_in), 'hh:mm a')}
                                            </span>
                                        ) : '--'}
                                    </TableCell>
                                    <TableCell className="text-center py-4">
                                        {record.check_out ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
                                                {format(new Date(record.check_out), 'hh:mm a')}
                                            </span>
                                        ) : '--'}
                                    </TableCell>
                                    <TableCell className="text-center font-bold text-primary py-4">
                                        {record.working_hours ? `${record.working_hours.toFixed(2)}h` : '--'}
                                    </TableCell>
                                    <TableCell className="text-center pr-6 py-4">
                                        <Badge variant={
                                            record.status === 'verified' ? 'success' as any :
                                                record.status === 'rejected' ? 'destructive' : 'secondary'
                                        } className="uppercase text-[10px] font-bold tracking-wider px-2 h-5">
                                            {record.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {(!history || history.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Clock className="h-10 w-10 opacity-20" />
                                            <p>No attendance records found.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}
