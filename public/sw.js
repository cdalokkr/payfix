/**
 * Service Worker for PayFix Attendance PWA
 * Handles caching, offline functionality, and push notifications
 */

const CACHE_NAME = 'payfix-attendance-v3'
const STATIC_CACHE = 'payfix-static-v3'
const DYNAMIC_CACHE = 'payfix-dynamic-v3'
const OFFLINE_QUEUE_NAME = 'payfix-offline-queue'

// Static assets to cache - public files & lightweight offline face biometric models
const STATIC_ASSETS = [
    '/offline',
    '/api/manifest',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    '/js/face-api.min.js',
    '/models/tiny_face_detector_model-weights_manifest.json',
    '/models/tiny_face_detector_model-shard1',
    '/models/face_landmark_68_model-weights_manifest.json',
    '/models/face_landmark_68_model-shard1',
]

// API routes that can work offline
const CACHEABLE_API_ROUTES = [
    '/api/trpc/profile.getProfile',
    '/api/trpc/officeLocations.getActive',
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...')

    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            console.log('[SW] Caching static assets')
            return cache.addAll(STATIC_ASSETS)
        })
    )

    // Activate immediately
    self.skipWaiting()
})

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...')

    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                    .map((key) => {
                        console.log('[SW] Removing old cache:', key)
                        return caches.delete(key)
                    })
            )
        })
    )

    // Take control immediately
    self.clients.claim()
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event
    const url = new URL(request.url)

    // Skip non-GET requests (except for offline queue)
    if (request.method !== 'GET') {
        // Handle offline POST requests for attendance
        if (request.method === 'POST' && url.pathname.includes('/api/trpc/attendance')) {
            event.respondWith(handleOfflineAttendance(request))
            return
        }
        return
    }

    // HTML/Document navigation requests - network first, fallback to offline page
    // Using request.mode === 'navigate' and Accept header check for compatibility
    const isNavigation = request.mode === 'navigate' || 
                         (request.headers.get('accept')?.includes('text/html'))
    
    if (isNavigation) {
        event.respondWith(networkFirstNavigation(request))
        return
    }

    // API requests - network first, then cache
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request))
        return
    }

    // Static assets (JS, CSS, images, etc.) - cache first
    event.respondWith(cacheFirst(request))
})

// Network-first navigation strategy
async function networkFirstNavigation(request) {
    try {
        // Always try to fetch from the network first
        const networkResponse = await fetch(request)
        return networkResponse
    } catch (error) {
        console.log('[SW] Navigation fetch failed, serving offline page:', error)
        // Try to serve the offline page from cache
        const offlineResponse = await caches.match('/offline')
        if (offlineResponse) {
            return offlineResponse
        }
        
        // If offline page is not found, return a fallback response instead of throwing
        return new Response(
            '<!DOCTYPE html><html><head><title>Offline | PayFix</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;padding:2rem;text-align:center;background:#f8fafc;color:#0f172a;"><div style="max-width:400px;margin:4rem auto;background:white;padding:2.5rem;border-radius:1.5rem;box-shadow:0 10px 15px -3px rgba(0,0,0,0.05);border:1px solid #e2e8f0;"><h2 style="margin-top:0;font-weight:900;color:#e11d48;">Connection Lost</h2><p style="color:#64748b;font-size:0.95rem;line-height:1.6;">Your device is currently offline. Please check your internet connection.</p><button onclick="window.location.reload()" style="margin-top:1rem;background:#0ea5e9;color:white;border:none;padding:0.75rem 1.5rem;font-weight:700;border-radius:0.75rem;cursor:pointer;box-shadow:0 4px 6px -1px rgba(14,165,233,0.2);">Retry Connection</button></div></body></html>',
            {
                status: 503,
                headers: { 'Content-Type': 'text/html' }
            }
        )
    }
}

// Cache-first strategy
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
        return cachedResponse
    }

    try {
        const networkResponse = await fetch(request)

        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE)
            cache.put(request, networkResponse.clone())
        }

        return networkResponse
    } catch (error) {
        console.error('[SW] Cache-first fetch failed:', error)
        throw error
    }
}

// Network-first strategy (for API calls)
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request)

        // Cache successful responses for cacheable routes
        if (networkResponse.ok && isCacheableApiRoute(request.url)) {
            const cache = await caches.open(DYNAMIC_CACHE)
            cache.put(request, networkResponse.clone())
        }

        return networkResponse
    } catch (error) {
        // Try cache
        const cachedResponse = await caches.match(request)
        if (cachedResponse) {
            return cachedResponse
        }

        // Return error response
        return new Response(
            JSON.stringify({ error: 'Network unavailable' }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
            }
        )
    }
}

// Check if API route is cacheable
function isCacheableApiRoute(url) {
    return CACHEABLE_API_ROUTES.some((route) => url.includes(route))
}

// Handle offline attendance marking
async function handleOfflineAttendance(request) {
    try {
        // Try network first
        const response = await fetch(request.clone())
        return response
    } catch (error) {
        // Queue for later sync
        const body = await request.json()
        await queueOfflineRequest({
            url: request.url,
            method: request.method,
            body,
            timestamp: Date.now(),
        })

        return new Response(
            JSON.stringify({
                success: true,
                queued: true,
                message: 'Attendance queued for sync when online',
            }),
            {
                status: 202,
                headers: { 'Content-Type': 'application/json' },
            }
        )
    }
}

// Queue offline request
async function queueOfflineRequest(requestData) {
    const cache = await caches.open(OFFLINE_QUEUE_NAME)
    const queueKey = `offline-${Date.now()}`

    await cache.put(
        queueKey,
        new Response(JSON.stringify(requestData))
    )

    console.log('[SW] Queued offline request:', queueKey)
}

// Background sync event
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync event:', event.tag)

    if (event.tag === 'sync-attendance') {
        event.waitUntil(syncOfflineAttendance())
    }
})

// Sync offline attendance requests
async function syncOfflineAttendance() {
    const cache = await caches.open(OFFLINE_QUEUE_NAME)
    const keys = await cache.keys()

    console.log('[SW] Syncing', keys.length, 'offline requests')

    const results = await Promise.allSettled(
        keys.map(async (key) => {
            const response = await cache.match(key)
            if (!response) return

            const requestData = await response.json()

            try {
                await fetch(requestData.url, {
                    method: requestData.method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestData.body),
                })

                // Remove from queue on success
                await cache.delete(key)
                console.log('[SW] Synced request:', key)
            } catch (error) {
                console.error('[SW] Failed to sync request:', key, error)
                throw error
            }
        })
    )

    // Notify clients
    const clients = await self.clients.matchAll()
    clients.forEach((client) => {
        client.postMessage({
            type: 'SYNC_COMPLETE',
            results,
        })
    })
}

// Push notification event
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received')

    let data = {
        title: 'PayFix',
        body: 'You have a new notification',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: 'payfix-notification',
    }

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() }
        } catch (e) {
            data.body = event.data.text()
        }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            tag: data.tag,
            data: data.data || {},
            actions: data.actions || [],
            vibrate: [200, 100, 200],
            requireInteraction: data.requireInteraction || false,
        })
    )
})

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event.notification.tag)

    event.notification.close()

    const urlToOpen = event.notification.data?.link || '/employee'

    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((clients) => {
            // Focus existing window if open
            const existingClient = clients.find((client) =>
                client.url.includes(urlToOpen) && 'focus' in client
            )

            if (existingClient) {
                return existingClient.focus()
            }

            // Open new window
            return self.clients.openWindow(urlToOpen)
        })
    )
})

// Message event - handle communication from main app
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data)

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting()
    }

    if (event.data.type === 'SYNC_NOW') {
        syncOfflineAttendance()
    }
})

console.log('[SW] Service worker loaded')
