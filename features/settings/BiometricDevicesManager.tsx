'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Cpu, Plus, Wifi, WifiOff, Copy, Check, Server, Radio, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface BiometricDevice {
    id: string;
    name: string;
    serialNumber: string;
    locationName?: string;
    ipAddress?: string;
    deviceType: string;
    status: 'active' | 'offline';
    lastSyncTime?: string;
}

export function BiometricDevicesManager() {
    const [devices, setDevices] = useState<BiometricDevice[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [apiKey, setApiKey] = useState<string>('bfx_live_timewatch_primary_2026');
    const [tenantName, setTenantName] = useState<string>('PayFix Corporate');
    const [copied, setCopied] = useState<boolean>(false);
    const [copiedKey, setCopiedKey] = useState<boolean>(false);
    const [newDeviceName, setNewDeviceName] = useState<string>('');
    const [newDeviceSN, setNewDeviceSN] = useState<string>('');
    const [newDeviceType, setNewDeviceType] = useState<string>('timewatch');
    const [pushServerUrl, setPushServerUrl] = useState<string>('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setPushServerUrl(`${window.location.origin}/api/biometric/sync`);
        }
    }, []);

    const fetchDevices = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/biometric/devices');
            if (res.ok) {
                const data = await res.json();
                if (data.devices) {
                    setDevices(data.devices);
                }
                if (data.apiKey) setApiKey(data.apiKey);
                if (data.tenantName) setTenantName(data.tenantName);
            }
        } catch (e) {
            console.error('Error loading devices:', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDevices();
    }, []);

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(pushServerUrl);
        setCopied(true);
        toast.success('Push Server URL copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyKey = () => {
        navigator.clipboard.writeText(apiKey);
        setCopiedKey(true);
        toast.success('Biometric API Key copied!');
        setTimeout(() => setCopiedKey(false), 2000);
    };

    const handleAddDevice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDeviceName || !newDeviceSN) {
            toast.error('Please fill in Device Name and Serial Number.');
            return;
        }

        try {
            const res = await fetch('/api/biometric/devices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newDeviceName,
                    serialNumber: newDeviceSN,
                    deviceType: newDeviceType,
                    ipAddress: '192.168.1.101'
                })
            });

            if (res.ok) {
                toast.success(`Registered new Device: ${newDeviceName}`);
                setNewDeviceName('');
                setNewDeviceSN('');
                fetchDevices();
            } else {
                toast.error('Failed to register device.');
            }
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Card with Integration Push Credentials */}
            <Card className="border-border bg-card shadow-sm">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <Cpu className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-bold text-foreground">
                                    Universal Biometric Hardware Integration
                                </CardTitle>
                                <CardDescription className="text-muted-foreground mt-0.5">
                                    Direct hardware communication for TimeWatch (ATF-305 / Realand), eSSL, ZKTeco, and BioMax terminals.
                                </CardDescription>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchDevices} disabled={isLoading} className="gap-2">
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Server Endpoint */}
                        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                                PayFix Cloud / Local Listener URL
                            </label>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 p-2.5 rounded-lg bg-muted text-emerald-700 dark:text-emerald-400 font-mono text-xs overflow-x-auto border border-border font-semibold" suppressHydrationWarning>
                                    {pushServerUrl || '/api/biometric/sync'}
                                </code>
                                <Button onClick={handleCopyUrl} size="sm" variant="outline" className="border-border">
                                    {copied ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        {/* Tenant Biometric API Secret Key */}
                        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                                Workspace API Key ({tenantName})
                            </label>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 p-2.5 rounded-lg bg-muted text-amber-700 dark:text-amber-400 font-mono text-xs overflow-x-auto border border-border font-semibold">
                                    {apiKey}
                                </code>
                                <Button onClick={handleCopyKey} size="sm" variant="outline" className="border-border">
                                    {copiedKey ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-4 w-4" />}
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
                            <CardTitle className="text-lg font-bold">Registered Biometric Devices ({tenantName})</CardTitle>
                            <CardDescription>Live health and status of connected biometric machines across branch locations</CardDescription>
                        </div>
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                            {devices.length} Devices Registered
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : devices.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No devices registered yet.</p>
                    ) : (
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
                                        <p><strong className="text-foreground">IP Address:</strong> {device.ipAddress || '192.168.1.101'}</p>
                                        <p><strong className="text-foreground">Protocol:</strong> <span className="uppercase text-amber-600 dark:text-amber-400 font-bold">{device.deviceType}</span></p>
                                        <p><strong className="text-foreground">Last Sync:</strong> {device.lastSyncTime || 'Real-time Connected'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add New Device Form */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-bold">Register New Biometric Machine</CardTitle>
                    <CardDescription>Link a new terminal to this workspace</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAddDevice} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Input
                            placeholder="Device Name (e.g. TimeWatch ATF-305)"
                            value={newDeviceName}
                            onChange={e => setNewDeviceName(e.target.value)}
                            className="w-full"
                        />
                        <Input
                            placeholder="Serial Number (e.g. TIPL...)"
                            value={newDeviceSN}
                            onChange={e => setNewDeviceSN(e.target.value)}
                            className="w-full font-mono text-sm"
                        />
                        <div className="flex gap-2">
                            <select
                                value={newDeviceType}
                                onChange={e => setNewDeviceType(e.target.value)}
                                className="px-3 py-2 border rounded-md text-sm bg-background border-input flex-1 text-foreground"
                            >
                                <option value="timewatch">TimeWatch / Realand (TCP 5005)</option>
                                <option value="adms">eSSL / ZKTeco (ADMS)</option>
                                <option value="socket">Raw Socket</option>
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
