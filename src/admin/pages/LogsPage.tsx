import React, { useEffect, useState } from 'react';
import { apiClient, LogFileEntry, LogContent } from '../api';
import { FileText, RefreshCw, AlertCircle } from 'lucide-react';

export const LogsPage: React.FC = () => {
  const [files, setFiles] = useState<LogFileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  useEffect(() => {
    if (selectedFile) {
      fetchLogs(selectedFile);
    }
  }, [selectedFile]);

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.getLogFiles();
      setFiles(result);
      if (result.length > 0 && !selectedFile) {
        setSelectedFile(result[0].name);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch log files');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (file: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.getLogs(file, 1000);
      setLogs(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">System Logs</h1>
          <p className="text-gray-400 mt-1">View application logs</p>
        </div>
        <button
          onClick={() => {
            fetchFiles();
            if (selectedFile) fetchLogs(selectedFile);
          }}
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* File List */}
        <div className="lg:col-span-1">
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-700/50 border-b border-gray-700">
              <h2 className="text-sm font-semibold text-white">Log Files</h2>
            </div>
            <div className="divide-y divide-gray-700 max-h-96 overflow-y-auto">
              {files.map((file) => (
                <button
                  key={file.name}
                  onClick={() => setSelectedFile(file.name)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-700/30 transition-colors ${
                    selectedFile === file.name ? 'bg-gray-700/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{file.name}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatFileSize(file.size)}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(file.modified)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Log Content */}
        <div className="lg:col-span-3">
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-700/50 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                {selectedFile || 'Select a log file'}
              </h2>
              {logs && (
                <span className="text-xs text-gray-400">
                  {logs.lines.length} lines
                </span>
              )}
            </div>
            <div className="p-4">
              {loading && !logs && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              )}

              {logs && (
                <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-[600px]">
                  <pre className="text-xs text-gray-300 font-mono">
                    {logs.lines.join('\n')}
                  </pre>
                </div>
              )}

              {!loading && !logs && (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Select a log file to view</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
