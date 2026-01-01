"use client"

import * as React from "react"
import { Calendar } from "@/components/ui/calendar"

export default function CalendarDemoPage() {
    const [date, setDate] = React.useState<Date | undefined>(new Date())

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 gap-8">
            <h1 className="text-2xl font-bold">Calendar Demo</h1>
            <div className="p-4 border rounded-xl bg-card shadow-lg">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    className="rounded-md border shadow-sm"
                    captionLayout="dropdown"
                />
            </div>
            <div className="text-sm text-muted-foreground">
                Selected Date: {date?.toLocaleDateString()}
            </div>
        </div>
    )
}
