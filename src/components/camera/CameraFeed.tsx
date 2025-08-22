// src/components/camera/CameraFeed.tsx - 4K responsive container
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
      
      {/* 4K Camera Kit container with proper scaling */}
      <div 
        ref={cameraFeedRef}
        className={`
          absolute inset-0 
          flex items-center justify-center
          transition-transform duration-300
          ${isFlipped ? 'scale-x-[-1]' : ''}
        `}
        style={{
          // Ensure proper 4K scaling
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: '#000'
        }}
      >
        {/* Camera Kit canvas will be injected here */}
      </div>
    </div>
  );
};