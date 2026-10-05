'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Configuration options for the status polling hook
 */
interface UseStatusPollingOptions {
  /** Whether polling is active */
  enabled: boolean;
  /** Polling interval in milliseconds. Defaults to 4000 (4s) */
  intervalMs?: number;
  /** Callback function executed every interval */
  onCheck: () => Promise<void>;
}

/**
 * Return values for the status polling hook
 */
interface UseStatusPollingReturn {
  /** Whether a check is currently in progress */
  isChecking: boolean;
  /** Manually trigger a check */
  triggerCheck: () => Promise<void>;
}

/**
 * Hook for automatic status polling. Runs one check immediately when enabled,
 * then every `intervalMs`. Specifically designed for the WhatsApp QR Code
 * modal to detect the connection shortly after the QR is scanned.
 *
 * `onCheck` is read through a ref and overlapping checks are skipped, so the
 * interval is only recreated when `enabled`/`intervalMs` change.
 *
 * @example
 * const { isChecking } = useStatusPolling({
 *   enabled: showModal && !connected,
 *   onCheck: async () => { ... }
 * });
 */
export function useStatusPolling({
  enabled,
  intervalMs = 4000,
  onCheck,
}: UseStatusPollingOptions): UseStatusPollingReturn {
  const [isChecking, setIsChecking] = useState(false);
  const inFlightRef = useRef(false);
  const onCheckRef = useRef(onCheck);

  useEffect(() => {
    onCheckRef.current = onCheck;
  }, [onCheck]);

  const triggerCheck = useCallback(async () => {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setIsChecking(true);
    try {
      await onCheckRef.current();
    } finally {
      inFlightRef.current = false;
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    triggerCheck();
    const interval = setInterval(triggerCheck, intervalMs);

    return () => clearInterval(interval);
  }, [enabled, intervalMs, triggerCheck]);

  return { isChecking, triggerCheck };
}
