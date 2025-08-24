// src/components/camera/CameraControls.tsx - Responsive with hidden controls
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
      <div className="absolute top-0 inset-x-0 spacing-md gradient-top z-10" style={{ display: 'none' }}>
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
          
          <ControlButton 
            icon={FlipHorizontal} 
            onClick={() => {}}
            label="Flip (disabled)"
            disabled={true}
            className="opacity-30"
            size="sm"
          />
        </div>
      </div>

      {/* Attribution - responsive positioning matching Lens Studio */}
      <div className="attribution-bottom z-20">
        <img 
          src="images/attribution.png" 
          alt="Attribution" 
          className="h-[2vh] min-h-[12px] max-h-[16px] opacity-80"
        />
      </div>
    </>
  );
};