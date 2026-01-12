import { Settings, Clock, FileText, Power, Globe, Zap } from 'lucide-react';
import type { ProxyConfig } from '../../types/proxy';
import { CollapsibleCard } from './shared/CollapsibleCard';

interface AdvancedSettingsProps {
  config: ProxyConfig | null;
  onConfigChange: (config: Partial<ProxyConfig>) => void;
}

export function AdvancedSettings({ config, onConfigChange }: AdvancedSettingsProps) {
  const handleTimeoutChange = (timeout: number) => {
    // Validate timeout range: 10-600 seconds
    const validTimeout = Math.max(10, Math.min(600, timeout));
    onConfigChange({ timeout: validTimeout * 1000 }); // Convert to milliseconds
  };

  const handleUpstreamProxyChange = (upstreamProxy: string) => {
    // Basic URL validation
    const trimmed = upstreamProxy.trim();
    onConfigChange({ upstream_proxy: trimmed || undefined });
  };

  const isValidProxyUrl = (url: string): boolean => {
    if (!url) return true; // Empty is valid (no proxy)
    try {
      const parsed = new URL(url);
      return ['http:', 'https:', 'socks5:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  const timeout = config?.timeout ? config.timeout / 1000 : 300; // Convert from ms to seconds
  const upstreamProxy = config?.upstream_proxy || '';
  const isProxyUrlValid = isValidProxyUrl(upstreamProxy);

  return (
    <CollapsibleCard
      title="Advanced Settings"
      icon={<Settings className="w-5 h-5" />}
      defaultExpanded={false}
    >
      <div className="space-y-4">
        {/* Request Timeout */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Clock className="w-3 h-3 inline mr-1" />
            Request Timeout
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="10"
              max="600"
              step="10"
              value={timeout}
              onChange={(e) => handleTimeoutChange(parseInt(e.target.value))}
              className="flex-1 range range-primary range-sm"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={timeout}
                onChange={(e) => handleTimeoutChange(parseInt(e.target.value))}
                min="10"
                max="600"
                className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400 w-8">sec</span>
            </div>
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-gray-400">
            <span>10s</span>
            <span>600s (10min)</span>
          </div>
          <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
            Maximum time to wait for API responses
          </p>
        </div>

        {/* Logging */}
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <div>
              <div className="text-xs font-medium text-gray-900 dark:text-white">
                Enable Logging
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                Log all proxy requests and responses
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-sm bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600
                     checked:bg-blue-500 checked:border-blue-500"
            checked={config?.enable_logging ?? true}
            onChange={(e) => onConfigChange({ enable_logging: e.target.checked })}
          />
        </div>

        {/* Auto Start */}
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-2">
            <Power className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <div>
              <div className="text-xs font-medium text-gray-900 dark:text-white">
                Auto Start
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                Start proxy automatically when application launches
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-sm bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600
                     checked:bg-blue-500 checked:border-blue-500"
            checked={config?.auto_start ?? false}
            onChange={(e) => onConfigChange({ auto_start: e.target.checked })}
          />
        </div>

        {/* Upstream Proxy */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            <Globe className="w-3 h-3 inline mr-1" />
            Upstream Proxy (Optional)
          </label>
          <input
            type="text"
            value={upstreamProxy}
            onChange={(e) => handleUpstreamProxyChange(e.target.value)}
            placeholder="http://proxy.example.com:8080"
            className={`w-full px-3 py-2 text-sm border rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     ${
                       isProxyUrlValid
                         ? 'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500'
                         : 'border-red-500 focus:ring-2 focus:ring-red-500'
                     }`}
          />
          {!isProxyUrlValid && upstreamProxy && (
            <p className="mt-1 text-[10px] text-red-500">
              Invalid proxy URL. Use format: http://host:port or socks5://host:port
            </p>
          )}
          <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
            Route all proxy requests through this upstream proxy
          </p>
        </div>

        {/* Experimental Features */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-yellow-500" />
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Experimental Features
            </h4>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div>
                <div className="text-xs font-medium text-gray-900 dark:text-white">
                  Extended Thinking Tokens
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                  Enable extended thinking mode for supported models
                </div>
              </div>
              <input
                type="checkbox"
                className="toggle toggle-sm bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600
                         checked:bg-yellow-500 checked:border-yellow-500"
                checked={config?.experimental?.thinking_tokens ?? false}
                onChange={(e) =>
                  onConfigChange({
                    experimental: {
                      ...config?.experimental,
                      thinking_tokens: e.target.checked,
                    },
                  })
                }
              />
            </div>
          </div>

          <p className="mt-2 text-[10px] text-yellow-600 dark:text-yellow-500">
            ⚠️ Experimental features may be unstable and change without notice
          </p>
        </div>
      </div>
    </CollapsibleCard>
  );
}
