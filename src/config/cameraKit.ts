import type { CameraKitConfig } from '../types/camera';

export const CAMERA_KIT_CONFIG: CameraKitConfig = {
  apiToken: 'API KEY',
  lensId: '04441cd2-8e9d-420b-b293-90b5df8f577f',
  lensGroupId: 'a0fecab7-26c6-4d63-9101-d25ff7fdd6ee',
  
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
  
  if (!apiToken || apiToken === 'YOUR_API_TOKEN_HERE') {
    throw new Error('API Token is required');
  }
  
  if (!lensId || lensId === 'YOUR_LENS_ID_HERE') {
    throw new Error('Lens ID is required');
  }
  
  if (!lensGroupId || lensGroupId === 'YOUR_LENS_GROUP_ID_HERE') {
    throw new Error('Lens Group ID is required');
  }
  
  return true;
};