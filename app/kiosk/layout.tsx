import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'PayFix Kiosk Terminal | Touchless Face Attendance',
    description: 'Always-On Entrance Selfie Attendance Kiosk for Employees',
    manifest: '/api/manifest?type=kiosk',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'PayFix Kiosk',
    },
};

export default function KioskLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
