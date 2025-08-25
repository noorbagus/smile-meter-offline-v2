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
        width: '50vw',
        height: '50vh', 
        maxWidth: '720px',
        maxHeight: '1280px',
        label: 'Small (50%)',
        percentage: '50%'
      },
      medium: {
        width: '65vw',
        height: '65vh',
        maxWidth: '936px', 
        maxHeight: '1664px',
        label: 'Medium (65%)',
        percentage: '65%'
      },
      large: {
        width: '80vw', 
        height: '80vh',
        maxWidth: '1152px',
        maxHeight: '2048px',
        label: 'Large (80%)',
        percentage: '80%'
      },
      max: {
        width: '100vw',
        height: '100vh',
        maxWidth: '1440px',
        maxHeight: '2560px', 
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