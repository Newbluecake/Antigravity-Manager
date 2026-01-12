import { useState, useCallback } from 'react';
import { proxyApi } from '../api/proxyApi';
import type { ProxyConfig } from '../types/proxy';

interface UseProxyConfigReturn {
  config: ProxyConfig | null;
  loading: boolean;
  error: string | null;
  loadConfig: () => Promise<void>;
  saveConfig: (newConfig: ProxyConfig) => Promise<{ success: boolean; error?: string }>;
  updatePartial: (partial: Partial<ProxyConfig>) => Promise<{ success: boolean; error?: string }>;
}

export function useProxyConfig(): UseProxyConfigReturn {
  const [config, setConfig] = useState<ProxyConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await proxyApi.getConfig();
      setConfig(data);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load configuration';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveConfig = useCallback(async (newConfig: ProxyConfig) => {
    setLoading(true);
    setError(null);
    try {
      await proxyApi.updateConfig(newConfig);
      setConfig(newConfig);
      return { success: true };
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to save configuration';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePartial = useCallback(async (partial: Partial<ProxyConfig>) => {
    if (!config) {
      return { success: false, error: 'No configuration loaded' };
    }

    setLoading(true);
    setError(null);
    try {
      await proxyApi.patchConfig(partial);
      const newConfig = { ...config, ...partial };
      setConfig(newConfig);
      return { success: true };
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to update configuration';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [config]);

  return {
    config,
    loading,
    error,
    loadConfig,
    saveConfig,
    updatePartial,
  };
}
