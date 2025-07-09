// src/hooks/useDebugLogger.ts
import { useState, useCallback } from 'react';

export interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'success';
}

export const useDebugLogger = (maxLogs: number = 15) => {
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [detailedLogs, setDetailedLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((message: string, level: 'info' | 'warning' | 'error' | 'success' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    
    // Console logging with appropriate level
    switch (level) {
      case 'error':
        console.error(logEntry);
        break;
      case 'warning':
        console.warn(logEntry);
        break;
      case 'success':
        console.log(`✅ ${logEntry}`);
        break;
      default:
        console.log(logEntry);
    }

    // Update simple logs for UI display
    setDebugLogs(prev => [...prev.slice(-(maxLogs - 1)), logEntry]);

    // Update detailed logs for advanced debugging
    setDetailedLogs(prev => [...prev.slice(-(maxLogs - 1)), {
      timestamp,
      message,
      level
    }]);
  }, [maxLogs]);

  const clearLogs = useCallback(() => {
    setDebugLogs([]);
    setDetailedLogs([]);
  }, []);

  const getRecentLogs = useCallback((count: number = 5) => {
    return debugLogs.slice(-count);
  }, [debugLogs]);

  const exportLogs = useCallback(() => {
    const logsText = detailedLogs
      .map(log => `${log.timestamp} [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');
    
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `camera-kit-logs-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [detailedLogs]);

  return {
    debugLogs,
    detailedLogs,
    addLog,
    clearLogs,
    getRecentLogs,
    exportLogs
  };
};