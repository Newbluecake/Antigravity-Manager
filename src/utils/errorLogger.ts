import { invoke } from '@tauri-apps/api/core';

export interface ErrorInfo {
  message: string;
  stack?: string;
  url?: string;
  line?: number;
  column?: number;
}

export class ErrorLogger {
  /**
   * 记录 JS 错误到后端
   */
  static async logError(error: Error | ErrorInfo): Promise<void> {
    try {
      const errorInfo = this.formatError(error);

      await invoke('log_js_error', {
        message: errorInfo.message,
        stack: errorInfo.stack || '',
        url: errorInfo.url || window.location.href,
        line: errorInfo.line || 0,
        column: errorInfo.column || 0,
      });
    } catch (e) {
      // 降级: 记录到 console
      console.error('[ErrorLogger] Failed to log error to backend:', e);
      console.error('[Original Error]:', error);
    }
  }

  private static formatError(error: Error | ErrorInfo): ErrorInfo {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        url: window.location.href,
      };
    }
    return error;
  }

  /**
   * 打开日志文件夹
   */
  static async openLogsFolder(): Promise<void> {
    await invoke('open_logs_folder');
  }

  /**
   * 获取日志路径
   */
  static async getLogsPath(): Promise<string> {
    return await invoke('get_logs_path');
  }
}
