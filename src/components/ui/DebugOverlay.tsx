// src/components/ui/DebugOverlay.tsx
import React, { useState, useEffect } from 'react';

interface DebugInfo {
  camera: {
    width: number;
    height: number;
    fps: number;
    facingMode: string;
  };
  canvas: {
    width: number;
    height: number;
  };
  display: {
    width: number;
    height: number;
    dpr: number;
  };
  viewport: {
    width: number;
    height: number;
  };
  rotation: {
    detected: boolean;
    applied: string;
    orientation: string;
  };
}

interface DebugOverlayProps {
  stream: MediaStream | null;
  canvas: HTMLCanvasElement | null;
  isVisible?: boolean;
  onToggle?: () => void;
}

export const DebugOverlay: React.FC<DebugOverlayProps> = ({
  stream,
  canvas,
  isVisible = false,
  onToggle
}) => {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  useEffect(() => {
    if (!stream || !canvas) return;

    const updateDebugInfo = () => {
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack?.getSettings();
      
      const needsRotation = /brio|logitech/i.test(navigator.userAgent) || 
                           window.location.search.includes('rotate=true');
      
      const isPortrait = window.innerHeight > window.innerWidth;
      
      const info: DebugInfo = {
        camera: {
          width: settings?.width || 0,
          height: settings?.height || 0,
          fps: settings?.frameRate || 0,
          facingMode: settings?.facingMode || 'unknown'
        },
        canvas: {
          width: canvas.width,
          height: canvas.height
        },
        display: {
          width: window.screen.width,
          height: window.screen.height,
          dpr: window.devicePixelRatio || 1
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        rotation: {
          detected: needsRotation,
          applied: needsRotation ? 'rotate(90deg)' : 'none',
          orientation: isPortrait ? 'portrait' : 'landscape'
        }
      };
      
      setDebugInfo(info);
    };

    updateDebugInfo();
    const interval = setInterval(updateDebugInfo, 1000);
    
    return () => clearInterval(interval);
  }, [stream, canvas]);

  if (!isVisible || !debugInfo) return null;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full text-white text-xs font-mono border border-white/20"
      >
        DBG
      </button>

      {/* Debug panel */}
      <div className="fixed top-4 right-4 z-50 bg-black/80 backdrop-blur-md text-white text-xs font-mono p-4 rounded-lg border border-white/20 max-w-xs">
        <div className="space-y-3">
          {/* Camera info */}
          <div>
            <div className="text-green-400 font-bold mb-1">📹 CAMERA</div>
            <div>Resolution: {debugInfo.camera.width}x{debugInfo.camera.height}</div>
            <div>FPS: {debugInfo.camera.fps}</div>
            <div>Facing: {debugInfo.camera.facingMode}</div>
          </div>

          {/* Canvas info */}
          <div>
            <div className="text-blue-400 font-bold mb-1">🎨 CANVAS</div>
            <div>Size: {debugInfo.canvas.width}x{debugInfo.canvas.height}</div>
          </div>

          {/* Display info */}
          <div>
            <div className="text-purple-400 font-bold mb-1">🖥️ DISPLAY</div>
            <div>Screen: {debugInfo.display.width}x{debugInfo.display.height}</div>
            <div>DPR: {debugInfo.display.dpr}</div>
            <div>Physical: {Math.round(debugInfo.display.width * debugInfo.display.dpr)}x{Math.round(debugInfo.display.height * debugInfo.display.dpr)}</div>
          </div>

          {/* Viewport info */}
          <div>
            <div className="text-yellow-400 font-bold mb-1">📱 VIEWPORT</div>
            <div>Size: {debugInfo.viewport.width}x{debugInfo.viewport.height}</div>
            <div>Orientation: {debugInfo.rotation.orientation}</div>
          </div>

          {/* Rotation info */}
          <div>
            <div className="text-red-400 font-bold mb-1">🔄 ROTATION</div>
            <div>Detected: {debugInfo.rotation.detected ? 'YES' : 'NO'}</div>
            <div>Applied: {debugInfo.rotation.applied}</div>
            {!debugInfo.rotation.detected && (
              <div className="text-orange-400 mt-1">
                Add ?rotate=true to URL for manual rotation
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};