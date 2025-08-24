// src/components/ui/FullscreenButton.tsx
import React from 'react';
import { Maximize, X } from 'lucide-react';

interface FullscreenButtonProps {
  isFullscreen: boolean;
  onEnterFullscreen: () => void;
  onExitFullscreen: () => void;
  showExitButton?: boolean;
  className?: string;
}

export const FullscreenButton: React.FC<FullscreenButtonProps> = ({
  isFullscreen,
  onEnterFullscreen,
  onExitFullscreen,
  showExitButton = false,
  className = ''
}) => {
  if (isFullscreen) {
    return showExitButton ? (
      <button
        onClick={onExitFullscreen}
        className={`exit-fullscreen-button ${className}`}
        aria-label="Exit Fullscreen"
      >
        <X className="w-5 h-5" />
      </button>
    ) : null;
  }

  return (
    <button
      onClick={onEnterFullscreen}
      className={`fullscreen-button ${className}`}
      aria-label="Enter Fullscreen"
    >
      <Maximize className="w-6 h-6" />
    </button>
  );
};