/**
 * KioskIndexedDBService — Browser IndexedDB storage for Kiosk Face Vectors & Offline Punch Queue
 *
 * Provides:
 * 1. Fast async storage for employee face vectors (unlimited quota, structured storage)
 * 2. Sync metadata tracking (lastSyncedAt, totalEmployees, tenantId)
 * 3. Offline attendance punch queueing for background sync when internet drops
 *
 * Pairing credentials deliberately do not live here. The active kiosk session
 * is an HttpOnly server cookie; IndexedDB may retain only non-sensitive device
 * display metadata and the stable installation identity.
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
     * Stable browser installation identity used to bind one pairing key to one
     * kiosk installation. It is separate from the pairing credential so
     * unpairing removes access without changing the hardware identity.
     */
    async getTerminalInstallationId(): Promise<string> {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_META, 'readwrite');
            const store = tx.objectStore(STORE_META);
            const existing = await new Promise<any>((resolve) => {
                const req = store.get('terminal_installation_id');
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            });
            if (existing?.value) {
                await new Promise<void>((resolve, reject) => {
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                });
                return existing.value;
            }
            const id = crypto.randomUUID();
            store.put({ key: 'terminal_installation_id', value: id, updatedAt: Date.now() });
            await new Promise<void>((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
            return id;
        } catch {
            return crypto.randomUUID();
        }
    },

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
     * Purge legacy employee template data while retaining the installation
     * identity and non-sensitive kiosk metadata. The live kiosk flow never
     * reads or writes face vectors.
     */
    async clearEmployeeTemplates(): Promise<void> {
        try {
            const db = await openDB();
            const tx = db.transaction([STORE_EMPLOYEES, STORE_META], 'readwrite');
            tx.objectStore(STORE_EMPLOYEES).clear();
            tx.objectStore(STORE_META).delete('sync-info');

            await new Promise<void>((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error);
            });
        } catch (err) {
            console.warn('[KioskIndexedDB] Failed to clear legacy employee templates:', err);
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
     * Save non-sensitive device metadata for the kiosk header. The credential
     * itself is issued and retained only by the server as an HttpOnly cookie.
     */
    async saveDeviceMetadata(deviceInfo: any): Promise<void> {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_META, 'readwrite');
            const store = tx.objectStore(STORE_META);
            const safeDeviceInfo = deviceInfo && typeof deviceInfo === 'object'
                ? {
                    id: typeof deviceInfo.id === 'string' ? deviceInfo.id : '',
                    name: typeof deviceInfo.name === 'string' ? deviceInfo.name : '',
                    locationId: deviceInfo.locationId ?? null,
                    locationName: deviceInfo.locationName ?? null,
                    latitude: typeof deviceInfo.latitude === 'number' ? deviceInfo.latitude : null,
                    longitude: typeof deviceInfo.longitude === 'number' ? deviceInfo.longitude : null,
                    radiusMeters: typeof deviceInfo.radiusMeters === 'number' ? deviceInfo.radiusMeters : 200,
                }
                : null;
            store.put({ key: 'device_metadata', value: safeDeviceInfo, updatedAt: Date.now() });
            await new Promise((res, rej) => {
                tx.oncomplete = () => res(null);
                tx.onerror = () => rej(tx.error);
            });
        } catch (err) {
            console.warn('[KioskIndexedDB] Failed to save device metadata:', err);
        }
    },

    /**
     * Read non-sensitive display metadata only. Pairing credentials are never
     * returned to page JavaScript.
     */
    async loadDeviceMetadata(): Promise<any | null> {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_META, 'readonly');
            const request = tx.objectStore(STORE_META).get('device_metadata');
            return await new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result?.value || null);
                request.onerror = () => resolve(null);
            });
        } catch {
            return null;
        }
    },

    /**
     * Existing kiosk builds stored the pairing secret in several browser
     * stores. Remove those copies on first open; the user can re-pair through
     * the authenticated admin setup screen.
     */
    async clearLegacyPairingStorage(): Promise<void> {
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
            await new Promise<void>((resolve) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
                tx.onabort = () => resolve();
            });
        } catch {}
        try {
            document.cookie = 'payfix_kiosk_pairing_code=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
            document.cookie = 'payfix_kiosk_device_info=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        } catch {}
    },

    async clearPairingCredentials(): Promise<void> {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_META, 'readwrite');
            const store = tx.objectStore(STORE_META);
            store.delete('device_metadata');
            await new Promise<void>((resolve) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
                tx.onabort = () => resolve();
            });
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
