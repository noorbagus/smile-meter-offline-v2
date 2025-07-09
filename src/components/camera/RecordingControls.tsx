// src/components/camera/RecordingControls.tsx
import React from 'react';
import { Video, RotateCcw } from 'lucide-react';
import { ControlButton, RecordButton } from '../ui';
import type { RecordingState } from '../../hooks';

interface RecordingControlsProps {
  recordingState: RecordingState;
  recordingTime: number;
  onToggleRecording: () => void;
  onGallery: () => void;
  onSwitchCamera: () => void;
  formatTime: (seconds: number) => string;
  disabled?: boolean;
}

export const RecordingControls: React.FC<RecordingControlsProps> = ({
  recordingState,
  recordingTime,
  onToggleRecording,
  onGallery,
  onSwitchCamera,
  formatTime,
  disabled = false
}) => {
  return (
    <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/50 to-transparent z-10">
      <div className="flex items-center justify-between">
        <ControlButton 
          icon={Video} 
          onClick={onGallery} 
          label="Gallery"
          size="lg"
          disabled={disabled}
        />
        
        <RecordButton
          recordingState={recordingState}
          recordingTime={recordingTime}
          onClick={onToggleRecording}
          disabled={disabled}
          formatTime={formatTime}
        />
        
        <ControlButton 
          icon={RotateCcw} 
          onClick={onSwitchCamera}
          label="Switch Camera"
          size="lg"
          disabled={disabled}
        />
      </div>
    </div>
  );
};