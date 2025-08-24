// src/components/camera/CameraFeed.tsx - Responsive AR container
import React from 'react';
import type { CameraState, RecordingState } from '../../hooks';

interface CameraFeedProps {
  cameraFeedRef: React.RefObject<HTMLDivElement>;
  cameraState: CameraState;
  recordingState: RecordingState;
  isFlipped: boolean;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({
  cameraFeedRef
}) => {
  return (
    <div className="flex-1 relative overflow-hidden bg-black">
      {/* Fallback gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900" />
      
      {/* Camera Kit container - responsive */}
      <div 
        ref={cameraFeedRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: '#000',
          touchAction: 'manipulation'
        }}
      >
        {/* Canvas injected here by Camera Kit */}
      </div>
    </div>
  );
};