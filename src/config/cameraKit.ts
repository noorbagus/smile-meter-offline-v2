// src/config/cameraKit.ts - 270° rotation config
import type { CameraKitConfig } from '../types/camera';

const API_TOKEN = import.meta.env.VITE_CAMERA_KIT_API_TOKEN;

const LENS_ID = import.meta.env.VITE_CAMERA_KIT_LENS_ID;
const LENS_GROUP_ID = import.meta.env.VITE_CAMERA_KIT_LENS_GROUP_ID;

/**
 * 270° PORTRAIT CANVAS - Hardware landscape 270° rotation
 * Hardware landscape (2560x1440) → Software portrait (1440x2560) with 270° rotation
 */
export const getMaxPortraitCanvasSize = () => {
  // 270° rotation: landscape width → portrait height, but rotated 270°
  const hardwareLandscapeWidth = 2560;  // Brio max width
  const hardwareLandscapeHeight = 1440; // Brio max height
  
  // 270° ROTATION: Different from 90°
  const portraitWidth = hardwareLandscapeHeight;   // 1440 
  const portraitHeight = hardwareLandscapeWidth;   // 2560
  
  // Enhanced device capability detection
  const isAndroidTV = /Android.*TV|Android.*Box/i.test(navigator.userAgent);
  const isKhadas = /Khadas/i.test(navigator.userAgent) || /RK3588|RK3576/i.test(navigator.userAgent);
  const hasHighDPR = window.devicePixelRatio >= 1.5;
  const has4KScreen = window.screen.width >= 1440 || window.screen.height >= 2560;
  const hasGoodMemory = (navigator as any).deviceMemory >= 4 || !('deviceMemory' in navigator);
  const hasGoodCores = navigator.hardwareConcurrency >= 6;
  
  const deviceCanHandle4K = isAndroidTV || isKhadas || has4KScreen || (hasHighDPR && hasGoodMemory && hasGoodCores);
  
  let finalWidth, finalHeight;
  
  if (deviceCanHandle4K) {
    finalWidth = portraitWidth;   // 1440
    finalHeight = portraitHeight; // 2560
  } else {
    const scaleFactor = 0.75;
    finalWidth = Math.round(portraitWidth * scaleFactor);   // ~1080
    finalHeight = Math.round(portraitHeight * scaleFactor); // ~1920
  }
  
  console.log('🎯 270° Portrait Canvas:', {
    device: {
      userAgent: navigator.userAgent.includes('Khadas') ? 'Khadas Edge 2 Pro' : 'Unknown',
      isAndroidTV,
      isKhadas,
      hasHighDPR,
      has4KScreen,
      hasGoodMemory: hasGoodMemory ? `${(navigator as any).deviceMemory || 'unknown'}GB` : 'low',
      hasGoodCores: `${navigator.hardwareConcurrency} cores`
    },
    hardwareLandscape: `${hardwareLandscapeWidth}x${hardwareLandscapeHeight}`,
    rotation270Portrait: `${portraitWidth}x${portraitHeight}`,
    deviceCanHandle4K,
    final: `${finalWidth}x${finalHeight}`,
    flow: 'Hardware 2560x1440 → 270° Rotated 1440x2560',
    qualityGain: `${((finalWidth * finalHeight) / (1080 * 1920) * 100).toFixed(0)}% vs 1080p`,
    rotationMode: '270° ROTATION'
  });
  
  return {
    width: finalWidth,
    height: finalHeight,
    isMaxQuality: deviceCanHandle4K,
    sourceResolution: `${hardwareLandscapeWidth}x${hardwareLandscapeHeight}`,
    rotatedResolution: `${portraitWidth}x${portraitHeight}`,
    rotationDegrees: 270
  };
};

/**
 * 270° Portrait Camera Kit config
 */
export const createMaxPortraitCameraKitConfig = (): CameraKitConfig => {
  const canvasSize = getMaxPortraitCanvasSize();
  
  return {
    apiToken: API_TOKEN,
    lensId: LENS_ID,
    lensGroupId: LENS_GROUP_ID,
    
    // 270° portrait canvas
    canvas: {
      width: canvasSize.width,   
      height: canvasSize.height  
    },
    
    // Camera request tetap landscape (hardware optimal)
    camera: {
      facingMode: 'user',
      audio: true
    },
    
    // Recording bitrate untuk high resolution
    recording: {
      mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      videoBitsPerSecond: canvasSize.isMaxQuality ? 
        15000000 : // 15Mbps untuk 1440x2560
        8000000    // 8Mbps untuk 1080x1920
    }
  };
};

// Hardware camera constraints - ALWAYS landscape
export const getBrioOptimalConstraints = (
  facingMode: 'user' | 'environment' = 'user'
): MediaStreamConstraints => {
  return {
    video: {
      facingMode,
      // Brio native landscape resolution
      width: { ideal: 2560, min: 1280, max: 3840 },
      height: { ideal: 1440, min: 720, max: 2160 },
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

// Portrait display config with 270° rotation
export const getPortraitDisplayConfig = () => ({
  canvas: {
    aspectRatio: 9 / 16, // Portrait
    objectFit: 'cover' as const,
    objectPosition: 'center' as const,
    rotation: 270 // 270° rotation flag
  },
  
  css: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center',
    transform: 'rotate(270deg)' // CSS 270° rotation if needed
  },
  
  container: {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    background: '#000'
  }
});

// Validation
export const validateConfig = (): boolean => {
  const config = createMaxPortraitCameraKitConfig();
  
  if (import.meta.env.MODE === 'development') {
    console.log('🔧 270° Portrait Camera Kit Config:', {
      hasApiToken: !!config.apiToken,
      lensId: config.lensId,
      lensGroupId: config.lensGroupId,
      canvasRes: `${config.canvas.width}x${config.canvas.height}`,
      aspectRatio: (config.canvas.width / config.canvas.height).toFixed(2),
      flow: 'Landscape Hardware → 270° Portrait Software',
      environment: import.meta.env.MODE
    });
  }
  
  // Validate portrait aspect ratio
  const aspectRatio = config.canvas.width / config.canvas.height;
  if (aspectRatio > 0.6) {
    console.warn('⚠️ Canvas not portrait aspect ratio:', aspectRatio);
  }
  
  if (!config.apiToken || config.apiToken === 'YOUR_API_TOKEN_HERE') {
    throw new Error('API Token is required.');
  }
  
  if (!config.lensId || config.lensId === 'YOUR_LENS_ID_HERE') {
    throw new Error('Lens ID is required.');
  }
  
  if (!config.lensGroupId || config.lensGroupId === 'YOUR_LENS_GROUP_ID_HERE') {
    throw new Error('Lens Group ID is required.');
  }
  
  return true;
};

// Export aliases
export const createAdaptiveCameraKitConfig = createMaxPortraitCameraKitConfig;
export const CAMERA_KIT_CONFIG = createMaxPortraitCameraKitConfig();