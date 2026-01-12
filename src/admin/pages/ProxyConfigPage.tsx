import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, Settings2 } from 'lucide-react';
import { useProxyConfig } from '../hooks/useProxyConfig';
import { useProxyStatus } from '../hooks/useProxyStatus';
import { ProxyControlPanel } from '../components/ProxyConfig/ProxyControlPanel';
import { ModelMappingConfig } from '../components/ProxyConfig/ModelMappingConfig';

export function ProxyConfigPage() {
  const { config, loading: configLoading, error: configError, loadConfig, updatePartial } = useProxyConfig();
  const { status, loading: statusLoading, error: statusError, start, stop, restart, refresh } = useProxyStatus(true);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load configuration on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleConfigChange = async (partial: Partial<NonNullable<typeof config>>) => {
    setHasUnsavedChanges(true);
    setSaveError(null);

    const result = await updatePartial(partial);
    if (result.success) {
      setHasUnsavedChanges(false);
    } else {
      setSaveError(result.error || 'Failed to save configuration');
    }
  };

  const handleStart = async () => {
    const result = await start();
    if (!result.success && result.error) {
      console.error('Failed to start proxy:', result.error);
    }
  };

  const handleStop = async () => {
    const result = await stop();
    if (!result.success && result.error) {
      console.error('Failed to stop proxy:', result.error);
    }
  };

  const handleRestart = async () => {
    const result = await restart();
    if (!result.success && result.error) {
      console.error('Failed to restart proxy:', result.error);
    }
  };

  const error = configError || statusError || saveError;
  const loading = configLoading || statusLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Proxy Configuration</h1>
          <p className="text-gray-400 mt-1">Manage proxy service settings and model mappings</p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600
                   text-white rounded-lg transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Unsaved Changes Warning */}
      {hasUnsavedChanges && (
        <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-400 text-sm font-semibold">Configuration changed</p>
            <p className="text-yellow-400 text-xs mt-1">
              {status?.running
                ? 'Restart the proxy service to apply changes.'
                : 'Start the proxy service to apply changes.'}
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {configLoading && !config && (
        <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading configuration...</p>
        </div>
      )}

      {/* Configuration Sections */}
      {config && (
        <div className="space-y-4">
          {/* Proxy Control Panel */}
          <ProxyControlPanel
            status={status}
            config={config}
            onConfigChange={handleConfigChange}
            onStart={handleStart}
            onStop={handleStop}
            onRestart={handleRestart}
            loading={loading}
          />

          {/* Model Mapping Configuration */}
          <ModelMappingConfig
            config={config}
            onConfigChange={handleConfigChange}
          />

          {/* Information */}
          <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Settings2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-blue-400 font-semibold mb-2">About Proxy Configuration</h3>
                <p className="text-gray-300 text-sm mb-2">
                  The proxy service provides an API-compatible endpoint for Claude desktop application.
                  Configure port, bind address, and model mappings to customize the behavior.
                </p>
                <ul className="text-gray-300 text-xs space-y-1 list-disc list-inside">
                  <li>Port: Choose a port between 1024-65535 (default: 8045)</li>
                  <li>Bind Address: 127.0.0.1 (local only) or 0.0.0.0 (network accessible)</li>
                  <li>Model Mapping: Map request model names to actual provider models</li>
                  <li>Fallback Chain: Configure backup models if primary fails</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
