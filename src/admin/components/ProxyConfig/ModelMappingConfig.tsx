import { useState } from 'react';
import { Network, Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import type { ProxyConfig } from '../../types/proxy';
import { CollapsibleCard } from './shared/CollapsibleCard';
import { GroupedSelect, SelectOption } from './shared/GroupedSelect';
import { MappingListBuilder } from './shared/MappingListBuilder';

interface ModelMappingConfigProps {
  config: ProxyConfig | null;
  onConfigChange: (config: Partial<ProxyConfig>) => void;
}

// Mock model options - in real implementation, fetch from API or static list
const MODEL_OPTIONS: SelectOption[] = [
  // Claude models
  { value: 'claude-3-5-sonnet-20241022', label: 'claude-3-5-sonnet-20241022', group: 'Claude' },
  { value: 'claude-3-5-sonnet-20240620', label: 'claude-3-5-sonnet-20240620', group: 'Claude' },
  { value: 'claude-3-opus-20240229', label: 'claude-3-opus-20240229', group: 'Claude' },
  { value: 'claude-3-haiku-20240307', label: 'claude-3-haiku-20240307', group: 'Claude' },

  // Gemini models
  { value: 'gemini-1.5-pro', label: 'gemini-1.5-pro', group: 'Gemini' },
  { value: 'gemini-1.5-flash', label: 'gemini-1.5-flash', group: 'Gemini' },

  // OpenAI models
  { value: 'gpt-4-turbo', label: 'gpt-4-turbo', group: 'OpenAI' },
  { value: 'gpt-4', label: 'gpt-4', group: 'OpenAI' },
  { value: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo', group: 'OpenAI' },
];

export function ModelMappingConfig({ config, onConfigChange }: ModelMappingConfigProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  // Form state for adding/editing
  const [sourceModel, setSourceModel] = useState('');
  const [targetModel, setTargetModel] = useState('');
  const [fallbackChain, setFallbackChain] = useState<string | string[]>('');

  const customMapping = config?.custom_mapping || {};

  const handleStartAdd = () => {
    setIsAdding(true);
    setSourceModel('');
    setTargetModel('');
    setFallbackChain('');
  };

  const handleCancelEdit = () => {
    setIsAdding(false);
    setEditingKey(null);
    setSourceModel('');
    setTargetModel('');
    setFallbackChain('');
  };

  const handleSave = () => {
    if (!sourceModel || !targetModel) return;

    const newMapping = { ...customMapping };

    // Build the mapping value: if fallback chain exists, use array, else single string
    let mappingValue: string | string[];
    if (Array.isArray(fallbackChain) && fallbackChain.length > 0) {
      mappingValue = [targetModel, ...fallbackChain];
    } else if (typeof fallbackChain === 'string' && fallbackChain) {
      mappingValue = [targetModel, fallbackChain];
    } else {
      mappingValue = targetModel;
    }

    newMapping[sourceModel] = mappingValue;

    onConfigChange({ custom_mapping: newMapping });
    handleCancelEdit();
  };

  const handleEdit = (key: string) => {
    const value = customMapping[key];
    setEditingKey(key);
    setSourceModel(key);

    if (Array.isArray(value)) {
      setTargetModel(value[0]);
      setFallbackChain(value.slice(1));
    } else {
      setTargetModel(value);
      setFallbackChain('');
    }
  };

  const handleDelete = (key: string) => {
    if (!confirm(`Delete mapping for "${key}"?`)) return;

    const newMapping = { ...customMapping };
    delete newMapping[key];
    onConfigChange({ custom_mapping: newMapping });
  };

  return (
    <CollapsibleCard
      title="Model Mapping"
      icon={<Network className="w-5 h-5" />}
      defaultExpanded={true}
      rightElement={
        !isAdding && !editingKey && (
          <button
            onClick={handleStartAdd}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Mapping
          </button>
        )
      }
    >
      <div className="space-y-4">
        {/* Add/Edit Form */}
        {(isAdding || editingKey) && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
            <h5 className="text-sm font-semibold text-gray-900 dark:text-white">
              {isAdding ? 'Add New Mapping' : 'Edit Mapping'}
            </h5>

            {/* Source Model */}
            <div>
              <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">
                Source Model (request name)
              </label>
              <input
                type="text"
                value={sourceModel}
                onChange={(e) => setSourceModel(e.target.value)}
                disabled={!!editingKey}
                placeholder="e.g., claude-3-5-sonnet"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600
                         text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Target Model */}
            <div>
              <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">
                Target Model (primary)
              </label>
              <GroupedSelect
                value={targetModel}
                onChange={setTargetModel}
                options={MODEL_OPTIONS}
                placeholder="Select primary target model"
              />
            </div>

            {/* Fallback Chain */}
            <div>
              <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">
                Fallback Chain (optional)
              </label>
              <MappingListBuilder
                value={fallbackChain}
                onChange={setFallbackChain}
                modelOptions={MODEL_OPTIONS}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={!sourceModel || !targetModel}
                className="flex items-center gap-1 px-3 py-2 text-xs bg-green-600 hover:bg-green-700
                         disabled:bg-gray-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                <Save className="w-3 h-3" />
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-1 px-3 py-2 text-xs bg-gray-500 hover:bg-gray-600
                         text-white rounded-lg transition-colors"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Mappings List */}
        {Object.keys(customMapping).length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No model mappings configured. Click "Add Mapping" to create one.
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(customMapping).map(([key, value]) => {
              const isArray = Array.isArray(value);
              const primaryModel = isArray ? value[0] : value;
              const fallbacks = isArray ? value.slice(1) : [];

              return (
                <div
                  key={key}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-mono font-semibold text-gray-900 dark:text-white">
                          {key}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="text-sm font-mono text-blue-600 dark:text-blue-400">
                          {primaryModel}
                        </span>
                      </div>

                      {fallbacks.length > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Fallback chain: {fallbacks.join(' → ')}
                        </div>
                      )}
                    </div>

                    {!isAdding && !editingKey && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEdit(key)}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                          title="Edit mapping"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(key)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Delete mapping"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
}
