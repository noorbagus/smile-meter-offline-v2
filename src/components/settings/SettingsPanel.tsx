// src/components/settings/SettingsPanel.tsx - Complete with Push2Web
import React, { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { detectAndroid } from '../../utils/androidRecorderFix';
import { LoginKit } from '../LoginKit';

interface CameraCapability {
  front: { width: number; height: number; fps: number } | null;
  back: { width: number; height: number; fps: number } | null;
  supportedFormats: string[];
  constraintsSupported: number;
}

interface DisplayInfo {
  canvas: { width: number; height: number; scale: number } | null;
  viewport: { width: number; height: number };
  container: { width: number; height: number } | null;
}

interface ARInfo {
  cameraInput: { width: number; height: number; fps: number } | null;
  arProcessing: { width: number; height: number } | null;
  displayOutput: { width: number; height: number };
  actualFPS: number | null;
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  debugLogs: string[];
  onExportLogs?: () => void;
  currentStream?: MediaStream | null;
  canvas?: HTMLCanvasElement | null;
  containerRef?: React.RefObject<HTMLDivElement>;
  subscribePush2Web: (token: string) => Promise<boolean>;
  getPush2WebStatus: () => {
    available: boolean;
    subscribed: boolean;
    session: boolean;
    repository: boolean;
  };
  addLog: (message: string) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  debugLogs,
  onExportLogs,
  currentStream,
  canvas,
  containerRef,
  subscribePush2Web,
  getPush2WebStatus,
  addLog
}) => {
  const [cameraCapability, setCameraCapability] = useState<CameraCapability>({
    front: null,
    back: null,
    supportedFormats: [],
    constraintsSupported: 0
  });
  const [displayInfo, setDisplayInfo] = useState<DisplayInfo>({
    canvas: null,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    container: null
  });
  const [arInfo, setARInfo] = useState<ARInfo>({
    cameraInput: null,
    arProcessing: null,
    displayOutput: { width: window.innerWidth, height: window.innerHeight },
    actualFPS: null
  });
  
  const [showPush2WebLogin, setShowPush2WebLogin] = useState(false);
  const [push2WebStatus, setPush2WebStatus] = useState(getPush2WebStatus());

  // Test camera capabilities
  useEffect(() => {
    const testCameraCapabilities = async () => {
      try {
        const constraints = navigator.mediaDevices?.getSupportedConstraints?.() || {};
        const constraintsCount = Object.keys(constraints).length;

        // Test front camera
        let frontCap = null;
        try {
          const frontStream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: 'user',
              width: { ideal: 3840 },
              height: { ideal: 2160 }
            }
          });
          const frontTrack = frontStream.getVideoTracks()[0];
          const frontSettings = frontTrack.getSettings();
          frontCap = {
            width: frontSettings.width || 0,
            height: frontSettings.height || 0,
            fps: frontSettings.frameRate || 0
          };
          frontStream.getTracks().forEach(track => track.stop());
        } catch (e) {
          // Front camera not available
        }

        // Test back camera
        let backCap = null;
        try {
          const backStream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: 'environment',
              width: { ideal: 3840 },
              height: { ideal: 2160 }
            }
          });
          const backTrack = backStream.getVideoTracks()[0];
          const backSettings = backTrack.getSettings();
          backCap = {
            width: backSettings.width || 0,
            height: backSettings.height || 0,
            fps: backSettings.frameRate || 0
          };
          backStream.getTracks().forEach(track => track.stop());
        } catch (e) {
          // Back camera not available
        }

        // Test supported formats
        const formats = [
          'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
          'video/mp4;codecs=h264,aac',
          'video/mp4',
          'video/webm;codecs=vp9,opus',
          'video/webm'
        ];
        const supportedFormats = formats.filter(format => 
          typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(format)
        );

        setCameraCapability({
          front: frontCap,
          back: backCap,
          supportedFormats,
          constraintsSupported: constraintsCount
        });
      } catch (error) {
        console.warn('Camera capability test failed:', error);
      }
    };

    if (isOpen) {
      testCameraCapabilities();
      setPush2WebStatus(getPush2WebStatus());
    }
  }, [isOpen, getPush2WebStatus]);

  // Update display info
  useEffect(() => {
    const updateDisplayInfo = () => {
      let canvasInfo = null;
      let containerInfo = null;

      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        canvasInfo = {
          width: canvas.width,
          height: canvas.height,
          scale: rect.width / canvas.width
        };
      }

      if (containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect();
        containerInfo = {
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      }

      setDisplayInfo({
        canvas: canvasInfo,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        container: containerInfo
      });
    };

    if (isOpen) {
      updateDisplayInfo();
      const interval = setInterval(updateDisplayInfo, 1000);
      return () => clearInterval(interval);
    }
  }, [isOpen, canvas, containerRef]);

  // Update AR info
  useEffect(() => {
    const updateARInfo = () => {
      let cameraInput = null;
      let arProcessing = null;
      let actualFPS = null;

      if (currentStream) {
        const videoTrack = currentStream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          cameraInput = {
            width: settings.width || 0,
            height: settings.height || 0,
            fps: settings.frameRate || 0
          };
          actualFPS = settings.frameRate || null;
        }
      }

      if (canvas) {
        arProcessing = {
          width: canvas.width,
          height: canvas.height
        };
      }

      setARInfo({
        cameraInput,
        arProcessing,
        displayOutput: { width: window.innerWidth, height: window.innerHeight },
        actualFPS
      });
    };

    if (isOpen) {
      updateARInfo();
      const interval = setInterval(updateARInfo, 1000);
      return () => clearInterval(interval);
    }
  }, [isOpen, currentStream, canvas]);

  if (!isOpen) return null;

  const isAndroid = detectAndroid();

  return (
    <>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 p-6">
        <div className="bg-white/10 rounded-lg p-6 max-w-md mx-auto mt-20 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white text-lg font-semibold">Settings & Debug</h3>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-4">
            {/* Push2Web (Development) */}
            <div className="text-white/80 text-sm">
              <p className="mb-2 font-medium flex items-center gap-1">
                <span className="text-purple-400">🎭</span> Push2Web (Development):
              </p>
              <div className="text-xs text-white/60 bg-black/20 p-3 rounded space-y-2">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={push2WebStatus.subscribed ? 'text-green-400' : 'text-gray-400'}>
                    {push2WebStatus.subscribed ? '✅ Connected' : '❌ Not Connected'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Session:</span>
                  <span className={push2WebStatus.session ? 'text-green-400' : 'text-gray-400'}>
                    {push2WebStatus.session ? '✅ Ready' : '❌ No Session'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Repository:</span>
                  <span className={push2WebStatus.repository ? 'text-green-400' : 'text-gray-400'}>
                    {push2WebStatus.repository ? '✅ Loaded' : '❌ Not Loaded'}
                  </span>
                </div>
                
                {!push2WebStatus.subscribed ? (
                  <button
                    onClick={() => setShowPush2WebLogin(true)}
                    className="w-full mt-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white text-xs font-medium transition-colors"
                  >
                    🔗 Connect Push2Web
                  </button>
                ) : (
                  <div className="mt-2 p-2 bg-green-500/20 rounded text-green-300 text-xs">
                    ✅ Ready to receive lenses from Lens Studio
                  </div>
                )}
              </div>
            </div>

            {/* Recording Format */}
            <div className="text-white/80 text-sm">
              <p className="mb-2 font-medium">🎬 Recording Format:</p>
              <p className="text-xs text-white/60 bg-black/20 p-3 rounded">
                {isAndroid ? 
                  '📱 Android: MP4 (H.264) - Optimized for Instagram/TikTok' : 
                  '💻 Standard: MP4/WebM - Universal compatibility'
                }
              </p>
            </div>

            {/* Monitor Capability */}
            <div className="text-white/80 text-sm">
              <p className="mb-2 font-medium flex items-center gap-1">
                <span className="text-blue-400">🖥️</span> Monitor Capability:
              </p>
              <div className="text-xs text-white/60 bg-black/20 p-3 rounded space-y-1">
                <p>Physical: {window.screen.width}x{window.screen.height} (DPR: {window.devicePixelRatio})</p>
                <p>Actual Pixels: {Math.round(window.screen.width * window.devicePixelRatio)}x{Math.round(window.screen.height * window.devicePixelRatio)}</p>
                <p>Color Depth: {window.screen.colorDepth}-bit</p>
                <p>Available: {window.screen.availWidth}x{window.screen.availHeight}</p>
              </div>
            </div>

            {/* Camera Capability - REAL DATA */}
            <div className="text-white/80 text-sm">
              <p className="mb-2 font-medium flex items-center gap-1">
                <span className="text-green-400">📹</span> Camera Capability:
              </p>
              <div className="text-xs text-white/60 bg-black/20 p-3 rounded space-y-1">
                <p>Front: {cameraCapability.front ? 
                  `${cameraCapability.front.width}x${cameraCapability.front.height}@${cameraCapability.front.fps}fps` : 
                  'Not available'
                }</p>
                <p>Back: {cameraCapability.back ? 
                  `${cameraCapability.back.width}x${cameraCapability.back.height}@${cameraCapability.back.fps}fps` : 
                  'Not available'
                }</p>
                <p>Constraints: {cameraCapability.constraintsSupported} supported</p>
                <p>Formats: {cameraCapability.supportedFormats.length > 0 ? 
                  cameraCapability.supportedFormats.map(f => f.split(';')[0].split('/')[1]).join(', ') : 
                  'Testing...'
                }</p>
              </div>
            </div>

            {/* Current Display - REAL DATA */}
            <div className="text-white/80 text-sm">
              <p className="mb-2 font-medium flex items-center gap-1">
                <span className="text-purple-400">📱</span> Current Display:
              </p>
              <div className="text-xs text-white/60 bg-black/20 p-3 rounded space-y-1">
                <p>Viewport: {displayInfo.viewport.width}x{displayInfo.viewport.height}</p>
                <p>Canvas: {displayInfo.canvas ? 
                  `${displayInfo.canvas.width}x${displayInfo.canvas.height} (scale: ${displayInfo.canvas.scale.toFixed(2)})` : 
                  'Not initialized'
                }</p>
                <p>Container: {displayInfo.container ? 
                  `${displayInfo.container.width}x${displayInfo.container.height}px` : 
                  'Not measured'
                }</p>
                <p>Orientation: {window.innerHeight > window.innerWidth ? 'Portrait' : 'Landscape'}</p>
              </div>
            </div>

            {/* Current AR - REAL DATA */}
            <div className="text-white/80 text-sm">
              <p className="mb-2 font-medium flex items-center gap-1">
                <span className="text-orange-400">🎭</span> Current AR:
              </p>
              <div className="text-xs text-white/60 bg-black/20 p-3 rounded space-y-1">
                <p>Camera Input: {arInfo.cameraInput ? 
                  `${arInfo.cameraInput.width}x${arInfo.cameraInput.height}@${arInfo.cameraInput.fps}fps` : 
                  'No stream'
                }</p>
                <p>AR Processing: {arInfo.arProcessing ? 
                  `${arInfo.arProcessing.width}x${arInfo.arProcessing.height}` : 
                  'Not initialized'
                }</p>
                <p>Display Output: {arInfo.displayOutput.width}x{arInfo.displayOutput.height}</p>
                <p>Processing FPS: {arInfo.actualFPS || 'Unknown'}</p>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="text-white/80 text-sm">
              <p className="mb-2 font-medium flex items-center gap-1">
                <span className="text-yellow-400">⚡</span> Performance:
              </p>
              <div className="text-xs text-white/60 bg-black/20 p-3 rounded space-y-1">
                <p>Memory: {(performance as any).memory ? 
                  `${Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)}MB used` : 
                  'Not available'
                }</p>
                <p>Connection: {(navigator as any).connection ? 
                  `${(navigator as any).connection.effectiveType} (${(navigator as any).connection.downlink}Mbps)` : 
                  'Unknown'
                }</p>
                <p>Hardware: {navigator.hardwareConcurrency || 'Unknown'} cores</p>
                <p>Touch: {navigator.maxTouchPoints || 0} points</p>
              </div>
            </div>

            {/* Device Info */}
            <div className="text-white/80 text-sm">
              <p className="mb-2 font-medium">📊 System Info:</p>
              <div className="text-xs text-white/60 bg-black/20 p-3 rounded space-y-1">
                <p>Platform: {isAndroid ? 'Android' : 'Other'} • {location.protocol} • {location.hostname}</p>
                <p>User Agent: {navigator.userAgent.substring(0, 60)}...</p>
                <p>Language: {navigator.language} • Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
              </div>
            </div>
            
            {/* Debug Logs */}
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

            {/* AR Engine */}
            <div className="text-white/80 text-sm">
              <p className="mb-2 font-medium">🎭 AR Engine:</p>
              <div className="text-xs text-white/60 bg-black/20 p-3 rounded">
                <p>Engine: Snap Camera Kit</p>
                <p>Features: AR Lenses, Recording, Effects</p>
                <p>Optimization: {isAndroid ? 'Android MP4' : 'Standard WebM/MP4'}</p>
                <p>Resolution: Portrait optimized (9:16)</p>
              </div>
            </div>

            {/* Tips */}
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

      {/* Push2Web Login Modal */}
      {showPush2WebLogin && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white text-lg font-semibold">Connect Push2Web</h3>
              <button
                onClick={() => setShowPush2WebLogin(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="text-white/80 text-sm mb-4">
              <p className="mb-2">Login with Snapchat to receive lenses from Lens Studio:</p>
              <ul className="text-xs text-white/60 space-y-1">
                <li>• Open Lens Studio on your computer</li>
                <li>• Create or open a lens project</li>
                <li>• Use same Snapchat account as below</li>
                <li>• Click "Send to Camera Kit"</li>
                <li>• Lens will appear in this app</li>
              </ul>
            </div>
            
            <LoginKit
              onLogin={async (token) => {
                const success = await subscribePush2Web(token);
                if (success) {
                  setPush2WebStatus(getPush2WebStatus());
                  setShowPush2WebLogin(false);
                  addLog('🎭 Push2Web connected successfully');
                } else {
                  addLog('❌ Push2Web subscription failed');
                }
              }}
              onError={(error) => {
                addLog(`❌ Push2Web login failed: ${error}`);
              }}
              addLog={addLog}
            />
          </div>
        </div>
      )}
    </>
  );
};