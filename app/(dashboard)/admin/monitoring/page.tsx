/**
 * Administrative Monitoring Interface
 * Comprehensive system monitoring and management dashboard
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RealTimeDashboard } from '@/components/monitoring/real-time-dashboard'
import { DebugTools } from '@/components/monitoring/debug-tools'

export const metadata = {
    title: 'System Monitoring | Admin Dashboard',
    description: 'Comprehensive monitoring and debugging tools for the real-time system'
}

export default function MonitoringPage() {
    return (
        <div className="flex-1 space-y-6 p-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">System Monitoring</h2>
                    <p className="text-muted-foreground">
                        Monitor, debug, and optimize your real-time system performance
                    </p>
                </div>
            </div>

            {/* Monitoring Components */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="xl:col-span-1">
                    <RealTimeDashboard />
                </div>
                <div className="xl:col-span-1">
                    <DebugTools />
                </div>
            </div>
        </div>
    )
}