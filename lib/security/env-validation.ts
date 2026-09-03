// ============================================
// lib/security/env-validation.ts
// Environment variable validation for security
// ============================================

interface EnvVariable {
    name: string
    required: boolean
    isSecret: boolean
    description: string
}

// Define all environment variables used by the application
const ENV_VARIABLES: EnvVariable[] = [
    {
        name: 'NEXT_PUBLIC_SUPABASE_URL',
        required: false,
        isSecret: false,
        description: 'Supabase project URL',
    },
    {
        name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        required: false,
        isSecret: false,
        description: 'Supabase anonymous key (public)',
    },
    {
        name: 'SUPABASE_SERVICE_ROLE_KEY',
        required: false,
        isSecret: true,
        description: 'Supabase service role key (server-only)',
    },
    {
        name: 'NODE_ENV',
        required: false,
        isSecret: false,
        description: 'Node environment',
    },
    {
        name: 'NEXT_PUBLIC_APP_URL',
        required: false,
        isSecret: false,
        description: 'Application URL',
    },
]

interface ValidationResult {
    isValid: boolean
    errors: string[]
    warnings: string[]
    securityIssues: string[]
}

function isProductionApplicationUrl(value: string): boolean {
    try {
        const url = new URL(value)
        const hostname = url.hostname.toLowerCase()
        const localHostnames = new Set(['localhost', '127.0.0.1', '::1'])

        return (
            url.protocol === 'https:' &&
            !url.username &&
            !url.password &&
            !localHostnames.has(hostname) &&
            !hostname.endsWith('.local') &&
            !hostname.endsWith('.replit.dev')
        )
    } catch {
        return false
    }
}

function isHttpsUrl(value: string): boolean {
    try {
        return new URL(value).protocol === 'https:'
    } catch {
        return false
    }
}

/**
 * Validate all environment variables
 */
export function validateEnvironment(): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const securityIssues: string[] = []

    for (const envVar of ENV_VARIABLES) {
        const value = process.env[envVar.name]

        // Check if required variable is missing
        if (envVar.required && !value) {
            errors.push(`Missing required environment variable: ${envVar.name} - ${envVar.description}`)
        }

        // Check for security issues
        if (envVar.isSecret && value) {
            // Check if secret is exposed with NEXT_PUBLIC_ prefix
            if (envVar.name.startsWith('NEXT_PUBLIC_')) {
                securityIssues.push(
                    `SECURITY RISK: Secret "${envVar.name}" has NEXT_PUBLIC_ prefix and will be exposed to client!`
                )
            }

            // Check if secret looks like a placeholder
            if (value.includes('your-') || value.includes('xxx') || value === 'placeholder') {
                warnings.push(`Environment variable ${envVar.name} appears to be a placeholder value`)
            }
        }
    }

    // Check for accidentally exposed secrets
    const dangerousPatterns = [
        { pattern: /NEXT_PUBLIC_.*SECRET/i, message: 'Secret exposed with NEXT_PUBLIC_ prefix' },
        { pattern: /NEXT_PUBLIC_(?!.*ANON.*KEY).*KEY/i, message: 'Non-anon key exposed with NEXT_PUBLIC_ prefix' },
        { pattern: /NEXT_PUBLIC_.*PASSWORD/i, message: 'Password exposed with NEXT_PUBLIC_ prefix' },
        { pattern: /NEXT_PUBLIC_.*TOKEN/i, message: 'Token exposed with NEXT_PUBLIC_ prefix' },
    ]

    for (const key of Object.keys(process.env)) {
        for (const { pattern, message } of dangerousPatterns) {
            if (pattern.test(key)) {
                securityIssues.push(`SECURITY RISK: ${message} - ${key}`)
            }
        }
    }

    // Supabase configuration is required in production. The application URL
    // remains optional because Vercel supplies branch/deployment URLs
    // automatically; applications should use relative URLs unless a custom
    // public domain is explicitly configured.
    if (process.env.NODE_ENV === 'production') {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            errors.push('NEXT_PUBLIC_SUPABASE_URL is required in production')
        }
        if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
            errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required in production')
        }
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            errors.push('SUPABASE_SERVICE_ROLE_KEY is required in production')
        }
        if (
            process.env.NEXT_PUBLIC_SUPABASE_URL &&
            !isHttpsUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
        ) {
            errors.push('NEXT_PUBLIC_SUPABASE_URL must use HTTPS in production')
        }
        if (
            process.env.NEXT_PUBLIC_APP_URL &&
            !isProductionApplicationUrl(process.env.NEXT_PUBLIC_APP_URL)
        ) {
            errors.push('NEXT_PUBLIC_APP_URL must be an HTTPS production URL')
        }
    }

    return {
        isValid: errors.length === 0 && securityIssues.length === 0,
        errors,
        warnings,
        securityIssues,
    }
}

/**
 * Validate environment on startup and log results
 */
export function validateEnvironmentOnStartup(): void {
    const result = validateEnvironment()

    if (result.securityIssues.length > 0) {
        console.error('\n🚨 SECURITY ISSUES DETECTED:')
        result.securityIssues.forEach(issue => console.error(`  ❌ ${issue}`))
    }

    if (result.errors.length > 0) {
        console.error('\n❌ Environment validation errors:')
        result.errors.forEach(error => console.error(`  - ${error}`))
    }

    if (result.warnings.length > 0) {
        console.warn('\n⚠️ Environment warnings:')
        result.warnings.forEach(warning => console.warn(`  - ${warning}`))
    }

    if (!result.isValid) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Environment validation failed. Cannot start in production with invalid configuration.')
        } else {
            console.warn('\n⚠️ Running with invalid environment configuration (allowed in development)')
        }
    } else if (result.warnings.length === 0) {
        console.log('✅ Environment validation passed')
    }
}

/**
 * Get a required environment variable or throw
 */
export function getRequiredEnv(name: string): string {
    const value = process.env[name]
    if (!value) {
        throw new Error(`Required environment variable ${name} is not set`)
    }
    return value
}

/**
 * Get an optional environment variable with a default
 */
export function getOptionalEnv(name: string, defaultValue: string): string {
    return process.env[name] || defaultValue
}

/**
 * Check if we're in production
 */
export function isProduction(): boolean {
    return process.env.NODE_ENV === 'production'
}

/**
 * Check if we're in development
 */
export function isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development'
}

/**
 * Mask a secret for logging (show first and last 4 chars)
 */
export function maskSecret(secret: string): string {
    if (!secret || secret.length < 12) return '***'
    return `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`
}