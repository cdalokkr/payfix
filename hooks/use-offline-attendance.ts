"use client"

import { useState, useEffect } from 'react'
import { offlineAttendanceDb, type OfflinePunch } from '@/lib/db/offline-attendance-db'

export function useOfflineAttendance(profileId?: string) {
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      syncPendingPunches()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    refreshPendingCount()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
    // The listener is intentionally registered once per profile; the handler
    // uses the latest offline database state when the browser comes online.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId])

  const refreshPendingCount = async () => {
    try {
      const pending = await offlineAttendanceDb.getPendingPunches()
      setPendingCount(pending.length)
    } catch (err) {
      console.error('[OFFLINE-ATTENDANCE] Error reading pending count:', err)
    }
  }

  const recordPunch = async (latitude: number, longitude: number) => {
    if (!profileId) return null

    const punch: Omit<OfflinePunch, 'id' | 'status'> = {
      profile_id: profileId,
      latitude,
      longitude,
      timestamp: new Date().toISOString()
    }

    if (!navigator.onLine) {
      const id = await offlineAttendanceDb.saveOfflinePunch(punch)
      await refreshPendingCount()
      return { offline: true, id }
    }

    // Direct online sync
    try {
      const res = await fetch('/api/attendance/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(punch)
      })
      if (!res.ok) throw new Error('Online punch failed')
      return await res.json()
    } catch {
      // Fallback to offline storage on error
      const id = await offlineAttendanceDb.saveOfflinePunch(punch)
      await refreshPendingCount()
      return { offline: true, id }
    }
  }

  const syncPendingPunches = async () => {
    if (isSyncing) return
    try {
      setIsSyncing(true)
      const pending = await offlineAttendanceDb.getPendingPunches()
      for (const punch of pending) {
        if (!punch.id) continue
        try {
          const res = await fetch('/api/attendance/punch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profile_id: punch.profile_id,
              latitude: punch.latitude,
              longitude: punch.longitude,
              timestamp: punch.timestamp
            })
          })
          if (res.ok) {
            await offlineAttendanceDb.markPunchSynced(punch.id)
          }
        } catch (err) {
          console.error(`[OFFLINE-ATTENDANCE] Sync failed for punch ID ${punch.id}:`, err)
        }
      }
      await refreshPendingCount()
    } finally {
      setIsSyncing(false)
    }
  }

  return {
    isOnline,
    pendingCount,
    isSyncing,
    recordPunch,
    syncPendingPunches
  }
}
