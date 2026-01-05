import { TRPCError } from '@trpc/server'

/**
 * Standardized Application Error Codes
 */
export const AppErrorCodes = {
    // Auth & Permissions
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    INVALID_TOKEN: 'INVALID_TOKEN',
    EXPIRED_SESSION: 'EXPIRED_SESSION',

    // Resource Management
    NOT_FOUND: 'NOT_FOUND',
    ALREADY_EXISTS: 'ALREADY_EXISTS',
    CONFLICT: 'CONFLICT',

    // Validation
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    INVALID_INPUT: 'INVALID_INPUT',

    // Attendance Specific
    OFF_DAY_RESTRICTION: 'OFF_DAY_RESTRICTION',
    HOLIDAY_RESTRICTION: 'HOLIDAY_RESTRICTION',
    ALREADY_CLOCKED_IN: 'ALREADY_CLOCKED_IN',
    NO_CLOCK_IN_FOUND: 'NO_CLOCK_IN_FOUND',
    ALREADY_CLOCKED_OUT: 'ALREADY_CLOCKED_OUT',

    // System
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

export type AppErrorCode = keyof typeof AppErrorCodes;

/**
 * Utility to throw a standardized TRPC error
 */
export function throwAppError(code: AppErrorCode, message: string, cause?: any): never {
    // Map app codes to TRPC codes
    const trpcMapping: Record<AppErrorCode, any> = {
        UNAUTHORIZED: 'UNAUTHORIZED',
        FORBIDDEN: 'FORBIDDEN',
        INVALID_TOKEN: 'UNAUTHORIZED',
        EXPIRED_SESSION: 'UNAUTHORIZED',
        NOT_FOUND: 'NOT_FOUND',
        ALREADY_EXISTS: 'CONFLICT',
        CONFLICT: 'CONFLICT',
        VALIDATION_FAILED: 'BAD_REQUEST',
        INVALID_INPUT: 'BAD_REQUEST',
        OFF_DAY_RESTRICTION: 'BAD_REQUEST',
        HOLIDAY_RESTRICTION: 'BAD_REQUEST',
        ALREADY_CLOCKED_IN: 'BAD_REQUEST',
        NO_CLOCK_IN_FOUND: 'NOT_FOUND',
        ALREADY_CLOCKED_OUT: 'BAD_REQUEST',
        INTERNAL_ERROR: 'INTERNAL_SERVER_ERROR',
        DATABASE_ERROR: 'INTERNAL_SERVER_ERROR',
    };

    throw new TRPCError({
        code: trpcMapping[code] || 'INTERNAL_SERVER_ERROR',
        message: `${code}: ${message}`,
        cause,
    });
}
