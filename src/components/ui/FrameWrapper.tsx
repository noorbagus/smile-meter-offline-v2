// src/components/ui/FrameWrapper.tsx - Updated with size control
import React from 'react';
import { useFrameSize } from '../../hooks';

interface FrameWrapperProps {
  children: React.ReactNode;
  isFullscreen: boolean;
}

export const FrameWrapper: React.FC<FrameWrapperProps> = ({ 
  children, 
  isFullscreen 
}) => {
  const { currentDimensions } = useFrameSize();

  if (!isFullscreen) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      {/* Frame with adaptive sizing */}
      <div 
        className="relative bg-black border-8 border-gray-900 shadow-2xl overflow-hidden"
        style={{
          width: currentDimensions.width,
          height: currentDimensions.height,
          aspectRatio: '9/16',
          maxWidth: currentDimensions.maxWidth,
          maxHeight: currentDimensions.maxHeight,
          borderRadius: '24px'
        }}
      >
        {/* Content area */}
        <div className="w-full h-full overflow-hidden bg-black">
          {children}
        </div>
      </div>
      
      {/* Size indicator - optional */}
      <div className="absolute bottom-8 left-8 text-white/60 text-sm">
        Frame: {currentDimensions.label}
      </div>
    </div>
  );
};