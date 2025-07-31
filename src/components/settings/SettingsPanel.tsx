// src/components/settings/SettingsPanel.tsx - SETTINGS PANEL HIDDEN
import React from 'react';
import { X, Download } from 'lucide-react';
import { detectAndroid } from '../../utils/androidRecorderFix';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  debugLogs: string[];
  onExportLogs?: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = () => {
  // RETURN NULL - HIDE SETTINGS PANEL
  return null;

  /* ORIGINAL SETTINGS PANEL - COMMENTED OUT
  if (!isOpen) return null;

  const isAndroid = detectAndroid();

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 p-6">
      <div className="bg-white/10 rounded-lg p-6 max-w-md mx-auto mt-20">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white text-lg font-semibold">Settings</h3>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="text-white/80 text-sm">
            <p className="mb-2 font-medium">🎬 Recording Format:</p>
            <p className="text-xs text-white/60 bg-black/20 p-3 rounded">
              {isAndroid ? 
                '📱 Android: MP4 (H.264) - Optimized for Instagram/TikTok' : 
                '💻 Standard: MP4/WebM - Universal compatibility'
              }
            </p>
          </div>

          <div className="text-white/80 text-sm">
            <p className="mb-2 font-medium">📱 Device Info:</p>
            <div className="text-xs text-white/60 bg-black/20 p-3 rounded space-y-1">
              <p>Platform: {isAndroid ? 'Android' : 'Other'}</p>
              <p>Protocol: {location.protocol}</p>
              <p>Host: {location.hostname}</p>
              <p>User Agent: {navigator.userAgent.substring(0, 50)}...</p>
            </div>
          </div>
          
          <div className="text-white/80 text-sm">
            <div className="flex justify-between items-center mb-2">
              <p className="font-medium">📊 Debug Logs:</p>
              {onExportLogs && (
                <button
                  onClick={onExportLogs}
                  className="text-blue-400 hover:text-blue-300 text-xs flex items-center space-x-1"
                >
                  <Download className="w-3 h-3" />
                  <span>Export</span>
                </button>
              )}
            </div>
            <div className="bg-black/30 rounded p-3 text-xs font-mono max-h-40 overflow-y-auto">
              {debugLogs.length > 0 ? (
                debugLogs.slice(-8).map((log, i) => (
                  <div key={i} className="text-white/60 mb-1">{log}</div>
                ))
              ) : (
                <div className="text-white/40">No logs yet...</div>
              )}
            </div>
          </div>

          <div className="text-white/80 text-sm">
            <p className="mb-2 font-medium">🎭 AR Engine:</p>
            <div className="text-xs text-white/60 bg-black/20 p-3 rounded">
              <p>Engine: Snap Camera Kit</p>
              <p>Features: AR Lenses, Recording, Effects</p>
              <p>Optimization: {isAndroid ? 'Android MP4' : 'Standard WebM/MP4'}</p>
            </div>
          </div>

          <div className="text-white/80 text-sm">
            <p className="mb-2 font-medium">💡 Tips:</p>
            <div className="text-xs text-white/60 space-y-1">
              <p>• Use good lighting for better AR tracking</p>
              <p>• Keep device steady during recording</p>
              <p>• {isAndroid ? 'Your videos are optimized for social sharing' : 'Consider using Android for optimized sharing'}</p>
              <p>• Close other apps for better performance</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  */
};