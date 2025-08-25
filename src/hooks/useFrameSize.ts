// src/hooks/useFrameSize.ts
import { useState, useEffect } from 'react';

export type FrameSize = 'small' | 'medium' | 'large' | 'max';

export interface FrameDimensions {
  width: string;
  height: string;
  maxWidth: string;
  maxHeight: string;
  label: string;
  percentage: string;
}

export const useFrameSize = () => {
  const [frameSize, setFrameSize] = useState<FrameSize>('medium');

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ar-frame-size') as FrameSize;
    if (saved && ['small', 'medium', 'large', 'max'].includes(saved)) {
      setFrameSize(saved);
    }
  }, []);

  // Save to localStorage
  const updateFrameSize = (size: FrameSize) => {
    setFrameSize(size);
    localStorage.setItem('ar-frame-size', size);
  };

  const getFrameDimensions = (size: FrameSize): FrameDimensions => {
    const configs = {
      small: {
        width: 'min(100vh * 9/16, 50vw)',
        height: 'min(100vw * 16/9, 50vh)',
        maxWidth: '450px',   // 50% of 900
        maxHeight: '800px',  // 50% of 1600
        label: 'Small (50%)',
        percentage: '50%'
      },
      medium: {
        width: 'min(100vh * 9/16, 65vw)',
        height: 'min(100vw * 16/9, 65vh)',
        maxWidth: '585px',   // 65% of 900
        maxHeight: '1040px', // 65% of 1600
        label: 'Medium (65%)',
        percentage: '65%'
      },
      large: {
        width: 'min(100vh * 9/16, 80vw)',
        height: 'min(100vw * 16/9, 80vh)',
        maxWidth: '720px',   // 80% of 900
        maxHeight: '1280px', // 80% of 1600
        label: 'Large (80%)',
        percentage: '80%'
      },
      max: {
        width: 'min(100vh * 9/16, 100vw)',
        height: 'min(100vw * 16/9, 100vh)',
        maxWidth: '1440px',  // Full monitor width
        maxHeight: '2560px', // Full monitor height
        label: 'Maximum (Full Screen)',
        percentage: '100%'
      }
    };

    return configs[size];
  };

  return {
    frameSize,
    updateFrameSize,
    getFrameDimensions,
    currentDimensions: getFrameDimensions(frameSize)
  };
};