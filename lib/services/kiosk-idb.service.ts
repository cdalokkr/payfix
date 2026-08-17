/**
 * KioskIndexedDBService — Browser IndexedDB storage for Kiosk Face Vectors & Offline Punch Queue
 *
 * Provides:
 * 1. Fast async storage for employee face vectors (unlimited quota, structured storage)
 * 2. Sync metadata tracking (lastSyncedAt, totalEmployees, tenantId)
 * 3. Offline attendance punch queueing for background sync when internet drops
 */

const DB_NAME = 'payfix_kiosk_db';
const DB_VERSION = 2;
const STORE_EMPLOYEES = 'cached_employees';
const STORE_PUNCH_QUEUE = 'offline_punch_queue';
const STORE_META = 'kiosk_meta';

export interface OfflinePunch {
    id: string;
    biometricUserId?: string;
    profileId?: string;
    employeeName: string;
    timestamp: string;
    actionType: 'check_in' | 'check_out' | 'auto';
    matchScore: number;
    synced: boolean;
}

export interface SyncInfo {
    key: string;
    lastSyncedAt: number;
    tenantId?: string;
    totalEmployees: number;
    enrolledEmployees: number;
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            reject(new Error('IndexedDB not supported in this browser'));
            return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_EMPLOYEES)) {
                db.createObjectStore(STORE_EMPLOYEES, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_PUNCH_QUEUE)) {
                db.createObjectStore(STORE_PUNCH_QUEUE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_META)) {
                db.createObjectStore(STORE_META, { keyPath: 'key' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export const KioskIndexedDBService = {
    /**
     * Save employee face vectors and sync metadata to IndexedDB
     */
    async saveEmployees(employees: any[], tenantId?: string): Promise<void> {
        try {
            const db = await openDB();
            const tx = db.transaction([STORE_EMPLOYEES, STORE_META], 'readwrite');
            const empStore = tx.objectStore(STORE_EMPLOYEES);
            const metaStore = tx.objectStore(STORE_META);

            // Clear old cached employees
            await new Promise((res) => {
                const clearReq = empStore.clear();
                clearReq.onsuccess = () => res(true);
            });

            // Store new employees
            for (const emp of employees) {
                empStore.put(emp);
            }

            const enrolledCount = employees.filter(e => e.faceEmbedding && e.faceEmbedding.length === 512).length;

            // Save sync metadata
            metaStore.put({
                key: 'sync-info',
                lastSyncedAt: Date.now(),
                tenantId: tenantId || 'default',
                totalEmployees: employees.length,
                enrolledEmployees: enrolledCount
            });

            return new Promise((resolve, reject) => {
                tx.oncomplete = () => {
                    console.log(`[IndexedDB] Successfully cached ${employees.length} employees (${enrolledCount} enrolled vectors) in IndexedDB.`);
                    resolve();
                };
                tx.onerror = () => reject(tx.error);
            });
        } catch (err) {
            console.warn('[KioskIndexedDB] Failed to save employees:', err);
        }
    },

    /**
     * Get cached employee face vectors from IndexedDB
     */
    async getEmployees(): Promise<any[]> {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_EMPLOYEES, 'readonly');
            const store = tx.objectStore(STORE_EMPLOYEES);
            const request = store.getAll();

            return new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            });
        } catch {
            return [];
        }
    },

    /**
     * Get IndexedDB Sync Info (lastSyncedAt, enrolledEmployees, etc.)
     */
    async getSyncInfo(): Promise<SyncInfo | null> {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_META, 'readonly');
            const store = tx.objectStore(STORE_META);
            const request = store.get('sync-info');

            return new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => resolve(null);
            });
        } catch {
            return null;
        }
    },

    /**
     * Queue offline punch when network is disconnected
     */
    async queueOfflinePunch(punch: OfflinePunch): Promise<void> {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_PUNCH_QUEUE, 'readwrite');
            const store = tx.objectStore(STORE_PUNCH_QUEUE);
            store.put(punch);

            return new Promise((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (err) {
            console.warn('[KioskIndexedDB] Failed to queue offline punch:', err);
        }
    },

    /**
     * Get all pending offline punches
     */
    async getPendingPunches(): Promise<OfflinePunch[]> {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_PUNCH_QUEUE, 'readonly');
            const store = tx.objectStore(STORE_PUNCH_QUEUE);
            const request = store.getAll();

            return new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            });
        } catch {
            return [];
        }
    },

    /**
     * Clear punch queue after successful cloud sync
     */
    async clearPunchQueue(): Promise<void> {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_PUNCH_QUEUE, 'readwrite');
            const store = tx.objectStore(STORE_PUNCH_QUEUE);
            store.clear();
        } catch {}
    },

    /**
     * Save Kiosk Pairing Key and Device Info persistently to IndexedDB and long-lived cookies
     */
    async savePairingCredentials(pairingCode: string, deviceInfo: any): Promise<void> {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_META, 'readwrite');
            const store = tx.objectStore(STORE_META);
            store.put({ key: 'pairing_code', value: pairingCode, updatedAt: Date.now() });
            store.put({ key: 'device_info', value: deviceInfo, updatedAt: Date.now() });
            await new Promise((res, rej) => {
                tx.oncomplete = () => res(null);
                tx.onerror = () => rej(tx.error);
            });
        } catch {}

        try {
            if (typeof document !== 'undefined') {
                const exp = new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000).toUTCString();
                document.cookie = `payfix_kiosk_pairing_code=${encodeURIComponent(pairingCode)}; expires=${exp}; path=/; SameSite=Lax`;
                if (deviceInfo) {
                    document.cookie = `payfix_kiosk_device_info=${encodeURIComponent(JSON.stringify(deviceInfo))}; expires=${exp}; path=/; SameSite=Lax`;
                }
            }
        } catch {}
    },

    /**
     * Load Pairing Credentials from LocalStorage || IndexedDB || Cookies
     */
    async loadPairingCredentials(): Promise<{ pairingCode: string | null; deviceInfo: any | null }> {
        let code: string | null = null;
        let device: any = null;

        // 1. Try LocalStorage
        try {
            code = localStorage.getItem('payfix_kiosk_pairing_code');
            const rawDev = localStorage.getItem('payfix_kiosk_device_info');
            if (rawDev) device = JSON.parse(rawDev);
        } catch {}

        // 2. Try IndexedDB if not found
        if (!code) {
            try {
                const db = await openDB();
                const tx = db.transaction(STORE_META, 'readonly');
                const store = tx.objectStore(STORE_META);
                const reqCode = store.get('pairing_code');
                const reqDev = store.get('device_info');
                await new Promise((res) => {
                    tx.oncomplete = () => {
                        if (reqCode.result?.value) code = reqCode.result.value;
                        if (reqDev.result?.value) device = reqDev.result.value;
                        res(null);
                    };
                    tx.onerror = () => res(null);
                });
            } catch {}
        }

        // 3. Try Cookies if still not found
        if (!code && typeof document !== 'undefined') {
            try {
                const cookies = document.cookie.split(';');
                for (const c of cookies) {
                    const [k, v] = c.trim().split('=');
                    if (k === 'payfix_kiosk_pairing_code' && v) {
                        code = decodeURIComponent(v);
                    }
                    if (k === 'payfix_kiosk_device_info' && v) {
                        device = JSON.parse(decodeURIComponent(v));
                    }
                }
            } catch {}
        }

        // Auto-heal LocalStorage if recovered from IDB / Cookie
        if (code && typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem('payfix_kiosk_pairing_code', code);
                if (device) localStorage.setItem('payfix_kiosk_device_info', JSON.stringify(device));
            } catch {}
        }

        return { pairingCode: code, deviceInfo: device };
    },

    async clearPairingCredentials(): Promise<void> {
        try {
            localStorage.removeItem('payfix_kiosk_pairing_code');
            localStorage.removeItem('payfix_kiosk_device_info');
        } catch {}
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_META, 'readwrite');
            const store = tx.objectStore(STORE_META);
            store.delete('pairing_code');
            store.delete('device_info');
        } catch {}
        try {
            document.cookie = 'payfix_kiosk_pairing_code=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
            document.cookie = 'payfix_kiosk_device_info=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        } catch {}
    },

    /**
     * Clear all cached data from IndexedDB
     */
    async clearAll(): Promise<void> {
        try {
            const db = await openDB();
            const tx = db.transaction([STORE_EMPLOYEES, STORE_PUNCH_QUEUE, STORE_META], 'readwrite');
            tx.objectStore(STORE_EMPLOYEES).clear();
            tx.objectStore(STORE_PUNCH_QUEUE).clear();
            tx.objectStore(STORE_META).clear();
        } catch (err) {
            console.error('[KioskIndexedDB] Failed to clear IndexedDB:', err);
        }
    }
};
