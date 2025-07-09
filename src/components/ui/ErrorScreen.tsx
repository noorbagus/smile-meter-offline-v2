// src/components/ui/ErrorScreen.tsx
import React from 'react';
import { Shield, Wifi, Camera, AlertTriangle, RefreshCw } from 'lucide-react';
import type { ErrorInfo, PermissionState } from '../../hooks';

interface ErrorScreenProps {
  errorInfo: ErrorInfo;
  permissionState: PermissionState;
  onRequestPermission: () => void;
  onRetry: () => void;
  debugInfo?: {
    protocol: string;
    hostname: string;
    userAgent: string;
  };
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({
  errorInfo,
  permissionState,
  onRequestPermission,
  onRetry,
  debugInfo
}) => {
  const getErrorIcon = () => {
    switch (errorInfo.type) {
      case 'permission': return Shield;
      case 'https': return Wifi;
      case 'device': return Camera;
      default: return AlertTriangle;
    }
  };

  const ErrorIcon = getErrorIcon();

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm z-30">
      <div className="text-center px-6 max-w-md">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <ErrorIcon className="w-10 h-10 text-red-400" />
        </div>
        
        <div className="text-white text-xl font-medium mb-3">
          {errorInfo.message}
        </div>
        
        <div className="text-white/70 text-sm mb-6">
          {errorInfo.solution}
        </div>
        
        <div className="space-y-3">
          {permissionState === 'denied' && errorInfo.type === 'permission' && (
            <button
              onClick={onRequestPermission}
              className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium transition-colors"
            >
              <Shield className="w-5 h-5 inline mr-2" />
              Grant Camera Access
            </button>
          )}
          
          <button
            onClick={onRetry}
            className="w-full px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium transition-colors"
          >
            <RefreshCw className="w-5 h-5 inline mr-2" />
            Try Again
          </button>
        </div>
        
        {/* Debug info for developers */}
        {debugInfo && (
          <details className="mt-6 text-left">
            <summary className="text-white/50 text-xs cursor-pointer hover:text-white/70">
              Technical Details
            </summary>
            <div className="mt-2 p-3 bg-black/50 rounded text-xs font-mono text-white/60">
              <div>Protocol: {debugInfo.protocol}</div>
              <div>Host: {debugInfo.hostname}</div>
              <div>Permission State: {permissionState}</div>
              <div>Error Type: {errorInfo.type}</div>
              <div>User Agent: {debugInfo.userAgent.substring(0, 50)}...</div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
};