import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8046/api/v1';

export interface LoginResponse {
  token: string;
  expires_at: number;
}

export interface DashboardStats {
  total_accounts: number;
  active_accounts: number;
  proxy_status: string;
  total_requests: number;
  total_tokens: number;
  requests_per_minute: number;
}

export interface ProxyStatus {
  running: boolean;
  port: number;
  base_url: string;
  active_accounts: number;
}

export interface AccountSummary {
  id: string;
  email: string;
  name: string | null;
  created_at: number;
  last_used: number | null;
}

export interface AccountListResponse {
  accounts: AccountSummary[];
  current_account_id: string | null;
}

export interface LogFileEntry {
  name: string;
  size: number;
  modified: number;
}

export interface LogContent {
  lines: string[];
}

export class WebAdminClient {
  private token: string | null = null;

  constructor() {
    // Load token from localStorage
    const stored = localStorage.getItem('web_admin_token');
    if (stored) {
      this.token = stored;
    }
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('web_admin_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('web_admin_token');
  }

  getToken(): string | null {
    return this.token;
  }

  private getHeaders() {
    if (!this.token) {
      throw new Error('Not authenticated');
    }
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  async login(password: string): Promise<LoginResponse> {
    try {
      const response = await axios.post<LoginResponse>(
        `${API_BASE_URL}/auth/login`,
        { password }
      );
      this.setToken(response.data.token);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error || 'Login failed');
      }
      throw error;
    }
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const response = await axios.get<DashboardStats>(
      `${API_BASE_URL}/dashboard/stats`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async getProxyStatus(): Promise<ProxyStatus> {
    const response = await axios.get<ProxyStatus>(
      `${API_BASE_URL}/proxy/status`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async startProxy(config: any): Promise<ProxyStatus> {
    const response = await axios.post<ProxyStatus>(
      `${API_BASE_URL}/proxy/start`,
      config,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async stopProxy(): Promise<void> {
    await axios.post(
      `${API_BASE_URL}/proxy/stop`,
      {},
      { headers: this.getHeaders() }
    );
  }

  async getAccounts(): Promise<AccountListResponse> {
    const response = await axios.get<AccountListResponse>(
      `${API_BASE_URL}/accounts`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async getAccount(id: string): Promise<any> {
    const response = await axios.get(
      `${API_BASE_URL}/accounts/${id}`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async refreshAccount(id: string): Promise<any> {
    const response = await axios.post(
      `${API_BASE_URL}/accounts/${id}/refresh`,
      {},
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async updateAccount(id: string, data: { name?: string }): Promise<any> {
    const response = await axios.patch(
      `${API_BASE_URL}/accounts/${id}`,
      data,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async getLogFiles(): Promise<LogFileEntry[]> {
    const response = await axios.get<LogFileEntry[]>(
      `${API_BASE_URL}/system/logs/files`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async getLogs(file?: string, lines?: number): Promise<LogContent> {
    const params = new URLSearchParams();
    if (file) params.append('file', file);
    if (lines) params.append('lines', lines.toString());

    const response = await axios.get<LogContent>(
      `${API_BASE_URL}/system/logs?${params.toString()}`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  createWebSocket(): WebSocket | null {
    if (!this.token) {
      return null;
    }
    const wsUrl = `ws://127.0.0.1:8046/api/v1/ws?token=${this.token}`;
    return new WebSocket(wsUrl);
  }
}

export const apiClient = new WebAdminClient();
