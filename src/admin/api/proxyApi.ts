import axios from 'axios';
import type { ProxyStatus, ProxyConfig } from '../types/proxy';

const API_BASE = '/api/v1/proxy';

// Get auth headers from stored token
const getHeaders = () => {
  const token = localStorage.getItem('web_admin_token');
  if (!token) {
    throw new Error('Not authenticated');
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

export const proxyApi = {
  // Status API
  getStatus: async (): Promise<ProxyStatus> => {
    const { data } = await axios.get<ProxyStatus>(`${API_BASE}/status`, {
      headers: getHeaders()
    });
    return data;
  },

  // Control API
  start: async (): Promise<void> => {
    await axios.post(`${API_BASE}/start`, {}, {
      headers: getHeaders()
    });
  },

  stop: async (): Promise<void> => {
    await axios.post(`${API_BASE}/stop`, {}, {
      headers: getHeaders()
    });
  },

  restart: async (): Promise<void> => {
    await axios.post(`${API_BASE}/restart`, {}, {
      headers: getHeaders()
    });
  },

  // Configuration API
  getConfig: async (): Promise<ProxyConfig> => {
    const { data } = await axios.get<ProxyConfig>(`${API_BASE}/config`, {
      headers: getHeaders()
    });
    return data;
  },

  updateConfig: async (config: ProxyConfig): Promise<void> => {
    await axios.put(`${API_BASE}/config`, config, {
      headers: getHeaders()
    });
  },

  patchConfig: async (partial: Partial<ProxyConfig>): Promise<void> => {
    await axios.patch(`${API_BASE}/config`, partial, {
      headers: getHeaders()
    });
  },

  // Import/Export API
  exportConfig: async (): Promise<Blob> => {
    const { data } = await axios.post(`${API_BASE}/config/export`, {}, {
      headers: getHeaders(),
      responseType: 'blob'
    });
    return data;
  },

  importConfig: async (file: File): Promise<void> => {
    const formData = new FormData();
    formData.append('file', file);
    await axios.post(`${API_BASE}/config/import`, formData, {
      headers: {
        ...getHeaders(),
        'Content-Type': 'multipart/form-data'
      }
    });
  },
};
