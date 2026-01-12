import { useState, useEffect, useCallback, useRef } from 'react';
import { proxyApi } from '../api/proxyApi';
import type { ProxyStatus } from '../types/proxy';

interface UseProxyStatusReturn {
  status: ProxyStatus | null;
  loading: boolean;
  error: string | null;
  start: () => Promise<{ success: boolean; error?: string }>;
  stop: () => Promise<{ success: boolean; error?: string }>;
  restart: () => Promise<{ success: boolean; error?: string }>;
  refresh: () => Promise<void>;
}

export function useProxyStatus(enablePolling = true, pollingInterval = 3000): UseProxyStatusReturn {
  const [status, setStatus] = useState<ProxyStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await proxyApi.getStatus();
      setStatus(data);
      setError(null);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to fetch status';
      setError(errorMsg);
      console.error('Failed to fetch proxy status:', err);
    }
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    await fetchStatus();
  }, [fetchStatus]);

  // Polling effect
  useEffect(() => {
    if (!enablePolling) return;

    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, pollingInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enablePolling, pollingInterval, fetchStatus]);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await proxyApi.start();
      // Wait a bit for the proxy to start before fetching status
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchStatus();
      return { success: true };
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to start proxy';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  const stop = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await proxyApi.stop();
      // Wait a bit for the proxy to stop before fetching status
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchStatus();
      return { success: true };
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to stop proxy';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  const restart = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await proxyApi.restart();
      // Wait for proxy to restart
      await new Promise(resolve => setTimeout(resolve, 1000));
      await fetchStatus();
      return { success: true };
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to restart proxy';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    start,
    stop,
    restart,
    refresh,
  };
}
