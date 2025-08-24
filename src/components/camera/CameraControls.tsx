// src/components/camera/CameraControls.tsx - Hidden buttons, bottom attribution
import React from 'react';
import { Settings, FlipHorizontal } from 'lucide-react';
import { ControlButton } from '../ui';
import { detectAndroid } from '../../utils/androidRecorderFix';

interface CameraControlsProps {
  onSettings: () => void;
  onFlip: () => void;
}

export const CameraControls: React.FC<CameraControlsProps> = ({ onSettings }) => {
  return (
    <>
      {/* Top controls - HIDDEN */}
      <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/50 to-transparent z-10" style={{ display: 'none' }}>
        <div className="flex justify-between items-center">
          <ControlButton 
            icon={Settings} 
            onClick={onSettings} 
            label="Settings"
          />
          
          <div className="text-white text-center">
            {detectAndroid() && (
              <div className="text-xs text-green-400 mt-1">📱 Android Mode</div>
            )}
          </div>
          
          {/* Flip button disabled - Camera Kit handles orientation */}
          <ControlButton 
            icon={FlipHorizontal} 
            onClick={() => {}} // Empty function - disabled
            label="Flip (disabled)"
            disabled={true}
            className="opacity-30"
          />
        </div>
      </div>

      {/* Attribution moved to bottom center - small, 1% from bottom */}
      <div className="absolute bottom-[1vh] left-1/2 transform -translate-x-1/2 z-20">
        <img 
          src="images/attribution.png" 
          alt="Attribution" 
          className="h-3 opacity-80"
        />
      </div>
    </>
  );
};