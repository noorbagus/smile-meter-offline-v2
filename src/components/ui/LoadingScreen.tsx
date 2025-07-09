// src/components/ui/LoadingScreen.tsx
import React from 'react';
import { detectAndroid } from '../../utils/androidRecorderFix';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = "Initializing Web AR Netramaya...",
  subMessage
}) => {
  const defaultSubMessage = detectAndroid() 
    ? 'Android MP4 optimization enabled' 
    : 'Optimized loading in progress';

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-30">
      <div className="text-center px-6">
        <div className="relative w-16 h-16 mx-auto mb-6">
          <div className="w-16 h-16 border-4 border-white/20 rounded-full"></div>
          <div className="absolute inset-0 w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
        
        <div className="text-white text-lg font-medium mb-2">
          {message}
        </div>
        
        <div className="text-white/60 text-sm">
          {subMessage || defaultSubMessage}
        </div>
      </div>
    </div>
  );
};