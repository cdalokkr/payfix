/**
 * Compatibility entry point for the old setup command.
 *
 * This now delegates to the tenant-only, dry-run-by-default ownership audit.
 * It deliberately never reads or writes public.profiles: those rows are
 * control-plane identities and are not workspace users.
 */
import './env-config';
import { main as runTenantProfileBackfill } from './assign-tenant-ids-to-schemas';

runTenantProfileBackfill()
    .catch((error) => {
        console.error('[tenant-setup] Failed:', error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
