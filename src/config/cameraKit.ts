// src/config/cameraKit.ts - Adaptive resolution fix
import type { CameraKitConfig } from '../types/camera';

const API_TOKEN = import.meta.env.VITE_CAMERA_KIT_API_TOKEN || 'eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzQ3MDM1OTAyLCJzdWIiOiI2YzMzMWRmYy0zNzEzLTQwYjYtYTNmNi0zOTc2OTU3ZTkyZGF-UFJPRFVDVElPTn5jZjM3ZDAwNy1iY2IyLTQ3YjEtODM2My1jYWIzYzliOGJhM2YifQ.UqGhWZNuWXplirojsPSgZcsO3yu98WkTM1MRG66dsHI';

const LENS_ID = import.meta.env.VITE_CAMERA_KIT_LENS_ID || '04441cd2-8e9d-420b-b293-90b5df8f577f';
const LENS_GROUP_ID = import.meta.env.VITE_CAMERA_KIT_LENS_GROUP_ID || 'cd5b1b49-4483-45ea-9772-cb241939e2ce';

/**
 * Detect optimal canvas resolution based on container and device capability
 */
export const getOptimalCanvasSize = (containerRef?: React.RefObject<HTMLDivElement>) => {
  // Get container dimensions if available
  let containerWidth = window.innerWidth;
  let containerHeight = window.innerHeight;
  
  if (containerRef?.current) {
    const rect = containerRef.current.getBoundingClientRect();
    containerWidth = rect.width;
    containerHeight = rect.height;
  }
  
  // Apply device pixel ratio for crisp rendering
  const dpr = window.devicePixelRatio || 1;
  const physicalWidth = Math.round(containerWidth * dpr);
  const physicalHeight = Math.round(containerHeight * dpr);
  
  // Cap at reasonable max for performance
  const maxWidth = 1920;
  const maxHeight = 1920;
  
  const optimalWidth = Math.min(physicalWidth, maxWidth);
  const optimalHeight = Math.min(physicalHeight, maxHeight);
  
  console.log('🎯 Optimal canvas:', {
    container: `${containerWidth}x${containerHeight}`,
    dpr,
    physical: `${physicalWidth}x${physicalHeight}`,
    optimal: `${optimalWidth}x${optimalHeight}`
  });
  
  return {
    width: optimalWidth,
    height: optimalHeight
  };
};

/**
 * Create adaptive Camera Kit config based on container
 */
export const createAdaptiveCameraKitConfig = (containerRef?: React.RefObject<HTMLDivElement>): CameraKitConfig => {
  const canvasSize = getOptimalCanvasSize(containerRef);
  
  return {
    apiToken: API_TOKEN,
    lensId: LENS_ID,
    lensGroupId: LENS_GROUP_ID,
    
    // ADAPTIVE canvas size - matches container
    canvas: {
      width: canvasSize.width,
      height: canvasSize.height
    },
    
    camera: {
      facingMode: 'user',
      audio: true
    },
    
    // Adaptive bitrate based on resolution
    recording: {
      mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      videoBitsPerSecond: Math.min(15000000, canvasSize.width * canvasSize.height * 0.1) // Scale with resolution
    }
  };
};

// Static fallback config (for backward compatibility)
export const CAMERA_KIT_CONFIG: CameraKitConfig = {
  apiToken: API_TOKEN,
  lensId: LENS_ID,
  lensGroupId: LENS_GROUP_ID,
  
  // Default to screen size
  canvas: {
    width: Math.round(window.innerWidth * (window.devicePixelRatio || 1)),
    height: Math.round(window.innerHeight * (window.devicePixelRatio || 1))
  },
  
  camera: {
    facingMode: 'user',
    audio: true
  },
  
  recording: {
    mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    videoBitsPerSecond: 8000000 // Conservative default
  }
};

// Display config (adaptive)
export const getAdaptiveDisplayConfig = (canvasWidth: number, canvasHeight: number) => ({
  canvas: {
    width: canvasWidth,
    height: canvasHeight,
    aspectRatio: canvasWidth / canvasHeight,
    pixelRatio: window.devicePixelRatio || 1
  },
  rendering: {
    antialias: true,
    powerPreference: 'high-performance' as const,
    preserveDrawingBuffer: false,
    premultipliedAlpha: false
  },
  css: {
    objectFit: 'contain' as const,
    objectPosition: 'center' as const,
    imageRendering: 'crisp-edges' as const
  }
});

// AR processing config (performance-optimized)
export const AR_PROCESSING_CONFIG = {
  renderSize: {
    width: 1080,
    height: 1920
  },
  frameRate: 30,
  optimization: 'performance' as const
};

export const validateConfig = (): boolean => {
  const { apiToken, lensId, lensGroupId } = CAMERA_KIT_CONFIG;
  
  if (import.meta.env.MODE === 'development') {
    console.log('🔧 Adaptive Camera Kit Config:', {
      hasApiToken: !!apiToken,
      lensId,
      lensGroupId,
      canvasRes: `${CAMERA_KIT_CONFIG.canvas.width}x${CAMERA_KIT_CONFIG.canvas.height}`,
      environment: import.meta.env.MODE
    });
  }
  
  if (!apiToken || apiToken === 'YOUR_API_TOKEN_HERE') {
    throw new Error('API Token is required.');
  }
  
  if (!lensId || lensId === 'YOUR_LENS_ID_HERE') {
    throw new Error('Lens ID is required.');
  }
  
  if (!lensGroupId || lensGroupId === 'YOUR_LENS_GROUP_ID_HERE') {
    throw new Error('Lens Group ID is required.');
  }
  
  return true;
};

// Helper untuk 4K camera constraints
export const get4KCameraConstraints = (
  facingMode: 'user' | 'environment' = 'user'
): MediaStreamConstraints => {
  return {
    video: {
      facingMode,
      width: { ideal: 2560, min: 720, max: 3840 },
      height: { ideal: 1440, min: 480, max: 2160 },
      frameRate: { ideal: 30, min: 15, max: 60 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: { ideal: 48000 },
      channelCount: { ideal: 2 }
    }
  };
};

// Recording format yang optimal
export const getOptimalRecordingFormat = () => {
  const formats = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm'
  ];

  for (const mimeType of formats) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)) {
      return {
        mimeType,
        videoBitsPerSecond: 8000000,
        audioBitsPerSecond: 256000
      };
    }
  }

  return {
    videoBitsPerSecond: 8000000,
    audioBitsPerSecond: 256000
  };
};