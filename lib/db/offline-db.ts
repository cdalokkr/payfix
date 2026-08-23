import Dexie, { type Table } from 'dexie';

export interface QueuedPunch {
  id?: number;
  action: 'clock_in' | 'clock_out';
  localDate: string;
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  status: 'pending' | 'syncing' | 'failed';
  errorMessage?: string;
  retryCount: number;
}

class OfflineDatabase extends Dexie {
  punches!: Table<QueuedPunch>;

  constructor() {
    super('PayFixOfflineDB');
    this.version(1).stores({
      punches: '++id, action, localDate, timestamp, status'
    });
  }
}

export const offlineDb = typeof window !== 'undefined' ? new OfflineDatabase() : null;
