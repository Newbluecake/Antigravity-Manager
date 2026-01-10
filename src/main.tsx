import React from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";

import App from './App';
import './i18n'; // Import i18n config
import "./App.css";
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErrorLogger } from './utils/errorLogger';

// 启动时显式调用 Rust 命令显示窗口
// 配合 visible:false 使用，解决启动黑屏问题
invoke("show_main_window").catch(console.error);

// Global error handlers
window.onerror = (message, source, lineno, colno, error) => {
  ErrorLogger.logError({
    message: typeof message === 'string' ? message : message.toString(),
    stack: error?.stack,
    url: source,
    line: lineno,
    column: colno,
  });
  return false; // Don't prevent default behavior
};

window.addEventListener('unhandledrejection', (event) => {
  ErrorLogger.logError({
    message: `Unhandled Promise Rejection: ${event.reason}`,
    stack: event.reason?.stack,
    url: window.location.href,
  });
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
