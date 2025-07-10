// src/components/ui/RenderingModal.tsx
import React from 'react';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

interface RenderingModalProps {
  isOpen: boolean;
  progress: number;
  message: string;
  onCancel?: () => void;
  isComplete?: boolean;
  hasError?: boolean;
}

export const RenderingModal: React.FC<RenderingModalProps> = ({
  isOpen,
  progress,
  message,
  onCancel,
  isComplete = false,
  hasError = false
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 max-w-sm w-full mx-auto text-center">
        {/* Icon */}
        <div className="mb-4">
          {hasError ? (
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
          ) : isComplete ? (
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
          ) : (
            <Loader2 className="w-12 h-12 text-blue-400 mx-auto mb-2 animate-spin" />
          )}
          
          <h3 className="text-white text-lg font-semibold">
            {hasError ? 'Error' : isComplete ? 'Complete!' : 'Processing Video'}
          </h3>
        </div>
        
        {/* Progress Bar */}
        {!hasError && (
          <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden mb-4">
            <div 
              className={`absolute top-0 left-0 h-full transition-all duration-300 ${
                isComplete ? 'bg-green-500' : 'bg-gradient-to-r from-blue-500 to-purple-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        
        {/* Message */}
        <p className="text-white/80 text-sm mb-2">{message}</p>
        
        {/* Progress % */}
        {!hasError && !isComplete && (
          <p className="text-white/60 text-xs mb-4">{progress}%</p>
        )}
        
        {/* Info Box */}
        <div className="text-xs text-white/60 bg-black/20 p-3 rounded mb-4">
          {hasError ? (
            <p>Something went wrong. Please try again.</p>
          ) : isComplete ? (
            <p>✅ Video optimized with MP4Box metadata fix for Instagram!</p>
          ) : (
            <p>Fixing MP4 duration metadata with MP4Box for social media compatibility.</p>
          )}
        </div>
        
        {/* Cancel Button */}
        {onCancel && !isComplete && (
          <button
            onClick={onCancel}
            className="text-white/60 hover:text-white text-sm transition-colors"
          >
            {hasError ? 'Close' : 'Cancel'}
          </button>
        )}
      </div>
    </div>
  );
};