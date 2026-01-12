import { useState } from 'react';
import { Server, Power, PowerOff, RefreshCw, Copy, CheckCircle2 } from 'lucide-react';
import type { ProxyStatus, ProxyConfig } from '../../types/proxy';
import { CollapsibleCard } from './shared/CollapsibleCard';

interface ProxyControlPanelProps {
  status: ProxyStatus | null;
  config: ProxyConfig | null;
  onConfigChange: (config: Partial<ProxyConfig>) => void;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onRestart: () => Promise<void>;
  loading: boolean;
}

export function ProxyControlPanel({
  status,
  config,
  onConfigChange,
  onStart,
  onStop,
  onRestart,
  loading
}: ProxyControlPanelProps) {
  const [port, setPort] = useState(config?.port || 8045);
  const [bindAddress, setBindAddress] = useState(config?.bind_address || '127.0.0.1');
  const [autoStart, setAutoStart] = useState(config?.auto_start || false);
  const [copied, setCopied] = useState(false);
  const [portError, setPortError] = useState<string | null>(null);

  const handlePortChange = (value: string) => {
    const numValue = parseInt(value);

    if (isNaN(numValue)) {
      setPortError('Port must be a number');
      return;
    }

    if (numValue < 1024 || numValue > 65535) {
      setPortError('Port must be between 1024-65535');
      return;
    }

    setPortError(null);
    setPort(numValue);
    onConfigChange({ port: numValue });
  };

  const handleBindAddressChange = (value: string) => {
    setBindAddress(value);
    onConfigChange({ bind_address: value });
  };

  const handleAutoStartChange = (value: boolean) => {
    setAutoStart(value);
    onConfigChange({ auto_start: value });
  };

  const handleCopyUrl = () => {
    if (status?.base_url) {
      navigator.clipboard.writeText(status.base_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <CollapsibleCard
      title="Proxy Service"
      icon={<Server className="w-5 h-5" />}
      defaultExpanded={true}
    >
      <div className="space-y-6">
        {/* Status Display */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                status?.running ? 'bg-green-500/20' : 'bg-gray-600/20'
              }`}>
                <Server className={`w-8 h-8 ${status?.running ? 'text-green-500' : 'text-gray-500'}`} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {status?.running ? 'Running' : 'Stopped'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {status?.running ? 'Proxy service is active' : 'Proxy service is not running'}
                </p>
              </div>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                status?.running ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
              }`}></div>
              <span className={`text-sm font-medium ${
                status?.running ? 'text-green-400' : 'text-gray-500'
              }`}>
                {status?.running ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* Service Details */}
          {status?.running && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-700/50 rounded-lg p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Port</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{status.port}</p>
              </div>
              <div className="bg-white dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Base URL</p>
                  <button
                    onClick={handleCopyUrl}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    title="Copy URL"
                  >
                    {copied ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{status.base_url}</p>
              </div>
              <div className="bg-white dark:bg-gray-700/50 rounded-lg p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Active Accounts</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{status.active_accounts}</p>
              </div>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex gap-3">
            {!status?.running ? (
              <button
                onClick={onStart}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700
                         disabled:bg-gray-600 text-white font-semibold rounded-lg
                         transition-colors disabled:cursor-not-allowed"
              >
                <Power className="w-5 h-5" />
                Start Proxy
              </button>
            ) : (
              <>
                <button
                  onClick={onStop}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700
                           disabled:bg-gray-600 text-white font-semibold rounded-lg
                           transition-colors disabled:cursor-not-allowed"
                >
                  <PowerOff className="w-5 h-5" />
                  Stop Proxy
                </button>
                <button
                  onClick={onRestart}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700
                           disabled:bg-gray-600 text-white font-semibold rounded-lg
                           transition-colors disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  Restart Proxy
                </button>
              </>
            )}
          </div>
        </div>

        {/* Basic Configuration */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Basic Configuration</h4>

          {/* Port Configuration */}
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
              Port (1024-65535)
            </label>
            <input
              type="number"
              min="1024"
              max="65535"
              value={port}
              onChange={(e) => handlePortChange(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600
                       text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {portError && (
              <p className="text-xs text-red-500 mt-1">{portError}</p>
            )}
            {status?.running && port !== status.port && (
              <p className="text-xs text-yellow-500 mt-1">
                ⚠️ Configuration changed. Restart proxy to apply.
              </p>
            )}
          </div>

          {/* Bind Address Configuration */}
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
              Bind Address
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="bindAddress"
                  value="127.0.0.1"
                  checked={bindAddress === '127.0.0.1'}
                  onChange={(e) => handleBindAddressChange(e.target.value)}
                  className="radio radio-sm radio-primary"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  127.0.0.1 (localhost only)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="bindAddress"
                  value="0.0.0.0"
                  checked={bindAddress === '0.0.0.0'}
                  onChange={(e) => handleBindAddressChange(e.target.value)}
                  className="radio radio-sm radio-primary"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  0.0.0.0 (all interfaces)
                </span>
              </label>
            </div>
            {bindAddress === '0.0.0.0' && (
              <p className="text-xs text-yellow-500 mt-2">
                ⚠️ Warning: This will expose the proxy to your network
              </p>
            )}
          </div>

          {/* Auto Start Configuration */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Auto Start
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Automatically start proxy when application launches
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoStart}
              onChange={(e) => handleAutoStartChange(e.target.checked)}
              className="toggle toggle-primary"
            />
          </div>
        </div>
      </div>
    </CollapsibleCard>
  );
}
