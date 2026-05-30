import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import * as XLSX from 'xlsx'
import { AttendanceService } from '@/lib/services/attendance.service'
import { SalaryService } from '@/lib/services/salary.service'

export async function POST(request: NextRequest) {
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
            columns: { id: true, role: true, full_name: true }
        })

        if (!profile || (profile.role !== 'admin' && profile.role !== 'moderator')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Get the form data
        const formData = await request.formData()
        const file = formData.get('file') as File
        const type = formData.get('type') as string
        const month = parseInt(formData.get('month') as string || '0')
        const year = parseInt(formData.get('year') as string || '0')

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        if (!type || (type !== 'daily' && type !== 'monthly')) {
            return NextResponse.json({ error: 'Invalid type. Must be "daily" or "monthly"' }, { status: 400 })
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024
        if (file.size > maxSize) {
            return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 })
        }

        // Parse the Excel file
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true })

        if (rawData.length < 2) {
            return NextResponse.json({ error: 'File is empty or has no data rows' }, { status: 400 })
        }

        // Remove header row
        const dataRows = rawData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''))

        // Build email-to-profile map
        const allProfiles = await db.query.profiles.findMany({
            where: eq(profiles.status, 'active'),
            columns: { id: true, email: true, full_name: true }
        })
        const emailToProfile = new Map(allProfiles.map(p => [p.email.toLowerCase(), p]))

        if (type === 'daily') {
            const result = await processDailyUpload(dataRows, emailToProfile, profile.id, profile.full_name || 'Admin')
            return NextResponse.json(result)
        } else {
            if (!month || !year) {
                return NextResponse.json({ error: 'Month and year are required for monthly upload' }, { status: 400 })
            }
            const result = await processMonthlyUpload(dataRows, emailToProfile, month, year, profile.id, profile.full_name || 'Admin')
            return NextResponse.json(result)
        }

    } catch (error: any) {
        console.error('[ATTENDANCE-UPLOAD] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Upload processing failed' },
            { status: 500 }
        )
    }
}

/**
 * Helper to parse a time string in 12-hour or 24-hour format into standard HH:MM (24-hour).
 * Supports: "9:59", "18:00", "09:59 AM", "9:59AM", "6:00 PM", "6:00PM", "06:00 PM".
 */
function parseTimeString(str: string): string {
    const cleanStr = str.trim().toUpperCase()

    // 12-hour format match: e.g., "09:59 AM", "9:59AM", "6:00 PM", "6:00PM"
    const match12 = cleanStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/)
    if (match12) {
        let hours = parseInt(match12[1], 10)
        const minutes = match12[2]
        const ampm = match12[4]

        if (ampm === 'PM' && hours < 12) {
            hours += 12
        } else if (ampm === 'AM' && hours === 12) {
            hours = 0
        }

        return `${String(hours).padStart(2, '0')}:${minutes}`
    }

    // 24-hour format match: e.g., "18:00", "09:59", "9:59", "18:00:00"
    const match24 = cleanStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
    if (match24) {
        const hours = parseInt(match24[1], 10)
        const minutes = match24[2]
        if (hours >= 0 && hours < 24) {
            return `${String(hours).padStart(2, '0')}:${minutes}`
        }
    }

    return str
}

/**
 * Normalize an Excel date cell to YYYY-MM-DD string.
 * Handles: Date objects (cellDates:true), serial numbers, ISO strings, YYYY-MM-DD strings.
 * Uses local getters to extract exact values entered in Excel.
 */
function normalizeExcelDate(value: any): string | null {
    if (value == null || value === '') return null

    // Already a Date object (cellDates: true mode)
    if (value instanceof Date) {
        const y = value.getFullYear()
        const m = String(value.getMonth() + 1).padStart(2, '0')
        const d = String(value.getDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
    }

    const str = String(value).trim()

    // YYYY-MM-DD already
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str
    }

    // ISO datetime string like "2026-04-01T00:00:00.000Z"
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
        return str.substring(0, 10)
    }

    // Excel serial number (numeric — typically 5 digits for modern dates, 4 for older)
    const num = Number(str)
    if (!isNaN(num) && num > 1000 && num < 100000) {
        const parsed = XLSX.SSF.parse_date_code(num)
        if (parsed && parsed.y) {
            return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
        }
    }

    // DD/MM/YYYY or MM/DD/YYYY — attempt parse
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(str)) {
        const parts = str.split(/[\/\-]/)
        // Assume DD/MM/YYYY (Indian format)
        const day = parts[0].padStart(2, '0')
        const month = parts[1].padStart(2, '0')
        const year = parts[2]
        return `${year}-${month}-${day}`
    }

    return null
}

/**
 * Normalize an Excel time cell to HH:MM string.
 * Handles: decimal fractions (0.4167 = 10:00), Date objects, "HH:MM" strings, 12-hour strings, "HH:MM:SS" strings.
 * Uses local getters to extract exact values entered in Excel.
 */
function normalizeExcelTime(value: any): string {
    if (value == null || value === '') return ''

    // Date object (cellDates: true can produce Date for time-only cells)
    if (value instanceof Date) {
        const h = String(value.getHours()).padStart(2, '0')
        const m = String(value.getMinutes()).padStart(2, '0')
        return `${h}:${m}`
    }

    const str = String(value).trim()

    // Parse string via our helper supporting 12-hour and 24-hour formats
    const parsedTime = parseTimeString(str)
    if (/^\d{2}:\d{2}$/.test(parsedTime)) {
        return parsedTime
    }

    // Excel time as decimal fraction (0.0 to 1.0)
    // e.g. 0.4166667 = 10:00, 0.791667 = 19:00
    const num = Number(str)
    if (!isNaN(num) && num >= 0 && num < 1) {
        const totalMinutes = Math.round(num * 24 * 60)
        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    }

    // Excel time as decimal > 1 (e.g. when "10:00" is stored as 10.0 or similar — uncommon)
    if (!isNaN(num) && num >= 1 && num < 24) {
        const hours = Math.floor(num)
        const minutes = Math.round((num - hours) * 60)
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    }

    return str // return as-is if we can't parse it
}

// ==========================================
// Daily Upload Processor
// ==========================================

async function processDailyUpload(
    rows: any[][],
    emailMap: Map<string, { id: string; email: string; full_name: string | null }>,
    uploadedBy: string,
    uploaderName: string
) {
    const records: Array<{
        profileId: string
        date: string
        checkIn: string
        checkOut: string
        isHalfDay: boolean
        remarks?: string
    }> = []
    const errors: string[] = []
    let skippedRows = 0

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowNum = i + 2 // 1-indexed + header

        // Columns: Sr, Employee Name, Email, Designation, Date, Check-In, Check-Out, Is Half Day, Remarks
        const email = String(row[2] || '').trim().toLowerCase()
        const rawDate = row[4]
        const rawCheckIn = row[5]
        const rawCheckOut = row[6]
        const isHalfDayStr = String(row[7] || '').trim().toUpperCase()
        const remarks = String(row[8] || '').trim()

        if (!email) {
            skippedRows++
            continue
        }

        const profile = emailMap.get(email)
        if (!profile) {
            errors.push(`Row ${rowNum}: Employee "${email}" not found`)
            continue
        }

        // Normalize date from any Excel format
        const normalizedDate = normalizeExcelDate(rawDate)
        if (!normalizedDate) {
            if (rawDate == null || rawDate === '') {
                errors.push(`Row ${rowNum}: Missing date for ${email}`)
            } else {
                errors.push(`Row ${rowNum}: Invalid date "${rawDate}" for ${email}`)
            }
            continue
        }

        // Normalize times from any Excel format
        const checkIn = normalizeExcelTime(rawCheckIn)
        const checkOut = normalizeExcelTime(rawCheckOut)

        records.push({
            profileId: profile.id,
            date: normalizedDate,
            checkIn: checkIn || '',
            checkOut: checkOut || '',
            isHalfDay: isHalfDayStr === 'Y' || isHalfDayStr === 'YES',
            remarks: remarks || undefined
        })
    }

    // Use the service for bulk insert
    const result = await AttendanceService.bulkUploadDailyAttendance({
        records,
        uploadedBy,
        uploaderName
    })

    return {
        success: result.inserted,
        skipped: result.skipped + skippedRows,
        errors: [...errors, ...result.errors]
    }
}

async function processMonthlyUpload(
    rows: any[][],
    emailMap: Map<string, { id: string; email: string; full_name: string | null }>,
    month: number,
    year: number,
    uploadedBy: string,
    uploaderName: string
) {
    const records: Array<{
        profileId: string
        totalWorkingDays: number
        totalPresent: number
        totalHalfDays: number
        totalAbsent: number
        totalLeaves: number
        totalWorkingHours?: number
    }> = []
    const errors: string[] = []
    let skippedRows = 0

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowNum = i + 2

        // Columns: Sr, Employee Name, Email, Designation, Total Working Days, Total Present, Total Half Days, Total Absent, Total Leaves, Total Working Hours
        const email = String(row[2] || '').trim().toLowerCase()
        const totalWorkingDays = Number(row[4]) || 0
        const totalPresent = Number(row[5]) || 0
        const totalHalfDays = Number(row[6]) || 0
        const totalAbsent = Number(row[7]) || 0
        const totalLeaves = Number(row[8]) || 0
        const totalWorkingHours = Number(row[9]) || undefined

        if (!email) {
            skippedRows++
            continue
        }

        const profile = emailMap.get(email)
        if (!profile) {
            errors.push(`Row ${rowNum}: Employee "${email}" not found`)
            continue
        }

        // Skip rows where all numeric fields are 0/empty
        if (totalWorkingDays === 0 && totalPresent === 0 && totalAbsent === 0) {
            skippedRows++
            continue
        }

        records.push({
            profileId: profile.id,
            totalWorkingDays,
            totalPresent,
            totalHalfDays,
            totalAbsent,
            totalLeaves,
            totalWorkingHours,
        })
    }

    // Use the service for bulk insert
    const result = await SalaryService.bulkUploadMonthlySummary({
        month,
        year,
        records,
        uploadedBy,
        uploaderName
    })

    return {
        success: result.inserted + result.updated,
        skipped: result.skipped + skippedRows,
        errors: [...errors, ...result.errors]
    }
}
