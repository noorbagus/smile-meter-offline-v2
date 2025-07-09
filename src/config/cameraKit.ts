import type { CameraKitConfig } from '../types/camera';

export const CAMERA_KIT_CONFIG: CameraKitConfig = {
  apiToken: 'eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzQ3MDM1OTAyLCJzdWIiOiI2YzMzMWRmYy0zNzEzLTQwYjYtYTNmNi0zOTc2OTU3ZTkyZGF-U1RBR0lOR35mMGY1ODQ4NS1iZmQ5LTRkZjEtYmQzNy1lZjgwZjU3OTg1MjAifQ.asLt4CSPEbG3-9aT7Fq0ggjRRb5QjoE-RHcWvq8I-Sg',
  lensId: '6c331dfc-3713-40b6-a3f6-3976957e92da',
  lensGroupId: '466a4bd3-e6cb-43d7-ba83-f6c8943d2707',
  
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
