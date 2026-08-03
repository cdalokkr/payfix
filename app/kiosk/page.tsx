import React from 'react';
import { ExpressKioskApp } from '@/features/attendance/ExpressKioskApp';

export const metadata = {
    title: 'Express Selfie Kiosk Terminal | PayFix',
    description: 'Always-On Entrance Selfie Attendance Kiosk for Employees'
};

export default function KioskTerminalPage() {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-8">
            <ExpressKioskApp />
        </div>
    );
}
