import { dehydrate, QueryClient } from '@tanstack/react-query';
import { getServerClient } from './server-client';
import { cache } from 'react';

/**
 * Creates a server-side QueryClient and prefetches queries.
 * Returns the dehydrated state to be passed to <HydrationBoundary />.
 */
export async function getDehydratedState(
    prefetchFn: (client: Awaited<ReturnType<typeof getServerClient>>, queryClient: QueryClient) => Promise<void>
) {
    const queryClient = new QueryClient();
    const client = await getServerClient();

    await prefetchFn(client, queryClient);

    return dehydrate(queryClient);
}

/**
 * Cached version of getDehydratedState to avoid redundant prefetches within the same request.
 */
export const getCachedDehydratedState = cache(getDehydratedState);
