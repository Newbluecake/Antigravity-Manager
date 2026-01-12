import { useState } from 'react';
import { Users, Trash2, Clock, Database } from 'lucide-react';
import type { ProxyConfig } from '../../types/proxy';
import { CollapsibleCard } from './shared/CollapsibleCard';

interface StickySessionConfigProps {
  config: ProxyConfig | null;
  onConfigChange: (config: Partial<ProxyConfig>) => void;
}

export function StickySessionConfig({ config, onConfigChange }: StickySessionConfigProps) {
  const [isClearingConfirm, setIsClearingConfirm] = useState(false);

  const stickySession = config?.sticky_session || {
    enabled: false,
    ttl: 3600,
    cleanup_strategy: 'timer' as const,
    cleanup_interval: 300,
    memory_threshold: 1000,
  };

  const handleToggle = (enabled: boolean) => {
    onConfigChange({
      sticky_session: {
        ...stickySession,
        enabled,
      },
    });
  };

  const handleTTLChange = (ttl: number) => {
    // Validate TTL range: 60-86400 seconds (1 minute to 24 hours)
    const validTTL = Math.max(60, Math.min(86400, ttl));
    onConfigChange({
      sticky_session: {
        ...stickySession,
        ttl: validTTL,
      },
    });
  };

  const handleCleanupStrategyChange = (strategy: 'timer' | 'memory') => {
    onConfigChange({
      sticky_session: {
        ...stickySession,
        cleanup_strategy: strategy,
      },
    });
  };

  const handleCleanupIntervalChange = (interval: number) => {
    const validInterval = Math.max(60, Math.min(3600, interval));
    onConfigChange({
      sticky_session: {
        ...stickySession,
        cleanup_interval: validInterval,
      },
    });
  };

  const handleMemoryThresholdChange = (threshold: number) => {
    const validThreshold = Math.max(100, Math.min(10000, threshold));
    onConfigChange({
      sticky_session: {
        ...stickySession,
        memory_threshold: validThreshold,
      },
    });
  };

  const handleClearSessions = async () => {
    if (!isClearingConfirm) {
      setIsClearingConfirm(true);
      return;
    }

    // TODO: Call API to clear sessions
    try {
      // await proxyApi.clearSessions();
      console.log('Clearing sessions...');
      setIsClearingConfirm(false);
    } catch (error) {
      console.error('Failed to clear sessions:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  return (
    <CollapsibleCard
      title="Sticky Session"
      icon={<Users className="w-5 h-5" />}
      enabled={stickySession.enabled}
      onToggle={handleToggle}
      defaultExpanded={false}
    >
      <div className="space-y-4">
        {/* Description */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs text-blue-900 dark:text-blue-200">
            <strong>Sticky Session</strong> binds user sessions to specific accounts, maintaining
            conversation context and maximizing prompt cache efficiency. Sessions expire after the
            configured TTL.
          </p>
        </div>

        {/* TTL Configuration */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Clock className="w-3 h-3 inline mr-1" />
            Session TTL (Time to Live)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="60"
              max="86400"
              step="60"
              value={stickySession.ttl}
              onChange={(e) => handleTTLChange(parseInt(e.target.value))}
              className="flex-1 range range-primary range-sm"
              disabled={!stickySession.enabled}
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={stickySession.ttl}
                onChange={(e) => handleTTLChange(parseInt(e.target.value))}
                min="60"
                max="86400"
                disabled={!stickySession.enabled}
                className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400 w-8">sec</span>
            </div>
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-gray-400">
            <span>1 min</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {formatDuration(stickySession.ttl)}
            </span>
            <span>24 hours</span>
          </div>
        </div>

        {/* Cleanup Strategy */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Database className="w-3 h-3 inline mr-1" />
            Cleanup Strategy
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleCleanupStrategyChange('timer')}
              disabled={!stickySession.enabled}
              className={`px-3 py-2 text-xs rounded-lg border-2 transition-all ${
                stickySession.cleanup_strategy === 'timer'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-300'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Clock className="w-4 h-4 mx-auto mb-1" />
              Timer-based
            </button>
            <button
              onClick={() => handleCleanupStrategyChange('memory')}
              disabled={!stickySession.enabled}
              className={`px-3 py-2 text-xs rounded-lg border-2 transition-all ${
                stickySession.cleanup_strategy === 'memory'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-300'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Database className="w-4 h-4 mx-auto mb-1" />
              Memory-based
            </button>
          </div>
        </div>

        {/* Strategy-specific settings */}
        {stickySession.cleanup_strategy === 'timer' ? (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cleanup Interval
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={stickySession.cleanup_interval}
                onChange={(e) => handleCleanupIntervalChange(parseInt(e.target.value))}
                min="60"
                max="3600"
                disabled={!stickySession.enabled}
                className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-gray-500">seconds</span>
            </div>
            <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
              Expired sessions cleaned up every {formatDuration(stickySession.cleanup_interval)}
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Memory Threshold
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={stickySession.memory_threshold}
                onChange={(e) => handleMemoryThresholdChange(parseInt(e.target.value))}
                min="100"
                max="10000"
                disabled={!stickySession.enabled}
                className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-gray-500">sessions</span>
            </div>
            <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
              Cleanup triggered when session count exceeds threshold
            </p>
          </div>
        )}

        {/* Active Sessions & Clear Button */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Active Sessions
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {/* TODO: Get from API */}
                0
              </div>
            </div>
            <button
              onClick={handleClearSessions}
              disabled={!stickySession.enabled}
              className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors
                ${
                  isClearingConfirm
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400'
                }
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Trash2 className="w-3 h-3" />
              {isClearingConfirm ? 'Confirm Clear?' : 'Clear Sessions'}
            </button>
          </div>
        </div>
      </div>
    </CollapsibleCard>
  );
}
