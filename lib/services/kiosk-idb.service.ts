/**
 * KioskIndexedDBService — Browser IndexedDB storage for Kiosk Face Vectors & Offline Punch Queue
 *
 * Provides:
 * 1. Fast async storage for employee face vectors (unlimited quota, structured storage)
 * 2. Offline attendance punch queueing for background sync when internet drops
 */

const DB_NAME = 'payfix_kiosk_db';
const DB_VERSION = 1;
const STORE_EMPLOYEES = 'cached_employees';
const STORE_PUNCH_QUEUE = 'offline_punch_queue';

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
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export const KioskIndexedDBService = {
    /**
     * Save employee face vectors to IndexedDB
     */
    async saveEmployees(employees: any[]): Promise<void> {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_EMPLOYEES, 'readwrite');
            const store = tx.objectStore(STORE_EMPLOYEES);

            // Clear old cache
            await new Promise((res) => {
                const clearReq = store.clear();
                clearReq.onsuccess = () => res(true);
            });

            // Store new employees
            for (const emp of employees) {
                store.put(emp);
            }

            return new Promise((resolve, reject) => {
                tx.oncomplete = () => resolve();
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
    }
};
