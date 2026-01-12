import { create } from 'zustand';
import { apiClient, DashboardStats, ProxyStatus, AccountListResponse } from './api';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  login: (password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => boolean;
}

interface DashboardState {
  stats: DashboardStats | null;
  loading: boolean;
  error: string | null;
  fetchStats: () => Promise<void>;
}

interface ProxyState {
  status: ProxyStatus | null;
  loading: boolean;
  error: string | null;
  fetchStatus: () => Promise<void>;
  startProxy: (config: any) => Promise<void>;
  stopProxy: () => Promise<void>;
}

interface AccountState {
  accounts: AccountListResponse | null;
  loading: boolean;
  error: string | null;
  fetchAccounts: () => Promise<void>;
  refreshAccount: (id: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!apiClient.getToken(),
  token: apiClient.getToken(),
  login: async (password: string) => {
    try {
      const response = await apiClient.login(password);
      set({ isAuthenticated: true, token: response.token });
    } catch (error) {
      throw error;
    }
  },
  logout: () => {
    apiClient.clearToken();
    set({ isAuthenticated: false, token: null });
  },
  checkAuth: () => {
    const token = apiClient.getToken();
    const isAuth = !!token;
    set({ isAuthenticated: isAuth, token });
    return isAuth;
  },
}));

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: null,
  loading: false,
  error: null,
  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await apiClient.getDashboardStats();
      set({ stats, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
}));

export const useProxyStore = create<ProxyState>((set) => ({
  status: null,
  loading: false,
  error: null,
  fetchStatus: async () => {
    set({ loading: true, error: null });
    try {
      const status = await apiClient.getProxyStatus();
      set({ status, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  startProxy: async (config: any) => {
    set({ loading: true, error: null });
    try {
      const status = await apiClient.startProxy(config);
      set({ status, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  stopProxy: async () => {
    set({ loading: true, error: null });
    try {
      await apiClient.stopProxy();
      const status = await apiClient.getProxyStatus();
      set({ status, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
}));

export const useAccountStore = create<AccountState>((set) => ({
  accounts: null,
  loading: false,
  error: null,
  fetchAccounts: async () => {
    set({ loading: true, error: null });
    try {
      const accounts = await apiClient.getAccounts();
      set({ accounts, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  refreshAccount: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await apiClient.refreshAccount(id);
      const accounts = await apiClient.getAccounts();
      set({ accounts, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
}));
