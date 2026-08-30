import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import * as XLSX from 'xlsx'
import { AttendanceService } from '@/lib/services/attendance.service'
import { SalaryService } from '@/lib/services/salary.service'
import { runWithRequestHeaders } from '@/lib/tenant/with-context'

export async function POST(request: NextRequest) {
    return runWithRequestHeaders(async () => {
    try {
        // Verify user is authenticated
        const supabase = await createServerSupabaseClient()
        const { data, error } = await supabase.auth.getUser()
        const user = data?.user || null

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
        const preview = formData.get('preview') === 'true'

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
        const allProfiles = await db.select({
            id: profiles.id,
            email: profiles.email,
            full_name: profiles.full_name
        })
        .from(profiles)
        .where(eq(profiles.status, 'active'))
        
        const emailToProfile = new Map<string, any>(allProfiles.map(p => [p.email.toLowerCase(), p]))

        if (type === 'daily') {
            const result = await processDailyUpload(dataRows, emailToProfile, profile.id, profile.full_name || 'Admin', preview)
            return NextResponse.json(result)
        } else {
            if (!month || !year) {
                return NextResponse.json({ error: 'Month and year are required for monthly upload' }, { status: 400 })
            }
            const result = await processMonthlyUpload(dataRows, emailToProfile, month, year, profile.id, profile.full_name || 'Admin', preview)
            return NextResponse.json(result)
        }

    } catch (error: any) {
        console.error('[ATTENDANCE-UPLOAD] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Upload processing failed' },
            { status: 500 }
        )
    }
    })
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
    uploaderName: string,
    preview: boolean
) {
    const records: Array<{
        profileId: string
        date: string
        checkIn: string
        checkOut: string
        isHalfDay: boolean
        status?: string
        remarks?: string
    }> = []
    const errors: string[] = []
    let skippedRows = 0
    const skippedRecords: Array<{
        rowNum: number
        employeeName: string
        email: string
        date?: string
        reason: string
    }> = []

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowNum = i + 2 // 1-indexed + header

        // Columns: Sr, Employee Name, Email, Designation, Date, Check-In, Check-Out, Is Half Day, Day Status, Remarks
        const email = String(row[2] || '').trim().toLowerCase()
        const rawDate = row[4]
        const rawCheckIn = row[5]
        const rawCheckOut = row[6]
        const isHalfDayStr = String(row[7] || '').trim().toUpperCase()
        const dayStatusStr = String(row[8] || '').trim().toLowerCase()
        const remarks = String(row[9] || '').trim()

        if (!email) {
            skippedRows++
            skippedRecords.push({
                rowNum,
                employeeName: String(row[1] || 'Unknown').trim(),
                email: '',
                date: String(row[4] || ''),
                reason: 'Empty email cell'
            })
            continue
        }

        // Skip untouched pre-filled rows to prevent deleting existing DB records
        const checkInFilled = rawCheckIn !== undefined && String(rawCheckIn).trim() !== ''
        const checkOutFilled = rawCheckOut !== undefined && String(rawCheckOut).trim() !== ''
        const dayStatusFilled = dayStatusStr !== ''

        if (!checkInFilled && !checkOutFilled && !dayStatusFilled) {
            skippedRows++
            if (preview) {
                skippedRecords.push({
                    rowNum,
                    employeeName: String(row[1] || 'Unknown').trim(),
                    email,
                    date: String(rawDate || ''),
                    reason: 'Untouched row'
                })
            }
            continue
        }

        const profile = emailMap.get(email)
        if (!profile) {
            const errReason = `Employee profile not found for email "${email}"`
            errors.push(`Row ${rowNum}: ${errReason}`)
            skippedRecords.push({
                rowNum,
                employeeName: String(row[1] || 'Unknown').trim(),
                email,
                date: String(row[4] || ''),
                reason: errReason
            })
            continue
        }

        // Normalize date from any Excel format
        const normalizedDate = normalizeExcelDate(rawDate)
        if (!normalizedDate) {
            const dateReason = (rawDate == null || rawDate === '') ? 'Missing date value' : `Invalid date value "${rawDate}"`
            errors.push(`Row ${rowNum}: ${dateReason} for ${email}`)
            skippedRecords.push({
                rowNum,
                employeeName: profile.full_name || 'Unknown',
                email,
                date: String(rawDate || ''),
                reason: dateReason
            })
            continue
        }

        // Normalize times from any Excel format
        let checkIn = normalizeExcelTime(rawCheckIn)
        let checkOut = normalizeExcelTime(rawCheckOut)
        let status: string | undefined = undefined

        const hasTimes = checkIn !== '' || checkOut !== ''

        if (hasTimes) {
            status = undefined
        } else {
            if (dayStatusStr === 'absent' || dayStatusStr === 'leave') {
                status = dayStatusStr
            } else if (dayStatusStr === 'weekly off' || dayStatusStr === 'weekly_off') {
                status = 'weekly_off'
            } else if (dayStatusStr === 'holiday') {
                status = 'holiday'
            }
        }

        records.push({
            profileId: profile.id,
            date: normalizedDate,
            checkIn: checkIn || '',
            checkOut: checkOut || '',
            isHalfDay: isHalfDayStr === 'Y' || isHalfDayStr === 'YES',
            status,
            remarks: remarks || undefined
        })
    }

    // Use the service for bulk insert
    const result = await AttendanceService.bulkUploadDailyAttendance({
        records,
        uploadedBy,
        uploaderName,
        preview
    })

    if (preview) {
        const verifiedRecords: Array<{
            employeeName: string
            email: string
            date: string
            action: 'Insert' | 'Update' | 'Clear'
            details: string
        }> = []

        if (result.previewDetails) {
            for (const detail of result.previewDetails) {
                const prof = emailMap.get(detail.profileId) || [...emailMap.values()].find(p => p.id === detail.profileId)
                const employeeName = prof?.full_name || 'Unknown'
                const email = prof?.email || ''

                if (detail.action === 'Skip') {
                    skippedRecords.push({
                        rowNum: 0,
                        employeeName,
                        email,
                        date: detail.date,
                        reason: detail.reason || 'Bypassed'
                    })
                } else {
                    verifiedRecords.push({
                        employeeName,
                        email,
                        date: detail.date,
                        action: detail.action,
                        details: detail.details
                    })
                }
            }
        }

        // Sort verified and skipped records to be clean
        verifiedRecords.sort((a, b) => a.employeeName.localeCompare(b.employeeName) || a.date.localeCompare(b.date))
        skippedRecords.sort((a, b) => a.rowNum - b.rowNum || a.employeeName.localeCompare(b.employeeName))

        return {
            preview: true,
            toInsert: result.toInsert,
            toUpdate: result.toUpdate,
            toDelete: result.toDelete,
            skipped: result.skipped + skippedRows,
            errors: [...errors, ...result.errors],
            verifiedRecords,
            skippedRecords
        }
    }

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
    uploaderName: string,
    preview: boolean
) {
    const records: Array<{
        profileId: string
        totalWorkingDays: number
        totalPresent: number
        totalHalfDays: number
        totalAbsent: number
        totalLeaves: number
        extraDays: number
    }> = []
    const errors: string[] = []
    let skippedRows = 0
    const skippedRecords: Array<{
        rowNum: number
        employeeName: string
        email: string
        reason: string
    }> = []

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowNum = i + 2

        // Columns: Sr, Employee Name, Email, Designation, Total Present, Total Half Days, Total Absent, Total Leaves, Extra Days
        const email = String(row[2] || '').trim().toLowerCase()
        const totalPresent = Number(row[4]) || 0
        const totalHalfDays = Number(row[5]) || 0
        const totalAbsent = Number(row[6]) || 0
        const totalLeaves = Number(row[7]) || 0
        const extraDays = Number(row[8]) || 0

        // Default working days to calendar days
        const totalWorkingDays = new Date(year, month, 0).getDate()

        if (!email) {
            skippedRows++
            skippedRecords.push({
                rowNum,
                employeeName: String(row[1] || 'Unknown').trim(),
                email: '',
                reason: 'Empty email cell'
            })
            continue
        }

        const profile = emailMap.get(email)
        if (!profile) {
            const errReason = `Employee profile not found for email "${email}"`
            errors.push(`Row ${rowNum}: ${errReason}`)
            skippedRecords.push({
                rowNum,
                employeeName: String(row[1] || 'Unknown').trim(),
                email,
                reason: errReason
            })
            continue
        }

        // Skip rows where all numeric fields are 0/empty
        if (totalPresent === 0 && totalAbsent === 0 && totalHalfDays === 0 && totalLeaves === 0 && extraDays === 0) {
            skippedRows++
            skippedRecords.push({
                rowNum,
                employeeName: profile.full_name || 'Unknown',
                email,
                reason: 'All numeric attendance stats are zero'
            })
            continue
        }

        records.push({
            profileId: profile.id,
            totalWorkingDays,
            totalPresent,
            totalHalfDays,
            totalAbsent,
            totalLeaves,
            extraDays,
        })
    }

    // Use the service for bulk insert
    const result = await SalaryService.bulkUploadMonthlySummary({
        month,
        year,
        records,
        uploadedBy,
        uploaderName,
        preview
    })

    if (preview) {
        const verifiedRecords: Array<{
            employeeName: string
            email: string
            action: 'Insert' | 'Update'
            details: string
        }> = []

        if (result.previewDetails) {
            for (const detail of result.previewDetails) {
                const prof = emailMap.get(detail.profileId) || [...emailMap.values()].find(p => p.id === detail.profileId)
                const employeeName = prof?.full_name || 'Unknown'
                const email = prof?.email || ''

                if (detail.action === 'Skip') {
                    skippedRecords.push({
                        rowNum: 0,
                        employeeName,
                        email,
                        reason: detail.reason || 'Bypassed'
                    })
                } else {
                    verifiedRecords.push({
                        employeeName,
                        email,
                        action: detail.action,
                        details: detail.details
                    })
                }
            }
        }

        // Sort records cleanly
        verifiedRecords.sort((a, b) => a.employeeName.localeCompare(b.employeeName))
        skippedRecords.sort((a, b) => a.rowNum - b.rowNum || a.employeeName.localeCompare(b.employeeName))

        return {
            preview: true,
            toInsert: result.toInsert,
            toUpdate: result.toUpdate,
            skipped: result.skipped + skippedRows,
            errors: [...errors, ...result.errors],
            verifiedRecords,
            skippedRecords
        }
    }

    return {
        success: result.inserted + result.updated,
        skipped: result.skipped + skippedRows,
        errors: [...errors, ...result.errors]
    }
}
