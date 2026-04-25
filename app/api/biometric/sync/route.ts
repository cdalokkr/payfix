import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { attendance, employeeSettings, profiles } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { differenceInMinutes } from 'date-fns';

const BIOMETRIC_API_KEY = process.env.BIOMETRIC_API_KEY || 'default-biometric-secret-key-change-in-prod';

interface PunchLog {
    userId: string;
    timestamp: string; // ISO string
    punchType?: number; // Optional: 0 for Check-in, 1 for Check-out
}

interface SyncPayload {
    deviceId: string;
    logs: PunchLog[];
}

export async function POST(req: NextRequest) {
    try {
        // 1. Authenticate Request
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== BIOMETRIC_API_KEY) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse Payload
        const body: SyncPayload = await req.json();
        if (!body.deviceId || !Array.isArray(body.logs)) {
            return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 });
        }

        let processedCount = 0;
        let errorCount = 0;

        // 3. Process each punch log
        for (const log of body.logs) {
            try {
                // Find corresponding profile_id for this biometric userId
                const settings = await db.query.employeeSettings.findFirst({
                    where: eq(employeeSettings.biometric_device_user_id, log.userId),
                });

                if (!settings) {
                    console.warn(`[Biometric Sync] No profile mapped for biometric user ID: ${log.userId}`);
                    errorCount++;
                    continue;
                }

                const profileId = settings.profile_id;
                const punchTime = new Date(log.timestamp);
                
                // Format date as YYYY-MM-DD for attendance grouping
                const dateStr = punchTime.toISOString().split('T')[0];

                // Check if an attendance record already exists for this date and user
                const existingAttendance = await db.query.attendance.findFirst({
                    where: and(
                        eq(attendance.profile_id, profileId),
                        sql`DATE(${attendance.date}) = ${dateStr}`
                    ),
                    orderBy: [desc(attendance.created_at)]
                });

                if (!existingAttendance) {
                    // First punch of the day -> Check-In
                    await db.insert(attendance).values({
                        profile_id: profileId,
                        date: dateStr,
                        check_in: punchTime,
                        source: 'biometric',
                        device_id: body.deviceId,
                        status: 'pending',
                    });
                } else {
                    // Subsequent punch -> Check-Out
                    // Calculate working hours if we are updating the check-out time
                    // (Assuming earlier punch is check-in, later is check-out)
                    const checkInTime = existingAttendance.check_in ? new Date(existingAttendance.check_in) : null;
                    
                    if (checkInTime && punchTime > checkInTime) {
                        const diffMins = differenceInMinutes(punchTime, checkInTime);
                        const workingHours = (diffMins / 60).toFixed(2);

                        await db.update(attendance)
                            .set({
                                check_out: punchTime,
                                working_hours: workingHours,
                                source: 'biometric', // Mark the latest update as from biometric
                                device_id: body.deviceId,
                            })
                            .where(eq(attendance.id, existingAttendance.id));
                    }
                }

                processedCount++;
            } catch (err) {
                console.error(`[Biometric Sync] Error processing log for user ${log.userId}:`, err);
                errorCount++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${processedCount} punches. Errors: ${errorCount}.`
        });

    } catch (error) {
        console.error('[Biometric Sync] Fatal error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
