// src/config/cameraKit.ts - Fixed 4K optimized configuration
import type { CameraKitConfig } from '../types/camera';

// Environment variables with fallback values
const API_TOKEN = import.meta.env.VITE_CAMERA_KIT_API_TOKEN || 'eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzQ3MDM1OTAyLCJzdWIiOiI2YzMzMWRmYy0zNzEzLTQwYjYtYTNmNi0zOTc2OTU3ZTkyZGF-UFJPRFVDVElPTn5jZjM3ZDAwNy1iY2IyLTQ3YjEtODM2My1jYWIzYzliOGJhM2YifQ.UqGhWZNuWXplirojsPSgZcsO3yu98WkTM1MRG66dsHI';

const LENS_ID = import.meta.env.VITE_CAMERA_KIT_LENS_ID || '04441cd2-8e9d-420b-b293-90b5df8f577f';

const LENS_GROUP_ID = import.meta.env.VITE_CAMERA_KIT_LENS_GROUP_ID || 'cd5b1b49-4483-45ea-9772-cb241939e2ce';

export const CAMERA_KIT_CONFIG: CameraKitConfig = {
  apiToken: API_TOKEN,
  lensId: LENS_ID,
  lensGroupId: LENS_GROUP_ID,
  
  // PORTRAIT 4K canvas (9:16 ratio)
  canvas: {
    width: 2160,   // Portrait width
    height: 3840   // Portrait height
  },
  
  camera: {
    facingMode: 'user',
    audio: true
  },
  
  // High bitrate for 4K portrait recording
  recording: {
    mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    videoBitsPerSecond: 15000000 // 15Mbps for 4K
  }
};

// Portrait 4K display configuration
export const DISPLAY_CONFIG = {
  canvas: {
    width: 2160,    // Portrait width
    height: 3840,   // Portrait height
    aspectRatio: 9 / 16,  // Portrait ratio
    pixelRatio: 1
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
};

// AR processing configuration (optimized for performance)
export const AR_PROCESSING_CONFIG = {
  renderSize: {
    width: 1080,  // Portrait HD processing
    height: 1920
  },
  frameRate: 30,
  optimization: 'performance' as const
};

export const validateConfig = (): boolean => {
  const { apiToken, lensId, lensGroupId } = CAMERA_KIT_CONFIG;
  
  // Log configuration for debugging
  if (import.meta.env.MODE === 'development') {
    console.log('🔧 Portrait 4K Camera Kit Config:', {
      hasApiToken: !!apiToken,
      apiTokenLength: apiToken?.length,
      lensId: lensId,
      lensGroupId: lensGroupId,
      canvasRes: `${CAMERA_KIT_CONFIG.canvas.width}x${CAMERA_KIT_CONFIG.canvas.height}`,
      arRes: `${AR_PROCESSING_CONFIG.renderSize.width}x${AR_PROCESSING_CONFIG.renderSize.height}`,
      videoBitrate: `${CAMERA_KIT_CONFIG.recording.videoBitsPerSecond / 1000000}Mbps`,
      environment: import.meta.env.MODE
    });
  }
  
  if (!apiToken || apiToken === 'YOUR_API_TOKEN_HERE') {
    throw new Error('API Token is required. Please check your environment variables.');
  }
  
  if (!lensId || lensId === 'YOUR_LENS_ID_HERE') {
    throw new Error('Lens ID is required. Please check your environment variables.');
  }
  
  if (!lensGroupId || lensGroupId === 'YOUR_LENS_GROUP_ID_HERE') {
    throw new Error('Lens Group ID is required. Please check your environment variables.');
  }
  
  // Validate token format (basic JWT check)
  if (!apiToken.includes('.') || apiToken.split('.').length !== 3) {
    throw new Error('Invalid API Token format. Please check your token.');
  }
  
  return true;
};

// Helper function to get current configuration
export const getCurrentConfig = () => {
  return {
    isProduction: import.meta.env.PROD,
    isDevelopment: import.meta.env.DEV,
    mode: import.meta.env.MODE,
    hasEnvToken: !!import.meta.env.VITE_CAMERA_KIT_API_TOKEN,
    hasEnvLensId: !!import.meta.env.VITE_CAMERA_KIT_LENS_ID,
    hasEnvGroupId: !!import.meta.env.VITE_CAMERA_KIT_LENS_GROUP_ID,
    config: CAMERA_KIT_CONFIG,
    display: DISPLAY_CONFIG,
    arProcessing: AR_PROCESSING_CONFIG
  };
};

// Portrait 4K camera constraints
export const get4KCameraConstraints = (
  facingMode: 'user' | 'environment' = 'user'
): MediaStreamConstraints => {
  return {
    video: {
      facingMode,
      width: { ideal: 2160, min: 720, max: 2160 },
      height: { ideal: 3840, min: 1280, max: 3840 },
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

// Portrait 4K recording format
export const getOptimalRecordingFormat = () => {
  const formats = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // H.264 + AAC
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm'
  ];

  for (const mimeType of formats) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType)) {
      return {
        mimeType,
        videoBitsPerSecond: 15000000, // 15Mbps for 4K
        audioBitsPerSecond: 256000
      };
    }
  }

  return {
    videoBitsPerSecond: 15000000,
    audioBitsPerSecond: 256000
  };
};