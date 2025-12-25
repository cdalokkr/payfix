import { appRouter } from "./routers";
import { createContext, createCallerFactory } from "./server";
import { cache } from "react";

const createCaller = createCallerFactory(appRouter);

export const getServerClient = cache(async () => {
    const context = await createContext();
    return createCaller(context);
});
