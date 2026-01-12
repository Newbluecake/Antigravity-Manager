import { useState, useRef } from 'react';
import { Download, Upload, FileJson, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ProxyConfig } from '../../types/proxy';
import { CollapsibleCard } from './shared/CollapsibleCard';
import { proxyApi } from '../../api/proxyApi';

interface ConfigImportExportProps {
  config: ProxyConfig | null;
  onConfigImported: () => void;
}

export function ConfigImportExport({ config, onConfigImported }: ConfigImportExportProps) {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    if (!config) return;

    setExporting(true);
    try {
      const blob = await proxyApi.exportConfig();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proxy-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      setImportError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const validateConfig = (data: any): data is ProxyConfig => {
    // Basic validation
    if (typeof data !== 'object' || data === null) return false;
    if (typeof data.enabled !== 'boolean') return false;
    if (typeof data.port !== 'number' || data.port < 1024 || data.port > 65535) return false;
    if (typeof data.bind_address !== 'string') return false;
    return true;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);
    setImportSuccess(false);

    try {
      // Read file content
      const text = await file.text();
      let parsedConfig: any;

      try {
        parsedConfig = JSON.parse(text);
      } catch {
        throw new Error('Invalid JSON format');
      }

      // Validate configuration
      if (!validateConfig(parsedConfig)) {
        throw new Error('Invalid configuration format. Missing required fields or invalid values.');
      }

      // Import via API
      await proxyApi.importConfig(file);

      setImportSuccess(true);
      setTimeout(() => {
        setImportSuccess(false);
        onConfigImported();
      }, 2000);
    } catch (error) {
      console.error('Import failed:', error);
      setImportError(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <CollapsibleCard
      title="Configuration Import/Export"
      icon={<FileJson className="w-5 h-5" />}
      defaultExpanded={false}
    >
      <div className="space-y-4">
        {/* Description */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs text-blue-900 dark:text-blue-200">
            Export your proxy configuration to a JSON file for backup, or import a previously
            exported configuration to restore settings.
          </p>
        </div>

        {/* Export Section */}
        <div>
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <Download className="w-3 h-3" />
            Export Configuration
          </h4>
          <button
            onClick={handleExport}
            disabled={!config || exporting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm
                     bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export to JSON'}
          </button>
          <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
            Download current configuration as a JSON file
          </p>
        </div>

        {/* Import Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <Upload className="w-3 h-3" />
            Import Configuration
          </h4>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            onClick={handleImportClick}
            disabled={importing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm
                     bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600
                     text-gray-700 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600
                     dark:hover:border-blue-500 dark:hover:text-blue-400 rounded-lg transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
            {importing ? 'Importing...' : 'Import from JSON'}
          </button>
          <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
            Select a previously exported configuration file
          </p>

          {/* Import Success */}
          {importSuccess && (
            <div className="mt-3 flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-xs text-green-700 dark:text-green-300">
                Configuration imported successfully!
              </span>
            </div>
          )}

          {/* Import Error */}
          {importError && (
            <div className="mt-3 flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-red-700 dark:text-red-300">
                  Import Failed
                </div>
                <div className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">
                  {importError}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Warning */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-yellow-800 dark:text-yellow-200">
              <strong>Warning:</strong> Importing a configuration will replace all current settings.
              Make sure to export your current configuration first if you want to keep it.
            </p>
          </div>
        </div>
      </div>
    </CollapsibleCard>
  );
}
