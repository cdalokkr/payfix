// @ts-nocheck
import { corsHeaders } from './cors.ts'

/**
 * Standard JSON response with CORS headers
 */
export function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}

/**
 * Error response with CORS headers
 */
export function errorResponse(message: string, status = 400): Response {
    return jsonResponse({ error: message, success: false }, status)
}

/**
 * Success response with data
 */
export function successResponse(data: unknown): Response {
    return jsonResponse({ data, success: true }, 200)
}
