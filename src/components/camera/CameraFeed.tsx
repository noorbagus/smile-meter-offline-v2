// src/components/camera/CameraFeed.tsx - MAX QUALITY portrait container
import React from 'react';
import type { CameraState, RecordingState } from '../../hooks';

interface CameraFeedProps {
  cameraFeedRef: React.RefObject<HTMLDivElement>;
  cameraState: CameraState;
  recordingState: RecordingState;
  isFlipped: boolean;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({
  cameraFeedRef,
  isFlipped
}) => {
  return (
    <div className="flex-1 relative overflow-hidden bg-black">
      {/* Background gradient fallback */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900" />
      
      {/* MAX QUALITY Camera Kit container - optimized for 1440x2560 portrait */}
      <div 
        ref={cameraFeedRef}
        className={`
          absolute inset-0 
          flex items-center justify-center
          transition-transform duration-300
          ${isFlipped ? 'scale-x-[-1]' : ''}
        `}
        style={{
          // MAX QUALITY container - full viewport coverage
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: '#000',
          // Touch optimization untuk max quality
          touchAction: 'manipulation',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none'
        }}
      >
        {/* Camera Kit canvas akan diinjeksi di sini dengan resolution:
            - MAX: 1440x2560 (rotated dari hardware 2560x1440)
            - SCALED: 1080x1920 (75% scaling untuk device lemah)
        */}
      </div>
      
      {/* Quality indicator overlay (dev mode) */}
      {import.meta.env.MODE === 'development' && (
        <div className="absolute top-16 left-4 z-20">
          <div className="bg-black/50 backdrop-blur-sm rounded px-2 py-1 text-xs font-mono text-white/70">
            Portrait Canvas: Hardware Landscape → Software Portrait
          </div>
        </div>
      )}
    </div>
  );
};