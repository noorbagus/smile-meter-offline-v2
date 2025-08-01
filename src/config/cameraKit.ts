import type { CameraKitConfig } from '../types/camera';

// Environment variables with fallback values
const API_TOKEN = import.meta.env.VITE_CAMERA_KIT_API_TOKEN || 'eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzQ3MDM1OTAyLCJzdWIiOiI2YzMzMWRmYy0zNzEzLTQwYjYtYTNmNi0zOTc2OTU3ZTkyZGF-UFJPRFVDVElPTn5jZjM3ZDAwNy1iY2IyLTQ3YjEtODM2My1jYWIzYzliOGJhM2YifQ.UqGhWZNuWXplirojsPSgZcsO3yu98WkTM1MRG66dsHI';

const LENS_ID = import.meta.env.VITE_CAMERA_KIT_LENS_ID || '18afcdf0-939d-4fa6-89d7-9728243de56c';

const LENS_GROUP_ID = import.meta.env.VITE_CAMERA_KIT_LENS_GROUP_ID || '9748b404-fe76-4802-9a16-ca6bb1fe6295';

export const CAMERA_KIT_CONFIG: CameraKitConfig = {
  apiToken: API_TOKEN,
  lensId: LENS_ID,
  lensGroupId: LENS_GROUP_ID,
  
  canvas: {
    width: window.innerWidth,
    height: window.innerHeight
  },
  
  camera: {
    facingMode: 'user',
    audio: true
  },
  
  recording: {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 2500000
  }
};

export const validateConfig = (): boolean => {
  const { apiToken, lensId, lensGroupId } = CAMERA_KIT_CONFIG;
  
  // Log configuration for debugging (remove in production)
  if (import.meta.env.MODE === 'development') {
    console.log('🔧 Camera Kit Config:', {
      hasApiToken: !!apiToken,
      apiTokenLength: apiToken?.length,
      lensId: lensId,
      lensGroupId: lensGroupId,
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
    config: CAMERA_KIT_CONFIG
  };
};