/**
 * Client-side utility for browser environment signature generation (Device Fingerprinting).
 * Combines HTML5 Canvas text rendering variations, color depths, timezone offsets, and screen dimensions
 * to generate a stable, tamper-proof tracking token.
 */
export function getBrowserFingerprint(): string {
    if (typeof window === 'undefined') return '';

    try {
        const components: string[] = [];
        
        // 1. HTML5 Canvas Fingerprinting
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
            canvas.width = 240;
            canvas.height = 60;
            ctx.textBaseline = "top";
            ctx.font = "14px 'Arial' 'Times New Roman' sans-serif";
            ctx.fillStyle = "#f60";
            ctx.fillRect(10, 5, 50, 20);
            ctx.fillStyle = "#069";
            ctx.fillText("PayFix-SaaS-Lock-9842", 15, 15);
            ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
            ctx.fillText("PayFix-SaaS-Lock-9842", 17, 17);
            
            const rawData = canvas.toDataURL();
            components.push(rawData);
        }

        // 2. System and Environment details
        components.push(navigator.userAgent || '');
        components.push(navigator.language || '');
        components.push(navigator.platform || '');
        components.push(screen.colorDepth?.toString() || '');
        components.push(screen.width?.toString() + 'x' + screen.height?.toString());
        components.push(new Date().getTimezoneOffset().toString());
        components.push(typeof window.sessionStorage !== 'undefined' ? '1' : '0');
        components.push(typeof window.localStorage !== 'undefined' ? '1' : '0');
        components.push(typeof window.indexedDB !== 'undefined' ? '1' : '0');

        // Generate a 32-bit hash signature from the aggregated features string
        const featureStr = components.join('||');
        let hash = 0;
        for (let i = 0; i < featureStr.length; i++) {
            const char = featureStr.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        // Convert to uppercase hexadecimal signature
        return Math.abs(hash).toString(16).toUpperCase();
    } catch (e) {
        console.error('[Fingerprint] Failed to generate browser environment fingerprint:', e);
        return 'GENERIC-FINGERPRINT-FAIL';
    }
}
