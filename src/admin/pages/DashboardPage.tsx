import React, { useEffect } from 'react';
import { useDashboardStore, useProxyStore } from '../store';
import { Activity, Users, Zap, TrendingUp, Server, Power, RefreshCw } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { stats, loading, error, fetchStats } = useDashboardStore();
  const { status: proxyStatus, fetchStatus } = useProxyStore();

  useEffect(() => {
    fetchStats();
    fetchStatus();
    const interval = setInterval(() => {
      fetchStats();
      fetchStatus();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [fetchStats, fetchStatus]);

  const handleRefresh = () => {
    fetchStats();
    fetchStatus();
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">System overview and statistics</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600
                   text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Accounts */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Total Accounts</p>
              <p className="text-3xl font-bold text-white mt-2">
                {stats?.total_accounts || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-green-400">{stats?.active_accounts || 0} active</span>
          </div>
        </div>

        {/* Proxy Status */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Proxy Service</p>
              <p className="text-3xl font-bold text-white mt-2 capitalize">
                {proxyStatus?.running ? 'Running' : 'Stopped'}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              proxyStatus?.running ? 'bg-green-500/20' : 'bg-gray-600/20'
            }`}>
              <Server className={`w-6 h-6 ${proxyStatus?.running ? 'text-green-500' : 'text-gray-500'}`} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            {proxyStatus?.running && (
              <span className="text-gray-400">Port: {proxyStatus.port}</span>
            )}
            {!proxyStatus?.running && (
              <span className="text-gray-500">Not running</span>
            )}
          </div>
        </div>

        {/* Total Requests */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Total Requests</p>
              <p className="text-3xl font-bold text-white mt-2">
                {stats?.total_requests.toLocaleString() || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-purple-500" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-green-400">{stats?.requests_per_minute.toFixed(1) || 0} req/min</span>
          </div>
        </div>

        {/* Total Tokens */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">Total Tokens</p>
              <p className="text-3xl font-bold text-white mt-2">
                {stats?.total_tokens.toLocaleString() || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-yellow-500" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-400">
            API consumption
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="#/proxy"
            className="flex items-center gap-3 p-4 bg-gray-700 hover:bg-gray-600
                     rounded-lg transition-colors group"
          >
            <Power className="w-5 h-5 text-blue-400 group-hover:text-blue-300" />
            <div>
              <p className="font-medium text-white">Proxy Control</p>
              <p className="text-sm text-gray-400">Manage proxy service</p>
            </div>
          </a>
          <a
            href="#/accounts"
            className="flex items-center gap-3 p-4 bg-gray-700 hover:bg-gray-600
                     rounded-lg transition-colors group"
          >
            <Users className="w-5 h-5 text-green-400 group-hover:text-green-300" />
            <div>
              <p className="font-medium text-white">Accounts</p>
              <p className="text-sm text-gray-400">Manage accounts</p>
            </div>
          </a>
          <a
            href="#/logs"
            className="flex items-center gap-3 p-4 bg-gray-700 hover:bg-gray-600
                     rounded-lg transition-colors group"
          >
            <Activity className="w-5 h-5 text-purple-400 group-hover:text-purple-300" />
            <div>
              <p className="font-medium text-white">System Logs</p>
              <p className="text-sm text-gray-400">View logs</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
};
