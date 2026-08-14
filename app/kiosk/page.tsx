import React from 'react';
import { ExpressKioskApp } from '@/features/attendance/ExpressKioskApp';
import { OfflineBanner } from '@/components/ui/offline-banner';

export const metadata = {
    title: 'Express Selfie Kiosk Terminal | PayFix',
    description: 'Always-On Entrance Selfie Attendance Kiosk for Employees'
};

export default function KioskTerminalPage() {
    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-0 select-none">
            <OfflineBanner message="Kiosk Offline Mode: All employee selfie attendance punches are saved locally and will auto-sync." />
            <ExpressKioskApp />
        </div>
    );
}
