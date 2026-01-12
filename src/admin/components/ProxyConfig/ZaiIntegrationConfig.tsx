import { useState } from 'react';
import { CloudCog, Key, Globe, Plus, Trash2, Save, X, Edit2 } from 'lucide-react';
import type { ProxyConfig } from '../../types/proxy';
import { CollapsibleCard } from './shared/CollapsibleCard';

interface ZaiIntegrationConfigProps {
  config: ProxyConfig | null;
  onConfigChange: (config: Partial<ProxyConfig>) => void;
}

export function ZaiIntegrationConfig({ config, onConfigChange }: ZaiIntegrationConfigProps) {
  const zai = config?.zai || {
    enabled: false,
    base_url: 'https://api.z.ai/v1',
    api_key: '',
    model_mapping: {},
  };

  const [isAddingMapping, setIsAddingMapping] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [zaiModel, setZaiModel] = useState('');
  const [targetModel, setTargetModel] = useState('');

  const handleToggle = (enabled: boolean) => {
    onConfigChange({
      zai: { ...zai, enabled },
    });
  };

  const handleFieldChange = (field: keyof typeof zai, value: string) => {
    onConfigChange({
      zai: { ...zai, [field]: value },
    });
  };

  const handleSaveMapping = () => {
    if (!zaiModel || !targetModel) return;

    const newMapping = { ...zai.model_mapping };

    // If editing, remove old key first if it changed
    if (editingKey && editingKey !== zaiModel) {
      delete newMapping[editingKey];
    }

    newMapping[zaiModel] = targetModel;

    onConfigChange({
      zai: {
        ...zai,
        model_mapping: newMapping,
      },
    });

    // Reset form
    setZaiModel('');
    setTargetModel('');
    setIsAddingMapping(false);
    setEditingKey(null);
  };

  const handleEditMapping = (key: string, value: string) => {
    setZaiModel(key);
    setTargetModel(value);
    setEditingKey(key);
    setIsAddingMapping(true);
  };

  const handleDeleteMapping = (key: string) => {
    const newMapping = { ...zai.model_mapping };
    delete newMapping[key];
    onConfigChange({
      zai: {
        ...zai,
        model_mapping: newMapping,
      },
    });
  };

  return (
    <CollapsibleCard
      title="Z.ai Integration"
      icon={<CloudCog className="w-5 h-5" />}
      enabled={zai.enabled}
      onToggle={handleToggle}
      defaultExpanded={false}
    >
      <div className="space-y-4">
        {/* Description */}
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
          <p className="text-xs text-purple-900 dark:text-purple-200">
            <strong>Z.ai Integration</strong> allows you to use Z.ai's LLM API services. Configure the
            endpoint and API key, and map Z.ai model names to internal model identifiers.
          </p>
        </div>

        {/* Base URL */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            <Globe className="w-3 h-3 inline mr-1" />
            API Base URL
          </label>
          <input
            type="text"
            value={zai.base_url}
            onChange={(e) => handleFieldChange('base_url', e.target.value)}
            placeholder="https://api.z.ai/v1"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            disabled={!zai.enabled}
          />
        </div>

        {/* API Key */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            <Key className="w-3 h-3 inline mr-1" />
            API Key
          </label>
          <input
            type="password"
            value={zai.api_key}
            onChange={(e) => handleFieldChange('api_key', e.target.value)}
            placeholder="sk-..."
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            disabled={!zai.enabled}
          />
        </div>

        {/* Model Mapping */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Z.ai Model Mappings
            </h4>
            {!isAddingMapping && (
              <button
                onClick={() => setIsAddingMapping(true)}
                disabled={!zai.enabled}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-50 dark:bg-purple-900/20
                         text-purple-600 dark:text-purple-400 rounded hover:bg-purple-100 dark:hover:bg-purple-900/40
                         disabled:opacity-50"
              >
                <Plus className="w-3 h-3" />
                Add Mapping
              </button>
            )}
          </div>

          {/* Add/Edit Form */}
          {isAddingMapping && (
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg mb-3 border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Z.ai Model ID</label>
                  <input
                    type="text"
                    value={zaiModel}
                    onChange={(e) => setZaiModel(e.target.value)}
                    placeholder="e.g. zai-model-v1"
                    className="w-full px-2 py-1.5 text-xs border rounded
                             bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600
                             text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Target Model</label>
                  <input
                    type="text"
                    value={targetModel}
                    onChange={(e) => setTargetModel(e.target.value)}
                    placeholder="e.g. claude-3-5-sonnet-20241022"
                    className="w-full px-2 py-1.5 text-xs border rounded
                             bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600
                             text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsAddingMapping(false);
                    setZaiModel('');
                    setTargetModel('');
                    setEditingKey(null);
                  }}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSaveMapping}
                  disabled={!zaiModel || !targetModel}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
                >
                  <Save className="w-3 h-3" />
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Mappings List */}
          <div className="space-y-2">
            {Object.entries(zai.model_mapping).length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-2 italic">
                No mappings configured
              </p>
            ) : (
              Object.entries(zai.model_mapping).map(([source, target]) => (
                <div
                  key={source}
                  className="flex items-center justify-between p-2 bg-white dark:bg-gray-800
                           border border-gray-200 dark:border-gray-700 rounded-lg group"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                        {source}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">
                        → {target}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEditMapping(source, target)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteMapping(source)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </CollapsibleCard>
  );
}
