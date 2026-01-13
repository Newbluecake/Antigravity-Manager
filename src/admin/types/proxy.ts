// Proxy configuration and status types for Web Admin

export interface ProxyStatus {
  running: boolean;
  port: number;
  base_url: string;
  active_accounts: number;
  active_sessions?: number; // Number of sticky sessions (if enabled)
}

export interface ProxyConfig {
  enabled: boolean;
  port: number;
  bind_address: string; // "127.0.0.1" | "0.0.0.0"
  auto_start: boolean;

  // Model mapping configuration
  custom_mapping: Record<string, string | string[]>;

  // Sticky session configuration
  sticky_session: {
    enabled: boolean;
    ttl: number; // seconds
    cleanup_strategy: 'timer' | 'memory';
    cleanup_interval?: number; // Timer cleanup interval (seconds)
    memory_threshold?: number; // Memory threshold (MB)
  };

  // Token manager configuration
  token_manager: {
    enabled: boolean;
    daily_limit: number;
    max_tokens_per_request: number;
  };

  // Advanced settings
  timeout: number; // Request timeout (seconds)
  enable_logging: boolean;
  log_stream_content?: boolean;
  upstream_proxy?: string; // Upstream proxy URL

  // ZAI integration
  zai: {
    enabled: boolean;
    base_url: string;
    api_key: string;
    model_mapping: Record<string, string>;
  };

  // Experimental features
  experimental: {
    thinking_tokens: boolean;
  };
}

export interface ModelMapping {
  source_model: string;
  target_provider: 'Claude' | 'Gemini' | 'OpenAI';
  target_model: string;
  aliases: string[];
  fallback_chain: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
