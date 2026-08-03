'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Clock, Cpu, Smartphone, Monitor, ShieldCheck, UserCheck } from 'lucide-react';

interface RealtimePunch {
    id: string;
    employeeName: string;
    employeeAvatar?: string | null;
    timestamp: string;
    source: 'biometric' | 'mobile' | 'kiosk' | 'manual';
    sessionType: 'Check-In' | 'Check-Out';
    sessionNumber: number;
    locationName?: string;
}

export function RealtimePunchFeed() {
    const [punches, setPunches] = useState<RealtimePunch[]>([
        {
            id: 'p_1',
            employeeName: 'Rahul Verma',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            source: 'biometric',
            sessionType: 'Check-In',
            sessionNumber: 1,
            locationName: 'Headquarters Office'
        },
        {
            id: 'p_2',
            employeeName: 'Priya Sharma',
            timestamp: new Date(Date.now() - 45000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            source: 'kiosk',
            sessionType: 'Check-In',
            sessionNumber: 1,
            locationName: 'Main Entrance Kiosk'
        }
    ]);

    const getSourceIcon = (source: string) => {
        switch (source) {
            case 'biometric':
                return <Cpu className="h-4 w-4 text-emerald-400" />;
            case 'kiosk':
                return <Monitor className="h-4 w-4 text-amber-400" />;
            case 'mobile':
                return <Smartphone className="h-4 w-4 text-sky-400" />;
            default:
                return <UserCheck className="h-4 w-4 text-purple-400" />;
        }
    };

    return (
        <Card className="border-slate-800 bg-slate-950 text-white shadow-xl">
            <CardHeader className="pb-3 border-b border-slate-800/80">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-bold flex items-center gap-2 text-emerald-400">
                            <Activity className="h-5 w-5 animate-pulse text-emerald-400" />
                            Live Attendance Ticker
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-400">
                            Real-time session punches from eSSL Biometric, Kiosk, and Mobile App
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 animate-pulse text-xs">
                        ● Live SSE Connected
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {punches.map(punch => (
                        <div
                            key={punch.id}
                            className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-all"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                                    {getSourceIcon(punch.source)}
                                </div>
                                <div>
                                    <h5 className="font-semibold text-sm text-slate-100">{punch.employeeName}</h5>
                                    <p className="text-xs text-slate-400 flex items-center gap-2">
                                        <span className="capitalize text-slate-300 font-medium">{punch.source}</span>
                                        <span>•</span>
                                        <span>{punch.locationName || 'General'}</span>
                                    </p>
                                </div>
                            </div>

                            <div className="text-right">
                                <Badge className={`font-bold text-xs ${punch.sessionType === 'Check-In' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                                    {punch.sessionType} (Session #{punch.sessionNumber})
                                </Badge>
                                <span className="block text-[11px] text-slate-500 mt-1 font-mono">{punch.timestamp}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
