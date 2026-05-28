import { offlineDb, type QueuedPunch } from '../db/offline-db';
import { toast } from 'sonner';

export class OfflineSyncService {
  /**
   * Helper to compress captured base64 selfie down to <8KB using browser canvas
   */
  static async compressSelfie(base64Str: string): Promise<string> {
    if (typeof window === 'undefined') return base64Str;
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Str);
          return;
        }

        // Draw image at very small 240x240 size to drop compression footprint to <5KB
        canvas.width = 240;
        canvas.height = 240;
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas.width, canvas.height);
        
        // Convert to webp with 0.4 quality, fallback to jpeg if unsupported
        let compressed = canvas.toDataURL('image/webp', 0.4);
        if (compressed.length > base64Str.length) {
          compressed = canvas.toDataURL('image/jpeg', 0.4);
        }
        resolve(compressed);
      };
      img.onerror = () => {
        resolve(base64Str);
      };
      img.src = base64Str;
    });
  }

  /**
   * Check if client-side is offline
   */
  static isOffline(): boolean {
    if (typeof window === 'undefined') return false;
    return !navigator.onLine;
  }

  /**
   * Enqueue punch to IndexedDB offline database
   */
  static async queuePunch({
    action,
    localDate,
    latitude,
    longitude,
    selfie
  }: {
    action: 'clock_in' | 'clock_out';
    localDate: string;
    latitude?: number | null;
    longitude?: number | null;
    selfie?: string | null;
  }): Promise<QueuedPunch> {
    if (!offlineDb) {
      throw new Error('Offline database is not available');
    }

    // Compress selfie before storage to save space in IndexedDB
    let finalSelfie = selfie || null;
    if (selfie && selfie.startsWith('data:image')) {
      try {
        finalSelfie = await this.compressSelfie(selfie);
        console.log(`[OFFLINE-SYNC] Compressed selfie from ${Math.round(selfie.length / 1024)}KB down to ${Math.round(finalSelfie.length / 1024)}KB`);
      } catch (err) {
        console.warn('[OFFLINE-SYNC] Selfie compression failed:', err);
      }
    }

    const punch: QueuedPunch = {
      action,
      localDate,
      timestamp: new Date().toISOString(),
      latitude: latitude || null,
      longitude: longitude || null,
      selfie: finalSelfie,
      status: 'pending',
      retryCount: 0
    };

    const id = await offlineDb.punches.add(punch);
    punch.id = id;
    
    console.log(`[OFFLINE-SYNC] Successfully queued ${action} punch locally in IndexedDB:`, id);
    return punch;
  }

  /**
   * Synchronize all queued punches to the server
   */
  static async syncQueuedPunches(): Promise<{ synced: number; failed: number }> {
    if (typeof window === 'undefined' || !offlineDb || this.isOffline()) {
      return { synced: 0, failed: 0 };
    }

    const queued = await offlineDb.punches.where('status').anyOf('pending', 'failed').toArray();
    if (queued.length === 0) {
      return { synced: 0, failed: 0 };
    }

    console.log(`[OFFLINE-SYNC] Syncing ${queued.length} queued punches to the server...`);
    let synced = 0;
    let failed = 0;

    for (const punch of queued) {
      try {
        // Mark as syncing in database
        await offlineDb.punches.update(punch.id!, { status: 'syncing' });

        let response;
        if (punch.action === 'clock_in') {
          response = await fetch('/api/trpc/attendance.clockIn?batch=1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              "0": {
                "json": {
                  localDate: punch.localDate,
                  isExtraDay: false,
                  latitude: punch.latitude || undefined,
                  longitude: punch.longitude || undefined
                }
              }
            })
          });
        } else {
          response = await fetch('/api/trpc/attendance.clockOut?batch=1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              "0": {
                "json": {
                  localDate: punch.localDate
                }
              }
            })
          });
        }

        const result = await response.json();
        const hasError = result[0]?.error || !response.ok;

        if (hasError) {
          const errMsg = result[0]?.error?.json?.message || 'Sync failed on server';
          throw new Error(errMsg);
        }

        // Successfully synced! Delete from offline DB
        await offlineDb.punches.delete(punch.id!);
        synced++;
        console.log(`[OFFLINE-SYNC] Successfully synced queued punch id ${punch.id}`);
        toast.success(`Synced offline ${punch.action === 'clock_in' ? 'Clock-In' : 'Clock-Out'} attendance successfully!`);
      } catch (err: any) {
        failed++;
        console.error(`[OFFLINE-SYNC] Failed to sync punch id ${punch.id}:`, err);
        await offlineDb.punches.update(punch.id!, {
          status: 'failed',
          errorMessage: err.message || 'Network sync failure',
          retryCount: (punch.retryCount || 0) + 1
        });
      }
    }

    return { synced, failed };
  }

  /**
   * Listen to online status and automatically trigger background sync
   */
  static registerBackgroundSync() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      console.log('[OFFLINE-SYNC] Device came online. Triggering automatic background sync...');
      toast.info('Connection restored. Syncing offline attendance...');
      this.syncQueuedPunches().catch((err) => {
        console.error('[OFFLINE-SYNC] Automatic sync failed:', err);
      });
    });
  }
}
