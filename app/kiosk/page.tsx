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
            <OfflineBanner message="Kiosk Offline: Internet connection required for server-side facial verification. Reconnect to resume automatic punches." />
            <ExpressKioskApp />
        </div>
    );
}
