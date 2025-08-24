// src/components/camera/CameraControls.tsx - Fullscreen compatible, flip button removed
import React from 'react';
import { Settings } from 'lucide-react';
import { ControlButton } from '../ui';
import { detectAndroid } from '../../utils/androidRecorderFix';

interface CameraControlsProps {
  onSettings: () => void;
  onFlip: () => void;
  isFullscreen?: boolean;
}

export const CameraControls: React.FC<CameraControlsProps> = ({ 
  onSettings, 
  isFullscreen = false 
}) => {
  return (
    <>
      {/* Top controls - HIDDEN in fullscreen, visible in normal mode */}
      <div 
        className={`absolute top-0 inset-x-0 spacing-md gradient-top z-10 transition-opacity duration-300 ${
          isFullscreen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div className="flex justify-between items-center">
          <ControlButton 
            icon={Settings} 
            onClick={onSettings} 
            label="Settings"
            size="sm"
          />
          
          <div className="text-white text-center">
            {detectAndroid() && (
              <div className="text-responsive-xs text-green-400">📱 Android Mode</div>
            )}
          </div>
          
          <div className="w-10" /> {/* Spacer instead of flip button */}
        </div>
      </div>

      {/* Attribution - Always visible, positioned to avoid fullscreen buttons */}
      <div 
        className={`attribution-bottom z-20 transition-all duration-300 ${
          isFullscreen ? 'bottom-4 opacity-70' : 'opacity-80'
        }`}
      >
        <img 
          src="images/attribution.png" 
          alt="Attribution" 
          className="h-[2vh] min-h-[12px] max-h-[16px] opacity-80"
        />
      </div>
    </>
  );
};