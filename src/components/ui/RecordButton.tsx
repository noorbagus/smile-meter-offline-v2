// src/components/ui/RecordButton.tsx
import React from 'react';
import { Circle, Square } from 'lucide-react';
import type { RecordingState } from '../../hooks';

interface RecordButtonProps {
  recordingState: RecordingState;
  recordingTime: number;
  onClick: () => void;
  disabled?: boolean;
  formatTime: (seconds: number) => string;
}

export const RecordButton: React.FC<RecordButtonProps> = ({
  recordingState,
  recordingTime,
  onClick,
  disabled = false,
  formatTime
}) => {
  return (
    <div className="relative">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={recordingState === 'recording' ? 'Stop recording' : 'Start recording'}
        className={`
          w-20 h-20 
          rounded-full 
          border-4 
          border-white 
          flex 
          items-center 
          justify-center 
          transition-all 
          duration-200 
          active:scale-95
          disabled:opacity-50
          disabled:cursor-not-allowed
          ${recordingState === 'recording' 
            ? 'bg-red-500 hover:bg-red-600' 
            : 'bg-white/20 hover:bg-white/30 backdrop-blur-md'
          }
        `}
      >
        {recordingState === 'recording' ? (
          <Square className="w-8 h-8 text-white fill-white" />
        ) : recordingState === 'processing' ? (
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Circle className="w-12 h-12 text-red-500 fill-red-500" />
        )}
      </button>
      
      {recordingState === 'recording' && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
          <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
            {formatTime(recordingTime)}
          </div>
        </div>
      )}
    </div>
  );
};