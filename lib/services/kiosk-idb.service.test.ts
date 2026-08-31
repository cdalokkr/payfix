/** @jest-environment jsdom */

import { KioskIndexedDBService } from './kiosk-idb.service';

describe('KioskIndexedDBService legacy pairing migration', () => {
    beforeEach(() => {
        localStorage.clear();
        document.cookie = 'payfix_kiosk_pairing_code=legacy-code; path=/';
        document.cookie = 'payfix_kiosk_device_info=%7B%22name%22%3A%22Legacy%22%7D; path=/';
    });

    it('removes legacy localStorage and document.cookie pairing copies while retaining no secret in browser storage', async () => {
        localStorage.setItem('payfix_kiosk_pairing_code', 'legacy-code');
        localStorage.setItem('payfix_kiosk_device_info', '{"name":"Legacy"}');

        await KioskIndexedDBService.clearLegacyPairingStorage();

        expect(localStorage.getItem('payfix_kiosk_pairing_code')).toBeNull();
        expect(localStorage.getItem('payfix_kiosk_device_info')).toBeNull();
        expect(document.cookie).not.toContain('payfix_kiosk_pairing_code=');
        expect(document.cookie).not.toContain('payfix_kiosk_device_info=');
    });
});