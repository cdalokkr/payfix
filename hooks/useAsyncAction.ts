"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

interface UseAsyncActionOptions {
  successMessage?: string;
  errorMessage?: string;
  showToast?: boolean;
  autoReset?: boolean;
  resetDelay?: number;
}

interface UseAsyncActionReturn {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  reset: () => void;
}

export function useAsyncAction({
  successMessage = "Success",
  errorMessage = "Error",
  showToast = true,
  autoReset = true,
  resetDelay = 2000,
}: UseAsyncActionOptions = {}): UseAsyncActionReturn {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const reset = useCallback(() => setStatus("idle"), []);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        setStatus("loading");
        const result = await fn();
        setStatus("success");

        if (showToast) toast.success(successMessage);
        if (autoReset) setTimeout(reset, resetDelay);

        return result;
      } catch (err) {
        console.error("Async action failed:", err);
        setStatus("error");

        if (showToast) toast.error(errorMessage);
        if (autoReset) setTimeout(reset, resetDelay);

        return undefined;
      }
    },
    [showToast, successMessage, errorMessage, autoReset, resetDelay, reset]
  );

  return {
    isLoading: status === "loading",
    isSuccess: status === "success",
    isError: status === "error",
    run,
    reset,
  };
}