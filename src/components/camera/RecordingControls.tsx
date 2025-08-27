// src/components/camera/RecordingControls.tsx - Show only record button
import React from 'react';
import { RecordButton } from '../ui';
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
  formatTime,
  disabled = false
}) => {
  return (
    <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/50 to-transparent z-10">
      <div className="flex items-center justify-center">
        <RecordButton
          recordingState={recordingState}
          recordingTime={recordingTime}
          onClick={onToggleRecording}
          disabled={disabled}
          formatTime={formatTime}
        />
      </div>
    </div>
  );
};