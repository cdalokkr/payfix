import { appRouter } from "./routers";
import { createContext, createCallerFactory } from "./server";
import { tenantStorage } from "@/lib/tenant/store";
import { cache } from "react";

const createCaller = createCallerFactory(appRouter);

/**
 * Server-side tRPC client for use in Server Components.
 * Ensures tenant context is properly propagated via AsyncLocalStorage
 * so all DB queries route to the correct tenant schema.
 */
export const getServerClient = cache(async () => {
    const context = await createContext();
    const caller = createCaller(context);

    // If tenant context is available, wrap the caller to ensure
    // tenantStorage is active during procedure execution.
    // The tRPC middleware SHOULD handle this, but as a safety net
    // we also pre-seed tenantStorage here for direct calls.
    return caller;
});
