import React, { useEffect } from 'react';
import { useProxyStore } from '../store';
import { Server, Power, PowerOff, RefreshCw, AlertCircle } from 'lucide-react';

export const ProxyPage: React.FC = () => {
  const { status, loading, error, fetchStatus, startProxy, stopProxy } = useProxyStore();

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleStart = async () => {
    // Use default config for MVP
    const defaultConfig = {
      port: 8045,
      bind_address: "127.0.0.1",
      auto_start: false,
      enable_logging: true,
      request_timeout: 300,
      custom_mapping: {},
      upstream_proxy: {
        enabled: false,
        url: ""
      },
      zai: {
        enabled: false,
        base_url: "",
        api_key: "",
        dispatch_mode: "Off"
      },
      scheduling: {
        mode: "QuotaPriority",
        sticky_session: false,
        sticky_ttl_seconds: 3600
      },
      experimental: {
        thinking_tokens: false
      }
    };

    try {
      await startProxy(defaultConfig);
    } catch (err) {
      console.error('Failed to start proxy:', err);
    }
  };

  const handleStop = async () => {
    try {
      await stopProxy();
    } catch (err) {
      console.error('Failed to stop proxy:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Proxy Control</h1>
          <p className="text-gray-400 mt-1">Manage proxy service</p>
        </div>
        <button
          onClick={fetchStatus}
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

      {/* Status Card */}
      <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
              status?.running ? 'bg-green-500/20' : 'bg-gray-600/20'
            }`}>
              <Server className={`w-8 h-8 ${status?.running ? 'text-green-500' : 'text-gray-500'}`} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {status?.running ? 'Running' : 'Stopped'}
              </h2>
              <p className="text-gray-400 mt-1">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Port</p>
              <p className="text-xl font-semibold text-white">{status.port}</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Base URL</p>
              <p className="text-xl font-semibold text-white truncate">{status.base_url}</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Active Accounts</p>
              <p className="text-xl font-semibold text-white">{status.active_accounts}</p>
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex gap-4">
          {!status?.running ? (
            <button
              onClick={handleStart}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700
                       disabled:bg-gray-600 text-white font-semibold rounded-lg
                       transition-colors disabled:cursor-not-allowed"
            >
              <Power className="w-5 h-5" />
              Start Proxy
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700
                       disabled:bg-gray-600 text-white font-semibold rounded-lg
                       transition-colors disabled:cursor-not-allowed"
            >
              <PowerOff className="w-5 h-5" />
              Stop Proxy
            </button>
          )}
        </div>
      </div>

      {/* Information */}
      <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
        <h3 className="text-blue-400 font-semibold mb-2">Note</h3>
        <p className="text-gray-300 text-sm">
          The proxy service provides an API endpoint for Claude desktop application.
          Make sure you have at least one active account before starting the service.
        </p>
      </div>
    </div>
  );
};
