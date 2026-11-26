export const DEFAULT_MAIN_DOMAIN = (
    process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'niyamo.auravics.com'
).toLowerCase();

/**
 * Resolves the workspace base domain shown in onboarding and Super Admin UIs.
 * Preserves multi-label main domains such as `niyamo.auravics.com` instead of
 * collapsing them to the apex domain (`auravics.com`).
 */
export function resolveClientBaseDomain(hostname: string, port?: string): string {
    const host = hostname.split(':')[0].toLowerCase().trim();
    if (!host) return DEFAULT_MAIN_DOMAIN;

    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')) {
        return `localhost${port ? `:${port}` : ''}`;
    }

    if (
        host === DEFAULT_MAIN_DOMAIN ||
        host === `www.${DEFAULT_MAIN_DOMAIN}` ||
        host.endsWith(`.${DEFAULT_MAIN_DOMAIN}`)
    ) {
        return DEFAULT_MAIN_DOMAIN;
    }

    if (host.endsWith('.vercel.app')) {
        return host;
    }

    return DEFAULT_MAIN_DOMAIN;
}
