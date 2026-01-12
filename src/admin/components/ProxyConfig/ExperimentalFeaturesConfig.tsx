import { Zap, AlertTriangle } from 'lucide-react';
import type { ProxyConfig } from '../../types/proxy';
import { CollapsibleCard } from './shared/CollapsibleCard';

interface ExperimentalFeaturesConfigProps {
  config: ProxyConfig | null;
  onConfigChange: (config: Partial<ProxyConfig>) => void;
}

export function ExperimentalFeaturesConfig({ config, onConfigChange }: ExperimentalFeaturesConfigProps) {
  const experimental = config?.experimental || {
    thinking_tokens: false,
  };

  const handleToggle = (key: keyof typeof experimental, value: boolean) => {
    onConfigChange({
      experimental: {
        ...experimental,
        [key]: value,
      },
    });
  };

  // If there are no experimental features enabled and we want to keep it collapsed by default
  // But CollapsibleCard handles defaultExpanded.

  return (
    <CollapsibleCard
      title="Experimental Features"
      icon={<Zap className="w-5 h-5 text-yellow-500" />}
      defaultExpanded={false}
      className="border-yellow-200 dark:border-yellow-900/50"
    >
      <div className="space-y-4">
        {/* Warning Banner */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              <strong>Warning:</strong> These features are experimental and may be unstable, change behaviors, or be removed in future updates. Use with caution.
            </p>
          </div>
        </div>

        {/* Thinking Tokens */}
        <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Extended Thinking Tokens
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded uppercase">
                Beta
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Enable extended thinking mode for supported models (e.g., Claude 3.7 Sonnet). This allows models to "think" before responding.
            </p>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-warning toggle-sm"
            checked={experimental.thinking_tokens}
            onChange={(e) => handleToggle('thinking_tokens', e.target.checked)}
          />
        </div>

        {/* Future experimental features can be added here */}
      </div>
    </CollapsibleCard>
  );
}
