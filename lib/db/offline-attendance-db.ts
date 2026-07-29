// ============================================
// lib/db/offline-attendance-db.ts - IndexedDB Dexie Storage
// ============================================
import Dexie, { type Table } from 'dexie'

export interface OfflinePunch {
  id?: number
  profile_id: string
  latitude: number
  longitude: number
  timestamp: string
  status: 'pending' | 'synced' | 'failed'
  error?: string
}

export class OfflineAttendanceDatabase extends Dexie {
  punches!: Table<OfflinePunch>

  constructor() {
    super('PayfixOfflineAttendance')
    this.version(1).stores({
      punches: '++id, profile_id, timestamp, status'
    })
  }

  async saveOfflinePunch(punch: Omit<OfflinePunch, 'id' | 'status'>) {
    return await this.punches.add({
      ...punch,
      status: 'pending'
    })
  }

  async getPendingPunches() {
    return await this.punches.where('status').equals('pending').toArray()
  }

  async markPunchSynced(id: number) {
    return await this.punches.update(id, { status: 'synced' })
  }
}

export const offlineAttendanceDb = new OfflineAttendanceDatabase()
