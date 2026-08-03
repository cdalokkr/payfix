'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Cpu, Plus, Wifi, WifiOff, Copy, Check, Server, Radio, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface BiometricDevice {
    id: string;
    name: string;
    serialNumber: string;
    locationName?: string;
    ipAddress?: string;
    deviceType: 'adms' | 'socket' | 'desktop_bridge' | 'usb';
    status: 'active' | 'offline';
    lastSyncTime?: string;
}

export function BiometricDevicesManager() {
    const [devices, setDevices] = useState<BiometricDevice[]>([
        {
            id: 'dev_1',
            name: 'Main Entrance eSSL SilkFP',
            serialNumber: 'ESSL9908812',
            locationName: 'Headquarters Office - Gate 1',
            ipAddress: '192.168.1.201',
            deviceType: 'adms',
            status: 'active',
            lastSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        {
            id: 'dev_2',
            name: 'Warehouse Branch LAN Device',
            serialNumber: 'ESSLK3000412',
            locationName: 'Warehouse - Logistics Bay',
            ipAddress: '192.168.2.105',
            deviceType: 'socket',
            status: 'active',
            lastSyncTime: new Date(Date.now() - 120000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
    ]);

    const [copied, setCopied] = useState<boolean>(false);
    const [newDeviceName, setNewDeviceName] = useState<string>('');
    const [newDeviceSN, setNewDeviceSN] = useState<string>('');
    const [newDeviceType, setNewDeviceType] = useState<'adms' | 'socket' | 'desktop_bridge' | 'usb'>('adms');

    const pushServerUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/biometric/iclock` : 'https://payfix.app/api/biometric/iclock';
    const sampleApiKey = 'tenant-biometric-key-prod-881923';

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(pushServerUrl);
        setCopied(true);
        toast.success('ADMS Push Server URL copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleAddDevice = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDeviceName || !newDeviceSN) {
            toast.error('Please fill in Device Name and Serial Number.');
            return;
        }

        const created: BiometricDevice = {
            id: `dev_${Date.now()}`,
            name: newDeviceName,
            serialNumber: newDeviceSN,
            deviceType: newDeviceType,
            status: 'active',
            lastSyncTime: 'Just Now'
        };

        setDevices(prev => [...prev, created]);
        setNewDeviceName('');
        setNewDeviceSN('');
        toast.success(`Registered new eSSL Device: ${created.name}`);
    };

    return (
        <div className="space-y-6">
            {/* Header Card with Integration Push Credentials */}
            <Card className="border-border bg-card shadow-sm">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <Cpu className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-bold text-foreground">
                                Universal eSSL Hardware Integration
                            </CardTitle>
                            <CardDescription className="text-muted-foreground mt-0.5">
                                Supports ALL eSSL models (ADMS Direct Cloud Push, LAN TCP Socket Daemon, Desktop eTimeTrackLite MS SQL Bridge, and USB imports).
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* ADMS Push Server Endpoint */}
                        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                                eSSL ADMS Push Server URL (Set in Device Web UI / Menu)
                            </label>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 p-2.5 rounded-lg bg-muted text-emerald-700 dark:text-emerald-400 font-mono text-xs overflow-x-auto border border-border font-semibold">
                                    {pushServerUrl}
                                </code>
                                <Button onClick={handleCopyUrl} size="sm" variant="outline" className="border-border">
                                    {copied ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        {/* Tenant Biometric API Secret Key */}
                        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                                Workspace Biometric API Authorization Key
                            </label>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 p-2.5 rounded-lg bg-muted text-amber-700 dark:text-amber-400 font-mono text-xs overflow-x-auto border border-border font-semibold">
                                    {sampleApiKey}
                                </code>
                                <Button onClick={() => { navigator.clipboard.writeText(sampleApiKey); toast.success('API Key copied!'); }} size="sm" variant="outline" className="border-border">
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Active Biometric Devices List */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold">Registered eSSL Biometric Devices</CardTitle>
                            <CardDescription>Live health and status of connected biometric machines across branch locations</CardDescription>
                        </div>
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                            {devices.length} Devices Online
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {devices.map(device => (
                            <div key={device.id} className="p-4 rounded-xl border border-border bg-card hover:border-emerald-500/40 transition-all flex flex-col justify-between space-y-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="font-bold text-base text-foreground">{device.name}</h4>
                                        <p className="text-xs text-muted-foreground font-mono">SN: {device.serialNumber}</p>
                                    </div>
                                    <Badge variant={device.status === 'active' ? 'default' : 'destructive'} className="flex items-center gap-1">
                                        {device.status === 'active' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                                        {device.status === 'active' ? 'Online' : 'Offline'}
                                    </Badge>
                                </div>

                                <div className="text-xs space-y-1 text-muted-foreground">
                                    <p><strong className="text-foreground">Location:</strong> {device.locationName || 'Unassigned'}</p>
                                    <p><strong className="text-foreground">Method:</strong> <span className="uppercase text-amber-600 dark:text-amber-400 font-bold">{device.deviceType}</span></p>
                                    <p><strong className="text-foreground">Last Punch Sync:</strong> {device.lastSyncTime}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Add New eSSL Device Form */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-bold">Register New eSSL Biometric Machine</CardTitle>
                    <CardDescription>Link a new eSSL device to your branch office location</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAddDevice} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Input
                            placeholder="Device Name (e.g. Front Gate SilkFP)"
                            value={newDeviceName}
                            onChange={e => setNewDeviceName(e.target.value)}
                            className="w-full"
                        />
                        <Input
                            placeholder="Serial Number (SN)"
                            value={newDeviceSN}
                            onChange={e => setNewDeviceSN(e.target.value)}
                            className="w-full font-mono text-sm"
                        />
                        <div className="flex gap-2">
                            <select
                                value={newDeviceType}
                                onChange={e => setNewDeviceType(e.target.value as any)}
                                className="px-3 py-2 border rounded-md text-sm bg-background border-input flex-1 text-foreground"
                            >
                                <option value="adms">ADMS Cloud Push</option>
                                <option value="socket">LAN Socket Gateway</option>
                                <option value="desktop_bridge">Desktop MS SQL Bridge</option>
                                <option value="usb">USB Import</option>
                            </select>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                                <Plus className="h-4 w-4 mr-1" /> Add Device
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

