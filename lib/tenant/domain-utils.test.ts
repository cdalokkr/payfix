import { DEFAULT_MAIN_DOMAIN, resolveClientBaseDomain } from './domain-utils';

describe('resolveClientBaseDomain', () => {
    it('preserves multi-label main domain niyamo.auravics.com', () => {
        expect(resolveClientBaseDomain('niyamo.auravics.com')).toBe(DEFAULT_MAIN_DOMAIN);
        expect(resolveClientBaseDomain('www.niyamo.auravics.com')).toBe(DEFAULT_MAIN_DOMAIN);
        expect(resolveClientBaseDomain('acme.niyamo.auravics.com')).toBe(DEFAULT_MAIN_DOMAIN);
    });

    it('preserves localhost with optional port for local development', () => {
        expect(resolveClientBaseDomain('localhost', '3000')).toBe('localhost:3000');
        expect(resolveClientBaseDomain('127.0.0.1', '3000')).toBe('localhost:3000');
        expect(resolveClientBaseDomain('acme.localhost', '3000')).toBe('localhost:3000');
    });

    it('preserves vercel.app preview hostnames', () => {
        expect(resolveClientBaseDomain('payfix-git-develop-corebitdigital.vercel.app')).toBe(
            'payfix-git-develop-corebitdigital.vercel.app',
        );
    });
});
