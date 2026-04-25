import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
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
            workbook = generateDailyTemplate(employees, month, year)
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
    year: number
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

    let sr = 1
    for (const emp of employees) {
        // Add one row per working day per employee
        for (let d = 1; d <= lastDay; d++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            rows.push([
                sr++,
                emp.full_name || '',
                emp.email,
                emp.designation?.name || '',
                dateStr,
                '', // Check-In
                '', // Check-Out
                '', // Is Half Day
                ''  // Remarks
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
    return workbook
}
