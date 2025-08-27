// src/components/camera/CameraFeed.tsx - Responsive AR container with Firefox orientation fix
import React from 'react';
import type { CameraState, RecordingState } from '../../hooks';
import type { CameraOrientationFix } from '../../utils/browserDetection';

interface CameraFeedProps {
  cameraFeedRef: React.RefObject<HTMLDivElement>;
  cameraState: CameraState;
  recordingState: RecordingState;
  isFlipped: boolean;
  cameraOrientationFix?: CameraOrientationFix | null;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({
  cameraFeedRef,
  cameraOrientationFix
}) => {
  // Determine CSS class for Firefox orientation fix
  const getOrientationClass = (): string => {
    if (!cameraOrientationFix || cameraOrientationFix.type === 'normal') {
      return '';
    }
    
    return cameraOrientationFix.cssClass;
  };

  const orientationClass = getOrientationClass();

  return (
    <div className="flex-1 relative overflow-hidden bg-black">
      {/* Fallback gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900" />
      
      {/* Camera Kit container - responsive with Firefox orientation fix */}
      <div 
        ref={cameraFeedRef}
        className={`absolute inset-0 flex items-center justify-center ${orientationClass}`}
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

      {/* Debug info for Firefox fixes */}
      {cameraOrientationFix && cameraOrientationFix.type !== 'normal' && (
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs p-2 rounded z-10">
          🦊 Firefox Fix: {cameraOrientationFix.description}
        </div>
      )}
    </div>
  );
};