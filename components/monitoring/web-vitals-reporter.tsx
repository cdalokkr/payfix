'use client'

import { useEffect, useCallback } from 'react'
import { webVitalsMonitor, WebVitalRecord } from '@/lib/monitoring/web-vitals'

interface WebVitalsReporterProps {
    /**
     * Enable console logging of metrics (useful for development)
     */
    debug?: boolean
    /**
     * Custom endpoint to send metrics to
     */
    reportingEndpoint?: string
    /**
     * Callback for real-time metric updates
     */
    onMetric?: (metric: WebVitalRecord) => void
}

/**
 * Web Vitals Reporter Component
 * 
 * This component initializes Web Vitals monitoring and reports metrics.
 * Place this component in your root layout to track performance across the app.
 * 
 * @example
 * ```tsx
 * // In app/layout.tsx
 * import { WebVitalsReporter } from '@/components/monitoring/web-vitals-reporter'
 * 
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         {children}
 *         <WebVitalsReporter debug={process.env.NODE_ENV === 'development'} />
 *       </body>
 *     </html>
 *   )
 * }
 * ```
 */
export function WebVitalsReporter({
    debug = false,
    reportingEndpoint,
    onMetric
}: WebVitalsReporterProps) {
    const handleMetric = useCallback((metric: WebVitalRecord) => {
        // Log to console in debug mode
        if (debug) {
            const color = metric.rating === 'good'
                ? '\x1b[32m' // green
                : metric.rating === 'needs-improvement'
                    ? '\x1b[33m' // yellow
                    : '\x1b[31m' // red

            console.log(
                `${color}[Web Vitals] ${metric.metric}: ${metric.value.toFixed(2)}${metric.metric === 'CLS' ? '' : 'ms'} (${metric.rating})\x1b[0m`
            )
        }

        // Send to custom endpoint if provided
        if (reportingEndpoint) {
            // Use sendBeacon for reliability during page unload
            if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
                navigator.sendBeacon(
                    reportingEndpoint,
                    JSON.stringify(metric)
                )
            } else {
                // Fallback to fetch
                fetch(reportingEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(metric),
                    keepalive: true
                }).catch(() => {
                    // Silently fail - metrics are not critical
                })
            }
        }

        // Call custom callback if provided
        onMetric?.(metric)
    }, [debug, reportingEndpoint, onMetric])

    useEffect(() => {
        // Only run on client
        if (typeof window === 'undefined') return

        // Initialize Web Vitals monitoring
        webVitalsMonitor.initialize(handleMetric)

        // Cleanup on unmount
        return () => {
            webVitalsMonitor.cleanup()
        }
    }, [handleMetric])

    // This component doesn't render anything
    return null
}

/**
 * Hook to access Web Vitals metrics
 * 
 * @example
 * ```tsx
 * function PerformanceDashboard() {
 *   const { metrics, summary } = useWebVitals()
 *   
 *   return (
 *     <div>
 *       <p>Performance Score: {summary.performanceScore}</p>
 *       {summary.issues.map(issue => (
 *         <p key={issue}>{issue}</p>
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useWebVitals() {
    return {
        metrics: webVitalsMonitor.getMetrics(),
        customMetrics: webVitalsMonitor.getCustomMetrics(),
        summary: webVitalsMonitor.getSummary(),
        recordCustomMetric: webVitalsMonitor.recordCustomMetric.bind(webVitalsMonitor)
    }
}

export default WebVitalsReporter