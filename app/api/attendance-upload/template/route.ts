import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles, officeSettings, officeClosures } from '@/lib/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
    try {
        // Verify user is authenticated
        const supabase = await createServerSupabaseClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Verify role is admin or moderator
        const profile = await db.query.profiles.findFirst({
            where: eq(profiles.id, user.id),
            columns: { role: true }
        })

        if (!profile || (profile.role !== 'admin' && profile.role !== 'moderator')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type') // 'daily' | 'monthly'
        const month = parseInt(searchParams.get('month') || '0')
        const year = parseInt(searchParams.get('year') || '0')

        if (!type || !month || !year) {
            return NextResponse.json({ error: 'Missing required params: type, month, year' }, { status: 400 })
        }

        // Get all active employees
        const employees = await db.query.profiles.findMany({
            where: eq(profiles.status, 'active'),
            columns: {
                id: true,
                full_name: true,
                email: true,
            },
            with: {
                designation: {
                    columns: { name: true }
                }
            },
            orderBy: (p, { asc }) => [asc(p.full_name)]
        })

        if (employees.length === 0) {
            return NextResponse.json({ error: 'No active employees found' }, { status: 404 })
        }

        let workbook: XLSX.WorkBook

        if (type === 'daily') {
            // Query office settings (for off days) and closures (for holidays)
            const settings = await db.query.officeSettings.findFirst()
            const lastDay = new Date(year, month, 0).getDate()
            const startStr = `${year}-${String(month).padStart(2, '0')}-01`
            const endStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
            const closures = await db.query.officeClosures.findMany({
                where: and(
                    gte(officeClosures.date, startStr),
                    lte(officeClosures.date, endStr)
                )
            })

            workbook = generateDailyTemplate(employees, month, year, settings, closures)
        } else if (type === 'monthly') {
            workbook = generateMonthlyTemplate(employees, month, year)
        } else {
            return NextResponse.json({ error: 'Invalid type. Must be "daily" or "monthly"' }, { status: 400 })
        }

        // Write workbook to buffer
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })

        const MONTHS = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ]
        const fileName = `${type}_attendance_template_${MONTHS[month - 1]}_${year}.xlsx`

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            }
        })

    } catch (error: any) {
        console.error('[ATTENDANCE-TEMPLATE] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to generate template' },
            { status: 500 }
        )
    }
}

function generateDailyTemplate(
    employees: Array<{ id: string; full_name: string | null; email: string; designation: { name: string } | null }>,
    month: number,
    year: number,
    settings: any,
    closures: any[]
): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new()

    // Calculate last day of month
    const lastDay = new Date(year, month, 0).getDate()

    const rows: any[][] = []

    // Header row
    rows.push([
        'Sr',
        'Employee Name',
        'Email',
        'Designation',
        'Date (YYYY-MM-DD)',
        'Check-In (HH:MM)',
        'Check-Out (HH:MM)',
        'Is Half Day (Y/N)',
        'Remarks'
    ])

    const offDays = settings?.off_days || [0] // Sunday defaults to 0
    const holidaysMap = new Map(closures?.map(c => [c.date, c.reason]) || [])
    const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    let sr = 1
    for (const emp of employees) {
        // Add one row per working day per employee
        for (let d = 1; d <= lastDay; d++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            
            // Note: Date constructor with (year, monthIndex, day) creates date in local timezone
            const dateObj = new Date(year, month - 1, d)
            const dayOfWeek = dateObj.getDay()

            let remark = ''
            const holidayReason = holidaysMap.get(dateStr)
            if (holidayReason) {
                remark = `Holiday: ${holidayReason}`
            } else if (offDays.includes(dayOfWeek)) {
                remark = `${DAYS_OF_WEEK[dayOfWeek]} (Weekly Off)`
            }

            rows.push([
                sr++,
                emp.full_name || '',
                emp.email,
                emp.designation?.name || '',
                dateStr,
                '', // Check-In
                '', // Check-Out
                '', // Is Half Day
                remark // Pre-filled remarks for Sundays and holidays
            ])
        }
    }

    const worksheet = XLSX.utils.aoa_to_sheet(rows)

    // Set column widths
    worksheet['!cols'] = [
        { wch: 5 },   // Sr
        { wch: 25 },  // Employee Name
        { wch: 30 },  // Email
        { wch: 20 },  // Designation
        { wch: 16 },  // Date
        { wch: 16 },  // Check-In
        { wch: 16 },  // Check-Out
        { wch: 16 },  // Is Half Day
        { wch: 25 },  // Remarks
    ]

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Attendance')

    // Create and append instructions worksheet
    const instructionRows = [
        ['INSTRUCTIONS FOR DAILY ATTENDANCE BULK UPLOAD'],
        [''],
        ['1. Do NOT modify or delete the pre-filled columns: Sr, Employee Name, Email, Designation, Date.'],
        ['2. Enter times in 24-hour format or 12-hour format with AM/PM:'],
        ['   - 24-hour format (Recommended): e.g., 09:59, 18:00, 14:30'],
        ['   - 12-hour format: e.g., 9:59 AM, 6:00 PM, 2:30 PM (always include AM/PM, case-insensitive)'],
        ['3. Date format must be YYYY-MM-DD (e.g., 2026-04-01). Do not edit the pre-filled Date column.'],
        ['4. For half days, enter "Y" or "Yes" in the "Is Half Day (Y/N)" column. Otherwise, leave blank or enter "N".'],
        ['5. Remarks are optional and can be used to add notes (e.g., "Work from home", "Late arrival").'],
        ['6. Ensure all records are filled accurately before uploading. Any errors will prevent payroll from processing correctly.'],
        [''],
        ['EXAMPLE ENTRIES:'],
        ['Sr', 'Employee Name', 'Email', 'Designation', 'Date (YYYY-MM-DD)', 'Check-In (HH:MM)', 'Check-Out (HH:MM)', 'Is Half Day (Y/N)', 'Remarks'],
        [1, 'John Doe', 'john@company.com', 'Developer', '2026-04-01', '09:59', '18:00', 'N', 'Regular check-in'],
        [2, 'Jane Smith', 'jane@company.com', 'Designer', '2026-04-01', '9:59 AM', '2:00 PM', 'Y', 'Half day approved'],
        [3, 'Bob Johnson', 'bob@company.com', 'Manager', '2026-04-01', '10:15', '19:15', '', 'On-site client meeting']
    ]

    const instructionsWorksheet = XLSX.utils.aoa_to_sheet(instructionRows)
    instructionsWorksheet['!cols'] = [
        { wch: 100 }
    ]
    XLSX.utils.book_append_sheet(workbook, instructionsWorksheet, 'Read Me Instructions')

    return workbook
}

function generateMonthlyTemplate(
    employees: Array<{ id: string; full_name: string | null; email: string; designation: { name: string } | null }>,
    month: number,
    year: number
): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new()

    const rows: any[][] = []

    // Header row
    rows.push([
        'Sr',
        'Employee Name',
        'Email',
        'Designation',
        'Total Working Days',
        'Total Present',
        'Total Half Days',
        'Total Absent',
        'Total Leaves',
        'Total Working Hours'
    ])

    employees.forEach((emp, index) => {
        rows.push([
            index + 1,
            emp.full_name || '',
            emp.email,
            emp.designation?.name || '',
            '', // Total Working Days
            '', // Total Present
            '', // Total Half Days
            '', // Total Absent
            '', // Total Leaves
            ''  // Total Working Hours
        ])
    })

    const worksheet = XLSX.utils.aoa_to_sheet(rows)

    // Set column widths
    worksheet['!cols'] = [
        { wch: 5 },   // Sr
        { wch: 25 },  // Employee Name
        { wch: 30 },  // Email
        { wch: 20 },  // Designation
        { wch: 20 },  // Total Working Days
        { wch: 16 },  // Total Present
        { wch: 16 },  // Total Half Days
        { wch: 16 },  // Total Absent
        { wch: 14 },  // Total Leaves
        { wch: 22 },  // Total Working Hours
    ]

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Monthly Summary')

    // Create and append instructions worksheet
    const instructionRows = [
        ['INSTRUCTIONS FOR MONTHLY SUMMARY BULK UPLOAD'],
        [''],
        ['1. Do NOT modify or delete the pre-filled columns: Sr, Employee Name, Email, Designation.'],
        ['2. Fill in the following numeric columns for each active employee for the selected month:'],
        ['   - Total Working Days: Number of standard working days in the month (e.g., 26 or 30).'],
        ['   - Total Present: Number of days the employee was fully present.'],
        ['   - Total Half Days: Number of half-days worked.'],
        ['   - Total Absent: Number of days the employee was absent.'],
        ['   - Total Leaves: Number of approved leaves taken.'],
        ['   - Total Working Hours (Optional): The total cumulative hours worked in the month.'],
        ['3. Please ensure that: Total Present + Total Absent + Total Leaves + (Total Half Days * 0.5) equals the Total Working Days.'],
        ['4. Ensure all records are filled accurately before uploading. Any errors will prevent payroll from processing correctly.'],
        [''],
        ['EXAMPLE ENTRY:'],
        ['Sr', 'Employee Name', 'Email', 'Designation', 'Total Working Days', 'Total Present', 'Total Half Days', 'Total Absent', 'Total Leaves', 'Total Working Hours'],
        [1, 'John Doe', 'john@company.com', 'Developer', 26, 22, 2, 1, 1, 188.5]
    ]

    const instructionsWorksheet = XLSX.utils.aoa_to_sheet(instructionRows)
    instructionsWorksheet['!cols'] = [
        { wch: 100 }
    ]
    XLSX.utils.book_append_sheet(workbook, instructionsWorksheet, 'Read Me Instructions')

    return workbook
}
