// src/components/camera/CameraFeed.tsx - Clean camera feed without overlays
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
  cameraState,
  recordingState,
  isFlipped
}) => {
  return (
    <div className="flex-1 relative overflow-hidden">
      {/* Background gradient (fallback) */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900"></div>
      
      {/* Camera Kit container - clean without overlays */}
      <div 
        ref={cameraFeedRef}
        className={`absolute inset-0 transition-transform duration-300 ${isFlipped ? 'scale-x-[-1]' : ''}`}
      >
        {/* Camera Kit will inject canvas here - no placeholder content */}
      </div>

      {/* ALL OVERLAYS REMOVED:
      - Recording indicator (REC dot)
      - Placeholder camera icon + text
      - Status indicators  
      - Android MP4 indicators
      */}
    </div>
  );
};