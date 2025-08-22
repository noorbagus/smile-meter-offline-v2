// src/config/cameraKit.ts - FORCE 4K Configuration
import type { CameraKitConfig } from '../types/camera';

// Environment variables with fallback values
const API_TOKEN = import.meta.env.VITE_CAMERA_KIT_API_TOKEN || 'eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzQ3MDM1OTAyLCJzdWIiOiI2YzMzMWRmYy0zNzEzLTQwYjYtYTNmNi0zOTc2OTU3ZTkyZGF-UFJPRFVDVElPTn5jZjM3ZDAwNy1iY2IyLTQ3YjEtODM2My1jYWIzYzliOGJhM2YifQ.UqGhWZNuWXplirojsPSgZcsO3yu98WkTM1MRG66dsHI';
const LENS_ID = import.meta.env.VITE_CAMERA_KIT_LENS_ID || '04441cd2-8e9d-420b-b293-90b5df8f577f';
const LENS_GROUP_ID = import.meta.env.VITE_CAMERA_KIT_LENS_GROUP_ID || 'cd5b1b49-4483-45ea-9772-cb241939e2ce';

export const CAMERA_KIT_CONFIG: CameraKitConfig = {
  apiToken: API_TOKEN,
  lensId: LENS_ID,
  lensGroupId: LENS_GROUP_ID,
  
  // FORCE 4K canvas
  canvas: {
    width: 3840,
    height: 2160
  },
  
  camera: {
    facingMode: 'user',
    audio: true
  },
  
  // FORCE 4K recording
  recording: {
    mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    videoBitsPerSecond: 20000000 // 20Mbps for 4K
  }
};

// FORCE 4K detection - bypass adaptive detection
export const detectMaxCameraResolution = async (
  facingMode: 'user' | 'environment' = 'user',
  addLog: (msg: string) => void
): Promise<{ width: number; height: number; fps: number }> => {
  
  addLog('🚀 FORCING 4K detection for Android Edge...');
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode,
        width: { exact: 3840 },  // EXACT instead of ideal
        height: { exact: 2160 },
        frameRate: { ideal: 30 }
      }
    });
    
    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings();
    stream.getTracks().forEach(t => t.stop());
    
    const actual = {
      width: settings.width || 3840,
      height: settings.height || 2160,
      fps: settings.frameRate || 30
    };
    
    addLog(`🎯 FORCED 4K SUCCESS: ${actual.width}x${actual.height}@${actual.fps}fps`);
    return actual;
    
  } catch (error) {
    addLog(`❌ 4K exact failed: ${error}`);
    
    // Fallback: try 4K with ideal (not exact)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 3840, min: 1920 },
          height: { ideal: 2160, min: 1080 },
          frameRate: { ideal: 30 }
        }
      });
      
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      stream.getTracks().forEach(t => t.stop());
      
      const fallback = {
        width: settings.width || 1920,
        height: settings.height || 1080,
        fps: settings.frameRate || 30
      };
      
      addLog(`⚠️ 4K fallback: ${fallback.width}x${fallback.height}@${fallback.fps}fps`);
      return fallback;
      
    } catch (fallbackError) {
      addLog(`❌ 4K fallback failed: ${fallbackError}`);
      return { width: 1920, height: 1080, fps: 30 };
    }
  }
};

// FORCE 4K display (ignore adaptive detection)
export const detectMaxDisplayResolution = (addLog: (msg: string) => void) => {
  addLog('🖥️ FORCING 4K display mode...');
  
  // Always return 4K for Canvas/AR rendering
  return {
    width: 3840,
    height: 2160,
    name: '4K FORCED'
  };
};

// FORCE 4K Chrome constraints
export const get4KCameraConstraints = (
  facingMode: 'user' | 'environment' = 'user'
): MediaStreamConstraints => {
  return {
    video: {
      facingMode,
      width: { exact: 3840 },      // EXACT for 4K
      height: { exact: 2160 },
      frameRate: { ideal: 30, min: 24 }
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

// Chrome flags recommendation
export const getChromeFlags = () => {
  return [
    '--enable-experimental-web-platform-features',
    '--enable-features=WebRTC-H264WithOpenH264FFmpeg',
    '--force-webrtc-ip-handling-policy=default',
    '--enable-gpu-rasterization',
    '--enable-zero-copy'
  ];
};

export const validateConfig = (): boolean => {
  const { apiToken, lensId, lensGroupId } = CAMERA_KIT_CONFIG;
  
  if (import.meta.env.MODE === 'development') {
    console.log('🔧 FORCED 4K Camera Kit Config:', {
      hasApiToken: !!apiToken,
      canvasRes: `${CAMERA_KIT_CONFIG.canvas.width}x${CAMERA_KIT_CONFIG.canvas.height}`,
      videoBitrate: `${CAMERA_KIT_CONFIG.recording.videoBitsPerSecond / 1000000}Mbps`,
      chromeFlags: getChromeFlags()
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
  
  if (!apiToken.includes('.') || apiToken.split('.').length !== 3) {
    throw new Error('Invalid API Token format. Please check your token.');
  }
  
  return true;
};