import { Coins, AlertTriangle } from 'lucide-react';
import type { ProxyConfig } from '../../types/proxy';
import { CollapsibleCard } from './shared/CollapsibleCard';

interface TokenManagerConfigProps {
  config: ProxyConfig | null;
  onConfigChange: (config: Partial<ProxyConfig>) => void;
}

export function TokenManagerConfig({ config, onConfigChange }: TokenManagerConfigProps) {
  const tokenManager = config?.token_manager || {
    enabled: false,
    daily_limit: 1000000,
    max_tokens_per_request: 100000,
  };

  const handleToggle = (enabled: boolean) => {
    onConfigChange({
      token_manager: {
        ...tokenManager,
        enabled,
      },
    });
  };

  const handleDailyLimitChange = (limit: number) => {
    // Validate limit > 0
    const validLimit = Math.max(1000, limit);
    onConfigChange({
      token_manager: {
        ...tokenManager,
        daily_limit: validLimit,
      },
    });
  };

  const handleMaxTokensChange = (max: number) => {
    // Validate max > 0
    const validMax = Math.max(100, max);
    onConfigChange({
      token_manager: {
        ...tokenManager,
        max_tokens_per_request: validMax,
      },
    });
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  return (
    <CollapsibleCard
      title="Token Management"
      icon={<Coins className="w-5 h-5" />}
      enabled={tokenManager.enabled}
      onToggle={handleToggle}
      defaultExpanded={false}
    >
      <div className="space-y-4">
        {/* Description */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <p className="text-xs text-yellow-900 dark:text-yellow-200">
            <strong>Token Management</strong> helps control API usage and costs by setting limits on
            daily consumption and per-request token counts.
          </p>
        </div>

        {/* Daily Limit */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Daily Token Limit
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="10000"
              max="10000000"
              step="10000"
              value={tokenManager.daily_limit}
              onChange={(e) => handleDailyLimitChange(parseInt(e.target.value))}
              className="flex-1 range range-warning range-sm"
              disabled={!tokenManager.enabled}
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={tokenManager.daily_limit}
                onChange={(e) => handleDailyLimitChange(parseInt(e.target.value))}
                min="1000"
                disabled={!tokenManager.enabled}
                className="w-28 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">tokens</span>
            </div>
          </div>
          <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
            Maximum tokens allowed per day ({formatNumber(tokenManager.daily_limit)})
          </p>
        </div>

        {/* Max Tokens Per Request */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Max Tokens Per Request
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1000"
              max="200000"
              step="1000"
              value={tokenManager.max_tokens_per_request}
              onChange={(e) => handleMaxTokensChange(parseInt(e.target.value))}
              className="flex-1 range range-warning range-sm"
              disabled={!tokenManager.enabled}
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={tokenManager.max_tokens_per_request}
                onChange={(e) => handleMaxTokensChange(parseInt(e.target.value))}
                min="100"
                disabled={!tokenManager.enabled}
                className="w-28 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">tokens</span>
            </div>
          </div>
          <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
            Maximum tokens allowed in a single request ({formatNumber(tokenManager.max_tokens_per_request)})
          </p>
        </div>

        {/* Usage Stats (Placeholder for now) */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-gray-400" />
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Current Usage
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-[10px] text-gray-500 dark:text-gray-400">Today</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">0</div>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-[10px] text-gray-500 dark:text-gray-400">Remaining</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {formatNumber(tokenManager.daily_limit)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </CollapsibleCard>
  );
}
