// src/components/camera/CameraFeed.tsx
import React from 'react';
import { Camera } from 'lucide-react';
import { detectAndroid } from '../../utils/androidRecorderFix';
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
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900"></div>
      
      <div 
        ref={cameraFeedRef}
        className={`absolute inset-0 transition-transform duration-300 ${isFlipped ? 'scale-x-[-1]' : ''}`}
      >
        <div className="w-full h-full bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-blue-500/20 flex items-center justify-center">
          <div className="text-white/50 text-center">
            <Camera className="w-16 h-16 mx-auto mb-4" />
            <p>Camera Feed {cameraState === 'ready' ? '(Live)' : '(Loading...)'}</p>
            <p className="text-sm mt-2">State: {cameraState}</p>
            {detectAndroid() && cameraState === 'ready' && (
              <p className="text-xs mt-1 text-green-400">📱 Android MP4 Ready</p>
            )}
          </div>
        </div>
      </div>

      {/* Recording indicator */}
      {recordingState === 'recording' && (
        <div className="absolute top-20 left-4 flex items-center space-x-2 bg-red-500/80 backdrop-blur-md rounded-full px-3 py-2 z-10">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span className="text-white text-sm font-medium">
            REC {detectAndroid() ? '(MP4)' : ''}
          </span>
        </div>
      )}
    </div>
  );
};