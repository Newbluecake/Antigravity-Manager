import { useState, useEffect } from 'react';
import { Plus, Trash2, HelpCircle } from 'lucide-react';
import { request as invoke } from '../../utils/request';
import { showToast } from '../common/ToastContainer';
import MappingListBuilder from './MappingListBuilder';
import { SelectOption } from '../common/GroupedSelect';
import { useTranslation } from 'react-i18next';

interface ModelMappingProps {
    customMapping?: Record<string, string | string[]>;
    onChange: (mapping: Record<string, string | string[]>) => void;
}

export default function ModelMapping({ customMapping = {}, onChange }: ModelMappingProps) {
    const { t } = useTranslation();
    const [modelOptions, setModelOptions] = useState<SelectOption[]>([]);
    const [newKey, setNewKey] = useState('');
    const [loading, setLoading] = useState(false);

    // Fetch dynamic model list from backend
    useEffect(() => {
        const fetchModels = async () => {
            setLoading(true);
            try {
                // Assuming backend exposes this command
                const models = await invoke<string[]>('get_all_dynamic_models');
                // Group models by provider (heuristic)
                const options = groupModels(models);
                setModelOptions(options);
            } catch (error) {
                console.error('Failed to fetch models:', error);
                // Fallback options if fetch fails
                const fallbackModels = [
                    ...['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'].map(v => ({ label: v, value: v, group: 'Claude' })),
                    ...['gpt-4-turbo', 'gpt-4o', 'gpt-3.5-turbo'].map(v => ({ label: v, value: v, group: 'GPT' })),
                    ...['gemini-1.5-pro', 'gemini-1.5-flash'].map(v => ({ label: v, value: v, group: 'Gemini' }))
                ];
                setModelOptions(fallbackModels);
            } finally {
                setLoading(false);
            }
        };

        fetchModels();
    }, []);

    const groupModels = (models: string[]): SelectOption[] => {
        const options: SelectOption[] = [];

        models.forEach(model => {
            let group = 'Other';
            if (model.toLowerCase().includes('claude')) {
                group = 'Claude';
            } else if (model.toLowerCase().includes('gpt')) {
                group = 'GPT';
            } else if (model.toLowerCase().includes('gemini')) {
                group = 'Gemini';
            }

            options.push({
                label: model,
                value: model,
                group
            });
        });

        return options;
    };

    const handleAddMapping = () => {
        if (!newKey) {
            showToast(t('settings.proxy.model_mapping_key_required'), 'error');
            return;
        }
        if (customMapping[newKey]) {
            showToast(t('settings.proxy.model_mapping_exists'), 'error');
            return;
        }

        onChange({
            ...customMapping,
            [newKey]: [] // Start with empty chain
        });
        setNewKey('');
    };

    const handleRemoveMapping = (key: string) => {
        const newMapping = { ...customMapping };
        delete newMapping[key];
        onChange(newMapping);
    };

    const handleChainChange = (key: string, value: string | string[]) => {
        onChange({
            ...customMapping,
            [key]: value
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <h3 className="text-md font-semibold text-gray-900 dark:text-base-content">
                    {t('settings.proxy.model_mapping')}
                </h3>
                <div className="tooltip tooltip-right" data-tip={t('settings.proxy.model_mapping_tooltip')}>
                    <HelpCircle size={16} className="text-gray-400 cursor-help" />
                </div>
            </div>

            <div className="space-y-4">
                {Object.entries(customMapping).map(([key, value]) => (
                    <div key={key} className="bg-white dark:bg-base-100 border border-gray-200 dark:border-base-300 rounded-lg p-4 transition-all hover:border-blue-300 dark:hover:border-blue-700">
                        <div className="flex justify-between items-center mb-3">
                            <div className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                                {key}
                            </div>
                            <button
                                onClick={() => handleRemoveMapping(key)}
                                className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                title={t('common.delete')}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <MappingListBuilder
                            value={value}
                            onChange={(newValue) => handleChainChange(key, newValue)}
                            modelOptions={modelOptions}
                        />
                    </div>
                ))}

                {Object.keys(customMapping).length === 0 && (
                    <div className="text-center py-8 text-gray-400 bg-gray-50 dark:bg-base-200 rounded-lg border border-dashed border-gray-200 dark:border-base-300">
                        {t('settings.proxy.no_mappings')}
                    </div>
                )}
            </div>

                {loading ? (
                    <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    <div className="flex gap-2 items-center mt-4 p-3 bg-gray-50 dark:bg-base-200 rounded-lg border border-gray-100 dark:border-base-300">
                        <input
                            type="text"
                            value={newKey}
                            onChange={(e) => setNewKey(e.target.value)}
                            placeholder={t('settings.proxy.new_mapping_placeholder')} // e.g. "gpt-4-custom"
                            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-base-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-base-100 text-gray-900 dark:text-base-content font-mono"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddMapping()}
                        />
                        <button
                            onClick={handleAddMapping}
                            disabled={!newKey}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-sm rounded-md transition-colors flex items-center gap-2"
                        >
                            <Plus size={16} />
                            {t('common.add')}
                        </button>
                    </div>
                )}
        </div>
    );
}
