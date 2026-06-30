'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Configuration options for the status polling hook
 */
interface UseStatusPollingOptions {
  /** Whether polling is active */
  enabled: boolean;
  /** Polling interval in milliseconds. Defaults to 30000 (30s) */
  intervalMs?: number;
  /** Callback function executed every interval */
  onCheck: () => Promise<void>;
}

/**
 * Return values for the status polling hook
 */
interface UseStatusPollingReturn {
  /** Seconds remaining until the next check */
  countdown: number;
  /** Whether a check is currently in progress */
  isChecking: boolean;
  /** Manually trigger a check and reset the countdown */
  triggerCheck: () => Promise<void>;
}

/**
 * Hook for automatic status polling with visual countdown.
 * Specifically designed for the WhatsApp QR Code modal to periodically 
 * verify connection state without overwhelming the server.
 * 
 * @example
 * const { countdown, isChecking } = useStatusPolling({
 *   enabled: showModal && !connected,
 *   onCheck: async () => { ... }
 * });
 */
export function useStatusPolling({
  enabled,
  intervalMs = 30000, // 30 seconds default
  onCheck,
}: UseStatusPollingOptions): UseStatusPollingReturn {
  const [countdown, setCountdown] = useState(intervalMs / 1000);
  const [isChecking, setIsChecking] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Manual trigger for status check
  const triggerCheck = useCallback(async () => {
    if (isChecking) return;

    setIsChecking(true);
    try {
      await onCheck();
    } finally {
      setIsChecking(false);
      // Reset countdown after check
      setCountdown(intervalMs / 1000);
    }
  }, [isChecking, onCheck, intervalMs]);

  // Main polling effect
  useEffect(() => {
    if (!enabled) {
      // Clear intervals when disabled
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(intervalMs / 1000);
      return;
    }

    console.log('[useStatusPolling] Starting polling, interval:', intervalMs, 'ms');

    // Initial countdown
    setCountdown(intervalMs / 1000);

    // Countdown timer (updates every second)
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return intervalMs / 1000; // Reset when reaches 0
        }
        return prev - 1;
      });
    }, 1000);

    // Status check interval
    intervalRef.current = setInterval(() => {
      console.log('[useStatusPolling] Triggering status check');
      triggerCheck();
    }, intervalMs);

    // Cleanup on unmount or when disabled
    return () => {
      console.log('[useStatusPolling] Cleaning up polling');
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [enabled, intervalMs, triggerCheck]);

  return {
    countdown,
    isChecking,
    triggerCheck,
  };
}
