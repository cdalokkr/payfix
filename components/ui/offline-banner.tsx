'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OfflineBannerProps {
  queueCount?: number;
  message?: string;
}

export function OfflineBanner({ queueCount = 0, message }: OfflineBannerProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setJustReconnected(true);
      const timer = setTimeout(() => setJustReconnected(false), 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setJustReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="w-full bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-bold flex items-center justify-center gap-2 shadow-md z-50 sticky top-0"
        >
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>
            {message || 'Offline Mode: Connection lost. Punches & actions are queued locally.'}
          </span>
          {queueCount > 0 && (
            <span className="bg-slate-950 text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-black">
              {queueCount} Queued
            </span>
          )}
        </motion.div>
      )}

      {isOnline && justReconnected && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="w-full bg-emerald-600 text-white px-4 py-1.5 text-xs font-bold flex items-center justify-center gap-2 shadow-md z-50 sticky top-0"
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Connection Restored: Cloud data synchronized successfully.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default OfflineBanner;
