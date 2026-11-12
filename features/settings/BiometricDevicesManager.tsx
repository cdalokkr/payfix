'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Cpu,
    Plus,
    Wifi,
    WifiOff,
    Copy,
    Check,
    RefreshCw,
    Loader2,
    Radio,
    Activity,
    Pencil,
    Trash2,
    AlertTriangle,
    MapPin,
    ShieldCheck,
    Network,
    CheckCircle2,
    XCircle,
    Info,
    Server,
    Sparkles,
    Download,
    Users,
    UserCheck,
    UserX,
    Search,
    FileSpreadsheet,
    Hash,
    Filter,
    X,
} from 'lucide-react';
import { toast } from 'sonner';

interface BiometricDevice {
    id: string;
    name: string;
    serialNumber: string;
    locationId?: string | null;
    locationName?: string | null;
    ipAddress?: string;
    deviceType: string;
    status: 'active' | 'offline';
    lastSyncTime?: string;
    lastSyncDate?: string | null;
    apiKey?: string;
}

interface MappedUser {
    id: string;
    fullName: string;
    email: string;
    role: string;
    departmentName: string | null;
    designationName: string | null;
    biometricDeviceId: string | null;
    hasSettings: boolean;
}

interface MappingStats {
    totalUsers: number;
    linkedCount: number;
    unlinkedCount: number;
    nextRecommendedId: string;
}

interface UnmappedPunch {
    biometricUserId: string;
    deviceId: string | null;
    punchTime: string;
    count: number;
}

interface LocationOption {
    id: string;
    name: string;
}

interface PingResult {
    reachable: boolean;
    latency: number;
    message: string;
    status: 'active' | 'offline';
    checkedAt: string;
}

const PROTOCOL_OPTIONS = [
    { value: 'timewatch', label: 'TimeWatch / Realand (TCP 5005)', port: 5005, color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
    { value: 'fkweb', label: 'TimeWatch Cloud ID (FKWeb)', port: 5005, color: 'text-sky-600 bg-sky-500/10 border-sky-500/20' },
    { value: 'adms', label: 'eSSL / ZKTeco (ADMS Push)', port: 4370, color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
    { value: 'biomax', label: 'BioMax Terminal (TCP/Cloud)', port: 5005, color: 'text-purple-600 bg-purple-500/10 border-purple-500/20' },
    { value: 'socket', label: 'Raw TCP Socket / Desktop Bridge', port: 5005, color: 'text-slate-600 bg-slate-500/10 border-slate-500/20' },
];

export function BiometricDevicesManager() {
    const [devices, setDevices] = useState<BiometricDevice[]>([]);
    const [locations, setLocations] = useState<LocationOption[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [apiKey, setApiKey] = useState<string>('bfx_live_timewatch_primary_2026');
    const [tenantName, setTenantName] = useState<string>('PayFix Corporate');
    const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
    const [copiedKey, setCopiedKey] = useState<boolean>(false);
    const [pushServerUrl, setPushServerUrl] = useState<string>('');

    // Ping State
    const [pingingId, setPingingId] = useState<string | null>(null);
    const [pingResults, setPingResults] = useState<Record<string, PingResult>>({});

    // Register Form State
    const [newDeviceName, setNewDeviceName] = useState<string>('');
    const [newDeviceSN, setNewDeviceSN] = useState<string>('');
    const [newDeviceIP, setNewDeviceIP] = useState<string>('192.168.1.101:5005');
    const [newDeviceType, setNewDeviceType] = useState<string>('timewatch');
    const [newLocationId, setNewLocationId] = useState<string>('');
    const [isAdding, setIsAdding] = useState<boolean>(false);
    const [isTestingNew, setIsTestingNew] = useState<boolean>(false);
    const [testResultNew, setTestResultNew] = useState<{ reachable: boolean; latency: number; message: string; detectedSerialNumber?: string | null } | null>(null);

    // Edit Modal State
    const [editingDevice, setEditingDevice] = useState<BiometricDevice | null>(null);
    const [editForm, setEditForm] = useState({
        name: '',
        serialNumber: '',
        ipAddress: '',
        deviceType: 'timewatch',
        locationId: '',
        status: 'active' as 'active' | 'offline',
    });
    const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
    const [isTestingEdit, setIsTestingEdit] = useState<boolean>(false);
    const [testResultEdit, setTestResultEdit] = useState<{ reachable: boolean; latency: number; message: string; detectedSerialNumber?: string | null } | null>(null);

    // Check for duplicate serial number in Add form
    const duplicateDevice = React.useMemo(() => {
        const sn = newDeviceSN.trim().toLowerCase();
        if (!sn) return null;
        return devices.find(d => d.serialNumber.trim().toLowerCase() === sn) || null;
    }, [devices, newDeviceSN]);

    // Delete Modal State
    const [deletingDevice, setDeletingDevice] = useState<BiometricDevice | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    // User Biometric Mapping State
    const [mappedUsers, setMappedUsers] = useState<MappedUser[]>([]);
    const [mappingStats, setMappingStats] = useState<MappingStats>({ totalUsers: 0, linkedCount: 0, unlinkedCount: 0, nextRecommendedId: '1' });
    const [unmappedPunches, setUnmappedPunches] = useState<UnmappedPunch[]>([]);
    const [isMappingLoading, setIsMappingLoading] = useState<boolean>(true);
    const [userSearch, setUserSearch] = useState<string>('');
    const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'employee' | 'moderator'>('all');
    const [userLinkFilter, setUserLinkFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [inlineIdValue, setInlineIdValue] = useState<string>('');
    const [savingUserId, setSavingUserId] = useState<string | null>(null);
    const [isAutoAssigning, setIsAutoAssigning] = useState<boolean>(false);
    const [isExporting, setIsExporting] = useState<boolean>(false);

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
                if (data.locations) {
                    setLocations(data.locations);
                }
                if (data.apiKey) setApiKey(data.apiKey);
                if (data.tenantName) setTenantName(data.tenantName);
            }
        } catch (e) {
            console.error('Error loading devices:', e);
            toast.error('Failed to load biometric devices');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchUserMappings = async () => {
        setIsMappingLoading(true);
        try {
            const res = await fetch('/api/biometric/users/mapping');
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setMappedUsers(data.users || []);
                    setMappingStats(data.stats || { totalUsers: 0, linkedCount: 0, unlinkedCount: 0, nextRecommendedId: '1' });
                    setUnmappedPunches(data.unmappedPunches || []);
                }
            }
        } catch (e) {
            console.error('Error loading user biometric mappings:', e);
        } finally {
            setIsMappingLoading(false);
        }
    };

    useEffect(() => {
        fetchDevices();
        fetchUserMappings();
    }, []);

    const handleStartEditUser = (user: MappedUser) => {
        setEditingUserId(user.id);
        setInlineIdValue(user.biometricDeviceId || mappingStats.nextRecommendedId || '1');
    };

    const handleSaveUserBiometricId = async (profileId: string, bioId: string | null) => {
        setSavingUserId(profileId);
        try {
            const res = await fetch('/api/biometric/users/mapping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profileId,
                    biometricDeviceId: bioId ? bioId.trim() : null
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(bioId ? `Machine ID #${bioId.trim()} linked successfully!` : 'Biometric ID unlinked');
                setEditingUserId(null);
                fetchUserMappings();
            } else {
                toast.error(data.error || 'Failed to update machine ID');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error updating machine ID');
        } finally {
            setSavingUserId(null);
        }
    };

    const handleAutoAssignAll = async () => {
        setIsAutoAssigning(true);
        try {
            const res = await fetch('/api/biometric/users/mapping', {
                method: 'PUT'
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(data.message || 'Auto-assigned machine IDs to all unlinked users!');
                fetchUserMappings();
            } else {
                toast.error(data.error || 'Auto-assign failed');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error executing auto-assign');
        } finally {
            setIsAutoAssigning(false);
        }
    };

    const handleDownloadMachineExcel = async (userId?: string, newOnly?: boolean) => {
        setIsExporting(true);
        try {
            const query = userId ? `?userId=${userId}` : newOnly ? '?newOnly=true' : '';
            const res = await fetch(`/api/biometric/users/export${query}`);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Export failed');
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const suffix = userId ? 'Single_User' : newOnly ? 'New_Users_Only' : 'All_Users';
            a.download = `PayFix_Biometric_${suffix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success(userId ? 'Downloaded Machine Excel for this user!' : 'Downloaded Machine Upload Excel! Ready for USB / TimeWatch import.');
        } catch (err: any) {
            toast.error(err.message || 'Failed to download machine Excel');
        } finally {
            setIsExporting(false);
        }
    };

    const filteredUsers = React.useMemo(() => {
        return mappedUsers.filter(u => {
            if (userSearch.trim()) {
                const q = userSearch.toLowerCase();
                const matchName = u.fullName?.toLowerCase().includes(q);
                const matchEmail = u.email?.toLowerCase().includes(q);
                const matchBio = u.biometricDeviceId?.toLowerCase().includes(q);
                const matchDept = u.departmentName?.toLowerCase().includes(q);
                const matchDesig = u.designationName?.toLowerCase().includes(q);
                if (!matchName && !matchEmail && !matchBio && !matchDept && !matchDesig) return false;
            }
            if (userRoleFilter !== 'all' && u.role.toLowerCase() !== userRoleFilter.toLowerCase()) {
                return false;
            }
            if (userLinkFilter === 'linked' && !u.biometricDeviceId) return false;
            if (userLinkFilter === 'unlinked' && u.biometricDeviceId) return false;

            return true;
        });
    }, [mappedUsers, userSearch, userRoleFilter, userLinkFilter]);

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(pushServerUrl);
        setCopiedUrl(true);
        toast.success('Push Server URL copied to clipboard!');
        setTimeout(() => setCopiedUrl(false), 2000);
    };

    const handleCopyKey = () => {
        navigator.clipboard.writeText(apiKey);
        setCopiedKey(true);
        toast.success('Biometric API Key copied to clipboard!');
        setTimeout(() => setCopiedKey(false), 2000);
    };

    const handleCopySN = (sn: string) => {
        navigator.clipboard.writeText(sn);
        toast.success(`Serial Number ${sn} copied!`);
    };

    // 1. Ping / Test Connection Handler
    const handlePingDevice = async (device: BiometricDevice) => {
        setPingingId(device.id);
        try {
            const res = await fetch('/api/biometric/devices/ping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: device.id,
                    ipAddress: device.ipAddress || '192.168.1.101',
                    deviceType: device.deviceType,
                    serialNumber: device.serialNumber
                })
            });

            const data = await res.json();
            if (data.success) {
                setPingResults(prev => ({
                    ...prev,
                    [device.id]: {
                        reachable: data.reachable,
                        latency: data.latency,
                        message: data.message,
                        status: data.status,
                        checkedAt: data.checkedAt
                    }
                }));

                // Update device status in local list
                setDevices(prev => prev.map(d =>
                    d.id === device.id ? { ...d, status: data.status, lastSyncTime: data.reachable ? 'Just now' : d.lastSyncTime } : d
                ));

                if (data.reachable) {
                    toast.success(`Online: ${device.name} responded in ${data.latency}ms`);
                } else {
                    toast.warning(`Unreachable: ${device.name} — ${data.message}`);
                }
            } else {
                toast.error(data.error || 'Failed to ping device');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error pinging device');
        } finally {
            setPingingId(null);
        }
    };

    // 2. Pre-Test connection in Register Form
    const handleTestConnectionNew = async () => {
        if (!newDeviceIP) {
            toast.error('Please enter an IP Address to test');
            return;
        }

        setIsTestingNew(true);
        setTestResultNew(null);
        try {
            const res = await fetch('/api/biometric/devices/ping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ipAddress: newDeviceIP,
                    deviceType: newDeviceType,
                    serialNumber: newDeviceSN
                })
            });

            const data = await res.json();
            setTestResultNew({
                reachable: data.reachable,
                latency: data.latency,
                message: data.message,
                detectedSerialNumber: data.detectedSerialNumber || null
            });

            if (data.reachable) {
                if (data.detectedSerialNumber) {
                    setNewDeviceSN(data.detectedSerialNumber);
                    if (!newDeviceName.trim()) {
                        setNewDeviceName(`TimeWatch ATF-305 (${data.detectedSerialNumber.slice(-6)})`);
                    }
                    toast.success(`Online (${data.latency}ms)! Hardware SN auto-detected: ${data.detectedSerialNumber}`);
                } else {
                    toast.success(`Connection Successful (${data.latency}ms)`);
                }
            } else {
                toast.warning(`Device Unreachable: ${data.message}`);
            }
        } catch (err: any) {
            toast.error(err.message || 'Connection test failed');
        } finally {
            setIsTestingNew(false);
        }
    };

    // 3. Add Device Form Submit
    const handleAddDevice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDeviceName.trim() || !newDeviceSN.trim()) {
            toast.error('Please provide both Device Name and Serial Number.');
            return;
        }

        if (duplicateDevice) {
            toast.error(`Device with Serial Number "${newDeviceSN.trim()}" is already registered as "${duplicateDevice.name}". You can edit the existing device above.`);
            return;
        }

        setIsAdding(true);
        try {
            const selectedLoc = locations.find(l => l.id === newLocationId);
            const res = await fetch('/api/biometric/devices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newDeviceName.trim(),
                    serialNumber: newDeviceSN.trim(),
                    deviceType: newDeviceType,
                    ipAddress: newDeviceIP.trim() || '192.168.1.101:5005',
                    locationId: newLocationId || null,
                    locationName: selectedLoc?.name || null
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(`Device "${newDeviceName}" registered successfully!`);
                setNewDeviceName('');
                setNewDeviceSN('');
                setNewDeviceIP('192.168.1.101:5005');
                setNewLocationId('');
                setTestResultNew(null);
                fetchDevices();
            } else {
                toast.error(data.error || 'Failed to register biometric device.');
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to register device.');
        } finally {
            setIsAdding(false);
        }
    };

    // 4. Open Edit Modal
    const handleOpenEdit = (device: BiometricDevice) => {
        setEditingDevice(device);
        setEditForm({
            name: device.name,
            serialNumber: device.serialNumber,
            ipAddress: device.ipAddress || '192.168.1.101:5005',
            deviceType: device.deviceType || 'timewatch',
            locationId: device.locationId || '',
            status: device.status || 'active',
        });
        setTestResultEdit(null);
    };

    // 5. Test Connection in Edit Modal
    const handleTestConnectionEdit = async () => {
        if (!editForm.ipAddress) {
            toast.error('Please enter an IP address');
            return;
        }

        setIsTestingEdit(true);
        setTestResultEdit(null);
        try {
            const res = await fetch('/api/biometric/devices/ping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingDevice?.id,
                    ipAddress: editForm.ipAddress,
                    deviceType: editForm.deviceType,
                    serialNumber: editForm.serialNumber
                })
            });

            const data = await res.json();
            setTestResultEdit({
                reachable: data.reachable,
                latency: data.latency,
                message: data.message,
                detectedSerialNumber: data.detectedSerialNumber || null
            });

            if (data.reachable) {
                if (data.detectedSerialNumber && !editForm.serialNumber) {
                    setEditForm(prev => ({ ...prev, serialNumber: data.detectedSerialNumber }));
                    toast.success(`Online (${data.latency}ms)! Hardware SN auto-detected: ${data.detectedSerialNumber}`);
                } else {
                    toast.success(`Device reachable (${data.latency}ms)`);
                }
            } else {
                toast.warning(`Device unreachable: ${data.message}`);
            }
        } catch (err: any) {
            toast.error(err.message || 'Test connection error');
        } finally {
            setIsTestingEdit(false);
        }
    };

    // 6. Save Edit Changes
    const handleSaveEdit = async () => {
        if (!editingDevice) return;
        if (!editForm.name.trim() || !editForm.serialNumber.trim()) {
            toast.error('Name and Serial Number are required.');
            return;
        }

        const otherWithSameSN = devices.find(
            d => d.id !== editingDevice.id && d.serialNumber.trim().toLowerCase() === editForm.serialNumber.trim().toLowerCase()
        );
        if (otherWithSameSN) {
            toast.error(`Serial Number "${editForm.serialNumber.trim()}" is already registered to "${otherWithSameSN.name}". Serial numbers must be unique.`);
            return;
        }

        setIsSavingEdit(true);
        try {
            const selectedLoc = locations.find(l => l.id === editForm.locationId);
            const res = await fetch('/api/biometric/devices', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingDevice.id,
                    name: editForm.name.trim(),
                    serialNumber: editForm.serialNumber.trim(),
                    ipAddress: editForm.ipAddress.trim(),
                    deviceType: editForm.deviceType,
                    locationId: editForm.locationId || null,
                    locationName: selectedLoc?.name || null,
                    status: editForm.status
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(`Updated "${editForm.name}" successfully!`);
                setEditingDevice(null);
                fetchDevices();
            } else {
                toast.error(data.error || 'Failed to update device.');
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to update device.');
        } finally {
            setIsSavingEdit(false);
        }
    };

    // 7. Delete Device Handlers
    const handleOpenDelete = (device: BiometricDevice) => {
        setDeletingDevice(device);
    };

    const handleConfirmDelete = async () => {
        if (!deletingDevice) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/biometric/devices?id=${deletingDevice.id}`, {
                method: 'DELETE'
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(`Removed biometric machine "${deletingDevice.name}"`);
                setDeletingDevice(null);
                fetchDevices();
            } else {
                toast.error(data.error || 'Failed to delete device.');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error deleting device.');
        } finally {
            setIsDeleting(false);
        }
    };

    const getProtocolMeta = (type: string) => {
        const found = PROTOCOL_OPTIONS.find(p => p.value.toLowerCase() === type.toLowerCase());
        return found || { value: type, label: type.toUpperCase(), port: 5005, color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' };
    };

    return (
        <div className="space-y-6">
            {/* Header Card with Integration Credentials */}
            <Card className="border-border bg-card shadow-xs rounded-2xl overflow-hidden">
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
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
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchDevices}
                            disabled={isLoading}
                            className="gap-2 h-9 rounded-xl font-medium"
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Server Endpoint */}
                        <div className="p-4 rounded-xl bg-muted/40 border border-border/70 space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                                PayFix Cloud / Local Listener URL
                            </label>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 p-2.5 rounded-lg bg-card text-emerald-700 dark:text-emerald-400 font-mono text-xs overflow-x-auto border border-border font-semibold shadow-xs" suppressHydrationWarning>
                                    {pushServerUrl || '/api/biometric/sync'}
                                </code>
                                <Button
                                    onClick={handleCopyUrl}
                                    size="sm"
                                    variant="outline"
                                    className="border-border rounded-lg h-9 px-3 shrink-0"
                                    title="Copy Push Server URL"
                                >
                                    {copiedUrl ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        {/* Tenant Biometric API Secret Key */}
                        <div className="p-4 rounded-xl bg-muted/40 border border-border/70 space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                                Workspace API Key ({tenantName})
                            </label>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 p-2.5 rounded-lg bg-card text-amber-700 dark:text-amber-400 font-mono text-xs overflow-x-auto border border-border font-semibold shadow-xs">
                                    {apiKey}
                                </code>
                                <Button
                                    onClick={handleCopyKey}
                                    size="sm"
                                    variant="outline"
                                    className="border-border rounded-lg h-9 px-3 shrink-0"
                                    title="Copy API Secret Key"
                                >
                                    {copiedKey ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Active Biometric Devices List */}
            <Card className="rounded-2xl border-border/80 shadow-xs">
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                Registered Biometric Devices ({tenantName})
                            </CardTitle>
                            <CardDescription>
                                Live health, ping connectivity, and management for connected biometric machines
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 font-semibold rounded-lg w-fit">
                            {devices.length} Devices Registered
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-12 space-y-3">
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                            <p className="text-xs text-muted-foreground font-medium">Scanning biometric machines...</p>
                        </div>
                    ) : devices.length === 0 ? (
                        <div className="text-center py-12 px-4 border border-dashed rounded-2xl bg-muted/10 space-y-2">
                            <Cpu className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                            <h4 className="font-semibold text-sm text-foreground">No biometric devices linked yet</h4>
                            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                                Register your first TimeWatch, eSSL, or ZKTeco terminal using the form below to begin automated biometric attendance synchronization.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {devices.map(device => {
                                const protoMeta = getProtocolMeta(device.deviceType);
                                const isPinging = pingingId === device.id;
                                const pingData = pingResults[device.id];
                                const isOnline = device.status === 'active';

                                return (
                                    <div
                                        key={device.id}
                                        className="p-5 rounded-2xl border border-border/80 bg-card hover:border-emerald-500/40 hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                                    >
                                        {/* Card Top: Name, Status & Protocol */}
                                        <div className="space-y-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="space-y-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h4 className="font-bold text-base text-foreground truncate" title={device.name}>
                                                            {device.name}
                                                        </h4>
                                                        <Badge variant="outline" className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${protoMeta.color}`}>
                                                            {protoMeta.label.split(' ')[0]}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                        <MapPin className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                                                        <span className="truncate">{device.locationName || 'Default Branch'}</span>
                                                    </div>
                                                </div>

                                                {/* Live Status Badge */}
                                                <Badge
                                                    variant="outline"
                                                    className={isOnline
                                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 text-xs font-bold px-2.5 py-1 gap-1.5 shrink-0"
                                                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25 text-xs font-bold px-2.5 py-1 gap-1.5 shrink-0"
                                                    }
                                                >
                                                    {isOnline ? (
                                                        <>
                                                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                                            Online{pingData?.latency ? ` · ${pingData.latency}ms` : ''}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <WifiOff className="h-3 w-3" />
                                                            Offline
                                                        </>
                                                    )}
                                                </Badge>
                                            </div>

                                            {/* Details Grid */}
                                            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/40 text-muted-foreground bg-muted/20 p-2.5 rounded-xl">
                                                <div>
                                                    <span className="text-muted-foreground/70 block text-[10px] font-semibold uppercase tracking-wider">Serial Number</span>
                                                    <div className="flex items-center gap-1 mt-0.5">
                                                        <span className="font-mono font-bold text-foreground text-xs truncate">{device.serialNumber}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopySN(device.serialNumber)}
                                                            className="text-muted-foreground hover:text-foreground p-0.5 rounded-md hover:bg-muted"
                                                            title="Copy Serial Number"
                                                        >
                                                            <Copy className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div>
                                                    <span className="text-muted-foreground/70 block text-[10px] font-semibold uppercase tracking-wider">IP & Port</span>
                                                    <span className="font-mono text-foreground font-semibold block mt-0.5 truncate">{device.ipAddress || '192.168.1.101:5005'}</span>
                                                </div>

                                                <div>
                                                    <span className="text-muted-foreground/70 block text-[10px] font-semibold uppercase tracking-wider">Protocol</span>
                                                    <span className="font-medium text-foreground block mt-0.5 truncate">{protoMeta.label}</span>
                                                </div>

                                                <div>
                                                    <span className="text-muted-foreground/70 block text-[10px] font-semibold uppercase tracking-wider">Last Sync</span>
                                                    <span className="font-medium text-foreground block mt-0.5 truncate">{device.lastSyncTime || 'Connected'}</span>
                                                </div>
                                            </div>

                                            {/* Recent Ping Message Banner */}
                                            {pingData && (
                                                <div className={`text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 ${
                                                    pingData.reachable
                                                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                                                        : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                                                }`}>
                                                    {pingData.reachable ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                                                    <span className="truncate">{pingData.message}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Toolbar */}
                                        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/50">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handlePingDevice(device)}
                                                disabled={isPinging}
                                                className="h-8 text-xs font-semibold gap-1.5 rounded-xl border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                                            >
                                                {isPinging ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <Radio className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                                )}
                                                Ping Connection
                                            </Button>

                                            <div className="flex items-center gap-1.5">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleOpenEdit(device)}
                                                    className="h-8 text-xs font-semibold gap-1.5 rounded-xl"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                    Edit
                                                </Button>

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleOpenDelete(device)}
                                                    className="h-8 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 rounded-xl px-2.5"
                                                    title="Remove device"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* SECTION: User Biometric Mapping (Employees & Moderators) */}
            <Card className="rounded-2xl border-border/80 shadow-xs overflow-hidden">
                <CardHeader className="bg-muted/15 border-b border-border/60 pb-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
                                <Users className="h-5 w-5" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <CardTitle className="text-lg font-bold text-foreground">
                                        Biometric User Enrollment & Machine Mapping
                                    </CardTitle>
                                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-md">
                                        {mappingStats.linkedCount} / {mappingStats.totalUsers} Linked
                                    </Badge>
                                    {mappingStats.unlinkedCount > 0 && (
                                        <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-bold px-2 py-0.5 rounded-md">
                                            {mappingStats.unlinkedCount} Unlinked
                                        </Badge>
                                    )}
                                </div>
                                <CardDescription className="text-xs">
                                    Link tenant employees and moderators to hardware enrollment IDs (e.g. 1, 2, 80). Punches from physical biometric machines automatically clock users in and out.
                                </CardDescription>
                            </div>
                        </div>

                        {/* Top Action Buttons: Download Excel + 1-Click Auto Assign */}
                        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
                            <Button
                                onClick={() => handleDownloadMachineExcel()}
                                disabled={isExporting}
                                className="h-9 px-3.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-1.5"
                                title="Download Excel formatted for TimeWatch ATF-305 / USB terminal upload"
                            >
                                {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                                Download Machine Excel
                            </Button>

                            <Button
                                variant="outline"
                                onClick={handleAutoAssignAll}
                                disabled={isAutoAssigning || mappingStats.unlinkedCount === 0}
                                className="h-9 px-3.5 text-xs font-bold rounded-xl border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 gap-1.5"
                                title="Auto-assign sequential IDs (1, 2, 3...) to all unlinked employees & moderators"
                            >
                                {isAutoAssigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                1-Click Auto-Assign ({mappingStats.unlinkedCount})
                            </Button>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={fetchUserMappings}
                                disabled={isMappingLoading}
                                className="h-9 w-9 p-0 rounded-xl"
                                title="Refresh User List"
                            >
                                <RefreshCw className={`h-4 w-4 ${isMappingLoading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-5 space-y-4">
                    {/* Unmapped Punches Alert Banner */}
                    {unmappedPunches.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-300">
                            <div className="flex items-start gap-2.5">
                                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-bold block">Punches Received from Unlinked Terminal Machine IDs:</span>
                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                        {unmappedPunches.map(p => (
                                            <Badge key={p.biometricUserId} variant="outline" className="font-mono font-bold bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/30 text-[11px]">
                                                ID #{p.biometricUserId} ({p.count} punches)
                                            </Badge>
                                        ))}
                                    </div>
                                    <span className="text-[11px] text-muted-foreground block mt-1">
                                        Assign an employee or moderator to these IDs below to automatically back-fill attendance sessions.
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Filter & Search Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1 max-w-sm">
                            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                            <Input
                                placeholder="Search by name, email, or machine ID..."
                                value={userSearch}
                                onChange={e => setUserSearch(e.target.value)}
                                className="pl-8 h-9 text-xs rounded-xl bg-card border-border/80"
                            />
                            {userSearch && (
                                <button
                                    onClick={() => setUserSearch('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>

                        {/* Filters */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Role Filter */}
                            <Select value={userRoleFilter} onValueChange={(val: any) => setUserRoleFilter(val)}>
                                <SelectTrigger className="h-9 text-xs rounded-xl w-[140px] bg-card border-border/80">
                                    <SelectValue placeholder="All Roles" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="all" className="text-xs">All Roles ({mappedUsers.length})</SelectItem>
                                    <SelectItem value="employee" className="text-xs">Employees</SelectItem>
                                    <SelectItem value="moderator" className="text-xs">Moderators</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Status Filter */}
                            <Select value={userLinkFilter} onValueChange={(val: any) => setUserLinkFilter(val)}>
                                <SelectTrigger className="h-9 text-xs rounded-xl w-[130px] bg-card border-border/80">
                                    <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="all" className="text-xs">All Status</SelectItem>
                                    <SelectItem value="linked" className="text-xs">Linked ({mappingStats.linkedCount})</SelectItem>
                                    <SelectItem value="unlinked" className="text-xs">Unlinked ({mappingStats.unlinkedCount})</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Table of Users */}
                    {isMappingLoading ? (
                        <div className="flex flex-col items-center justify-center p-10 space-y-2">
                            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                            <p className="text-xs text-muted-foreground font-medium">Loading user biometric directory...</p>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="text-center py-10 px-4 border border-dashed rounded-xl bg-muted/10 space-y-1.5">
                            <Users className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                            <h4 className="font-semibold text-xs text-foreground">No matching users found</h4>
                            <p className="text-[11px] text-muted-foreground">
                                Try adjusting your search query or filters above.
                            </p>
                        </div>
                    ) : (
                        <div className="border border-border/80 rounded-xl overflow-hidden bg-card">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="border-border/60 hover:bg-transparent">
                                        <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider h-9">
                                            Member & Role
                                        </TableHead>
                                        <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider h-9">
                                            Department & Designation
                                        </TableHead>
                                        <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider h-9 text-center">
                                            Machine ID (Enrollment No.)
                                        </TableHead>
                                        <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider h-9 text-center">
                                            Clock In / Out Status
                                        </TableHead>
                                        <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider h-9 text-right">
                                            Actions
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.map(user => {
                                        const isEditing = editingUserId === user.id;
                                        const isSaving = savingUserId === user.id;
                                        const isLinked = !!user.biometricDeviceId;
                                        const initials = (user.fullName || user.email || 'U')
                                            .split(' ')
                                            .map(w => w[0])
                                            .slice(0, 2)
                                            .join('')
                                            .toUpperCase();

                                        const roleBadge = user.role === 'moderator' ? (
                                            <Badge variant="outline" className="text-[10px] uppercase font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20 px-1.5 py-0">
                                                Moderator
                                            </Badge>
                                        ) : user.role === 'employee' ? (
                                            <Badge variant="outline" className="text-[10px] uppercase font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20 px-1.5 py-0">
                                                Employee
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 px-1.5 py-0">
                                                {user.role}
                                            </Badge>
                                        );

                                        return (
                                            <TableRow key={user.id} className="border-border/50 hover:bg-muted/20">
                                                {/* Member & Role */}
                                                <TableCell className="py-2.5">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-purple-600/20 to-emerald-600/20 text-foreground font-bold text-xs flex items-center justify-center shrink-0 border border-border">
                                                            {initials}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="font-bold text-xs text-foreground truncate max-w-[160px]" title={user.fullName}>
                                                                    {user.fullName || 'No Name'}
                                                                </span>
                                                                {roleBadge}
                                                            </div>
                                                            <span className="text-[11px] text-muted-foreground truncate block max-w-[200px]" title={user.email}>
                                                                {user.email}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                {/* Department & Designation */}
                                                <TableCell className="py-2.5 text-xs">
                                                    <div>
                                                        <span className="font-medium text-foreground block truncate max-w-[180px]">
                                                            {user.departmentName || 'General Dept.'}
                                                        </span>
                                                        <span className="text-[11px] text-muted-foreground block truncate max-w-[180px]">
                                                            {user.designationName || 'Staff Member'}
                                                        </span>
                                                    </div>
                                                </TableCell>

                                                {/* Machine ID (Enrollment No.) */}
                                                <TableCell className="py-2.5 text-center">
                                                    {isEditing ? (
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <Input
                                                                type="text"
                                                                value={inlineIdValue}
                                                                onChange={e => setInlineIdValue(e.target.value)}
                                                                placeholder="e.g. 1"
                                                                className="w-20 h-7 text-xs font-mono font-bold text-center rounded-lg bg-card border-purple-500/50"
                                                                autoFocus
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        handleSaveUserBiometricId(user.id, inlineIdValue);
                                                                    } else if (e.key === 'Escape') {
                                                                        setEditingUserId(null);
                                                                    }
                                                                }}
                                                            />
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleSaveUserBiometricId(user.id, inlineIdValue)}
                                                                disabled={isSaving}
                                                                className="h-7 w-7 p-0 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/15"
                                                                title="Save ID"
                                                            >
                                                                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => setEditingUserId(null)}
                                                                className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                                                                title="Cancel"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    ) : isLinked ? (
                                                        <div className="inline-flex items-center gap-1.5">
                                                            <Badge variant="outline" className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                                                                #{user.biometricDeviceId}
                                                            </Badge>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[11px] text-muted-foreground italic">
                                                            Unlinked
                                                        </span>
                                                    )}
                                                </TableCell>

                                                {/* Clock In / Out Status */}
                                                <TableCell className="py-2.5 text-center">
                                                    {isLinked ? (
                                                        <div className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                            Auto-Syncs
                                                        </div>
                                                    ) : (
                                                        <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                                                            Manual / Web only
                                                        </div>
                                                    )}
                                                </TableCell>

                                                {/* Actions */}
                                                <TableCell className="py-2.5 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {isLinked ? (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleDownloadMachineExcel(user.id)}
                                                                    className="h-7 px-2 text-xs font-semibold rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                                                    title="Download Machine Excel for this user only"
                                                                >
                                                                    <Download className="h-3 w-3" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleStartEditUser(user)}
                                                                    className="h-7 px-2 text-xs font-semibold rounded-lg text-muted-foreground hover:text-foreground"
                                                                    title="Change Machine ID"
                                                                >
                                                                    <Pencil className="h-3 w-3" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleSaveUserBiometricId(user.id, null)}
                                                                    disabled={savingUserId === user.id}
                                                                    className="h-7 px-2 text-xs font-semibold rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                                                                    title="Unlink Machine ID"
                                                                >
                                                                    <UserX className="h-3 w-3" />
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleStartEditUser(user)}
                                                                className="h-7 px-2.5 text-[11px] font-bold rounded-lg border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 gap-1"
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                                Link ID
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Bottom Form: Register New Biometric Machine (Modern SaaS Layout) */}
            <Card className="rounded-2xl border-border/80 shadow-xs overflow-hidden">
                <CardHeader className="bg-muted/15 border-b border-border/60 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-lg font-bold text-foreground">
                                    Register New Biometric Machine
                                </CardTitle>
                                <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                    Universal Hardware Support
                                </Badge>
                            </div>
                            <CardDescription>
                                Link a physical fingerprint, facial recognition, or RFID terminal to this workspace
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-6">
                    <form onSubmit={handleAddDevice} className="space-y-5">
                        {/* 5-Field Responsive SaaS Form Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Field 1: Device Name */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                                    <span>Device Name <span className="text-rose-500">*</span></span>
                                </label>
                                <Input
                                    placeholder="e.g. Reception ATF-305 Face Machine"
                                    value={newDeviceName}
                                    onChange={e => setNewDeviceName(e.target.value)}
                                    className="w-full rounded-xl bg-card border-border/80 font-medium"
                                    required
                                />
                                <p className="text-[11px] text-muted-foreground">Recognizable friendly terminal name</p>
                            </div>

                            {/* Field 2: Serial Number */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                                    <span>Hardware Serial Number (SN) <span className="text-rose-500">*</span></span>
                                    {testResultNew?.detectedSerialNumber && (
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                            <Sparkles className="h-3 w-3" /> Auto-Detected
                                        </span>
                                    )}
                                </label>
                                <Input
                                    placeholder="e.g. TIPL596270523057"
                                    value={newDeviceSN}
                                    onChange={e => setNewDeviceSN(e.target.value)}
                                    className={`w-full font-mono text-sm rounded-xl bg-card font-semibold uppercase transition-colors ${
                                        duplicateDevice
                                            ? 'border-amber-500/60 ring-1 ring-amber-500/20'
                                            : testResultNew?.detectedSerialNumber
                                                ? 'border-emerald-500/60 ring-1 ring-emerald-500/20'
                                                : 'border-border/80'
                                    }`}
                                    required
                                />
                                {duplicateDevice ? (
                                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1.5 rounded-lg">
                                        <span className="flex items-center gap-1 font-medium">
                                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                            Already registered as <strong>&ldquo;{duplicateDevice.name}&rdquo;</strong>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEdit(duplicateDevice)}
                                            className="underline font-bold text-amber-800 dark:text-amber-200 hover:text-amber-900 shrink-0 cursor-pointer"
                                        >
                                            Edit Machine ✏
                                        </button>
                                    </div>
                                ) : testResultNew?.detectedSerialNumber ? (
                                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                        <Check className="h-3 w-3" /> Auto-retrieved from device ping handshake
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-muted-foreground">Auto-fills when ping succeeds, or enter manually</p>
                                )}
                            </div>

                            {/* Field 3: IP Address & Port */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                                    <span>Terminal IP & Port</span>
                                </label>
                                <Input
                                    placeholder="192.168.1.101:5005"
                                    value={newDeviceIP}
                                    onChange={e => setNewDeviceIP(e.target.value)}
                                    className="w-full font-mono text-sm rounded-xl bg-card border-border/80"
                                />
                                <p className="text-[11px] text-muted-foreground">Local LAN IP or static public IP:Port</p>
                            </div>

                            {/* Field 4: Hardware Protocol */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                                    <span>Hardware Protocol <span className="text-rose-500">*</span></span>
                                </label>
                                <Select value={newDeviceType} onValueChange={setNewDeviceType}>
                                    <SelectTrigger className="w-full rounded-xl bg-card border-border/80 h-9 font-medium">
                                        <SelectValue placeholder="Select protocol" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {PROTOCOL_OPTIONS.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value} className="text-xs font-medium">
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-[11px] text-muted-foreground">Push or direct socket driver format</p>
                            </div>

                            {/* Field 5: Office Location / Branch */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                                    <span>Office Location / Branch</span>
                                </label>
                                <Select value={newLocationId} onValueChange={setNewLocationId}>
                                    <SelectTrigger className="w-full rounded-xl bg-card border-border/80 h-9 font-medium">
                                        <SelectValue placeholder="Select Branch (Optional)" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="unassigned" className="text-xs font-medium text-muted-foreground">
                                            Default / Main Branch
                                        </SelectItem>
                                        {locations.map(loc => (
                                            <SelectItem key={loc.id} value={loc.id} className="text-xs font-medium">
                                                {loc.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-[11px] text-muted-foreground">Tag punches to specific office boundary</p>
                            </div>
                        </div>

                        {/* Test Connection Result Box if tested */}
                        {testResultNew && (
                            <div className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                testResultNew.reachable
                                    ? duplicateDevice
                                        ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25'
                                        : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25'
                            }`}>
                                <div className="flex items-center gap-2">
                                    {testResultNew.reachable ? (
                                        duplicateDevice ? (
                                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                        ) : (
                                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                        )
                                    ) : (
                                        <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                                    )}
                                    <span className="font-semibold">{testResultNew.message}</span>
                                </div>
                                {duplicateDevice ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleOpenEdit(duplicateDevice)}
                                        className="h-7 text-[11px] font-bold rounded-lg border-amber-500/30 text-amber-800 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 gap-1 shrink-0 self-end sm:self-auto cursor-pointer"
                                    >
                                        <Pencil className="h-3 w-3" />
                                        Edit Existing: {duplicateDevice.name}
                                    </Button>
                                ) : testResultNew.detectedSerialNumber ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setNewDeviceSN(testResultNew.detectedSerialNumber!);
                                            toast.success(`Applied Serial Number: ${testResultNew.detectedSerialNumber}`);
                                        }}
                                        className="h-7 text-[11px] font-bold rounded-lg border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 gap-1 shrink-0 self-end sm:self-auto"
                                    >
                                        <Sparkles className="h-3 w-3" />
                                        Apply SN: {testResultNew.detectedSerialNumber}
                                    </Button>
                                ) : null}
                            </div>
                        )}

                        {/* Form Bottom Action Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-border/50">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>Configured terminals will automatically authenticate using workspace API credentials</span>
                            </div>

                            <div className="flex items-center gap-2.5 sm:ml-auto">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleTestConnectionNew}
                                    disabled={isTestingNew || !newDeviceIP}
                                    className="h-10 text-xs font-bold rounded-xl border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1.5"
                                >
                                    {isTestingNew ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
                                    Test Connection
                                </Button>

                                {duplicateDevice ? (
                                    <Button
                                        type="button"
                                        onClick={() => handleOpenEdit(duplicateDevice)}
                                        className="h-10 px-4 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs gap-1.5 cursor-pointer"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit Existing Machine
                                    </Button>
                                ) : (
                                    <Button
                                        type="submit"
                                        disabled={isAdding}
                                        className="h-10 px-5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-1.5"
                                    >
                                        {isAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-4 w-4" />}
                                        Add Device
                                    </Button>
                                )}
                            </div>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Edit Biometric Device Dialog */}
            <Dialog open={!!editingDevice} onOpenChange={open => !open && setEditingDevice(null)}>
                <DialogContent className="max-w-lg rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <Pencil className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            Edit Biometric Machine
                        </DialogTitle>
                        <DialogDescription>
                            Update network IP, hardware protocol, and office branch assignment.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-foreground">Device Name</label>
                            <Input
                                value={editForm.name}
                                onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                className="rounded-xl font-medium"
                                placeholder="Device Name"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-foreground">Serial Number (SN)</label>
                            <Input
                                value={editForm.serialNumber}
                                onChange={e => setEditForm(prev => ({ ...prev, serialNumber: e.target.value }))}
                                className="font-mono text-sm rounded-xl font-semibold uppercase"
                                placeholder="Hardware SN"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground">IP Address & Port</label>
                                <Input
                                    value={editForm.ipAddress}
                                    onChange={e => setEditForm(prev => ({ ...prev, ipAddress: e.target.value }))}
                                    className="font-mono text-sm rounded-xl"
                                    placeholder="192.168.1.101:5005"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground">Protocol</label>
                                <Select
                                    value={editForm.deviceType}
                                    onValueChange={val => setEditForm(prev => ({ ...prev, deviceType: val }))}
                                >
                                    <SelectTrigger className="w-full rounded-xl h-9 text-xs font-medium">
                                        <SelectValue placeholder="Select protocol" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {PROTOCOL_OPTIONS.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value} className="text-xs font-medium">
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-foreground">Branch / Office Location</label>
                            <Select
                                value={editForm.locationId || 'unassigned'}
                                onValueChange={val => setEditForm(prev => ({ ...prev, locationId: val === 'unassigned' ? '' : val }))}
                            >
                                <SelectTrigger className="w-full rounded-xl h-9 text-xs font-medium">
                                    <SelectValue placeholder="Select Branch" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="unassigned" className="text-xs font-medium text-muted-foreground">
                                        Default / Main Branch
                                    </SelectItem>
                                    {locations.map(loc => (
                                        <SelectItem key={loc.id} value={loc.id} className="text-xs font-medium">
                                            {loc.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Test result in Edit dialog */}
                        {testResultEdit && (
                            <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                                testResultEdit.reachable
                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25'
                            }`}>
                                {testResultEdit.reachable ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                                <span>{testResultEdit.message}</span>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between items-center gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleTestConnectionEdit}
                            disabled={isTestingEdit}
                            className="w-full sm:w-auto text-xs font-semibold rounded-xl border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1.5"
                        >
                            {isTestingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
                            Test Ping
                        </Button>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingDevice(null)}
                                className="rounded-xl text-xs font-medium"
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSaveEdit}
                                disabled={isSavingEdit}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                            >
                                {isSavingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                                Save Changes
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deletingDevice} onOpenChange={open => !open && setDeletingDevice(null)}>
                <DialogContent className="max-w-md rounded-2xl p-6">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-bold text-foreground">
                                    Remove Biometric Machine
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                    This action will disconnect hardware data synchronization.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="py-3 text-xs text-muted-foreground leading-relaxed">
                        Are you sure you want to remove <strong className="text-foreground">{deletingDevice?.name}</strong> (SN: <code className="font-mono font-bold text-foreground">{deletingDevice?.serialNumber}</code>)?
                        Raw punch audit records will remain archived in the attendance database.
                    </div>

                    <DialogFooter className="flex items-center justify-end gap-2 pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingDevice(null)}
                            disabled={isDeleting}
                            className="rounded-xl text-xs font-medium"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleConfirmDelete}
                            disabled={isDeleting}
                            className="rounded-xl text-xs font-bold gap-1.5"
                        >
                            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            Delete Machine
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
