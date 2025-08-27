// src/config/cameraKit.ts - 270° Rotation: Hardware Landscape → Software Portrait
import type { CameraKitConfig } from '../types/camera';

const API_TOKEN = import.meta.env.VITE_CAMERA_KIT_API_TOKEN;

const LENS_ID = import.meta.env.VITE_CAMERA_KIT_LENS_ID;
const LENS_GROUP_ID = import.meta.env.VITE_CAMERA_KIT_LENS_GROUP_ID;

/**
 * 270° ROTATION CONFIG - Hardware landscape → Software portrait (270°)
 * Hardware landscape (2560x1440) → Rotated portrait (1440x2560) with 270° transform
 */
export const getMaxPortraitCanvasSize = () => {
  // Hardware landscape dari Brio
  const hardwareLandscapeWidth = 2560;  // Brio max width
  const hardwareLandscapeHeight = 1440; // Brio max height
  
  // ROTATE 270°: landscape dimensions → portrait dengan rotasi 270°
  const portraitWidth = hardwareLandscapeHeight;   // 1440 (dari height landscape)
  const portraitHeight = hardwareLandscapeWidth;   // 2560 (dari width landscape)
  
  // Enhanced device capability detection untuk Android TV/Box
  const isAndroidTV = /Android.*TV|Android.*Box/i.test(navigator.userAgent);
  const isKhadas = /Khadas/i.test(navigator.userAgent) || /RK3588|RK3576/i.test(navigator.userAgent);
  const hasHighDPR = window.devicePixelRatio >= 1.5;
  const has4KScreen = window.screen.width >= 1440 || window.screen.height >= 2560;
  const hasGoodMemory = (navigator as any).deviceMemory >= 4 || !('deviceMemory' in navigator);
  const hasGoodCores = navigator.hardwareConcurrency >= 6;
  
  // Device dianggap capable jika salah satu kondisi terpenuhi
  const deviceCanHandle4K = isAndroidTV || isKhadas || has4KScreen || (hasHighDPR && hasGoodMemory && hasGoodCores);
  
  let finalWidth, finalHeight;
  
  if (deviceCanHandle4K) {
    // Device kuat: pakai full rotated resolution
    finalWidth = portraitWidth;   // 1440
    finalHeight = portraitHeight; // 2560
  } else {
    // Device lemah: scale down tapi tetap maintain aspect ratio
    const scaleFactor = 0.75; // 75% dari max
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
    rotatedPortrait: `${portraitWidth}x${portraitHeight}`,
    rotation: '270° (counterclockwise)',
    deviceCanHandle4K,
    final: `${finalWidth}x${finalHeight}`,
    flow: 'Hardware 2560x1440 → 270° Rotated 1440x2560',
    qualityGain: `${((finalWidth * finalHeight) / (1080 * 1920) * 100).toFixed(0)}% vs 1080p`,
    forceMaxQuality: deviceCanHandle4K ? 'YES - MAX QUALITY 270°' : 'NO - SCALED 270°'
  });
  
  return {
    width: finalWidth,
    height: finalHeight,
    isMaxQuality: deviceCanHandle4K,
    sourceResolution: `${hardwareLandscapeWidth}x${hardwareLandscapeHeight}`,
    rotatedResolution: `${portraitWidth}x${portraitHeight}`,
    rotationAngle: 270 // Tambah info rotasi
  };
};

/**
 * 270° Portrait Camera Kit config
 * Flow: Brio 2560x1440 landscape → Camera Kit 1440x2560 portrait (270° ROTATED!)
 */
export const createMaxPortraitCameraKitConfig = (): CameraKitConfig => {
  const canvasSize = getMaxPortraitCanvasSize();
  
  return {
    apiToken: API_TOKEN,
    lensId: LENS_ID,
    lensGroupId: LENS_GROUP_ID,
    
    // 270° rotated portrait canvas
    canvas: {
      width: canvasSize.width,   // 1440 (max quality) atau 1080 (scaled)
      height: canvasSize.height  // 2560 (max quality) atau 1920 (scaled)
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

// Hardware camera constraints - ALWAYS landscape untuk Brio
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

// 270° Portrait display config
export const getPortraitDisplayConfig = () => ({
  canvas: {
    aspectRatio: 9 / 16, // Portrait
    objectFit: 'cover' as const,
    objectPosition: 'center' as const,
    rotation: 270 // 270° counterclockwise
  },
  
  // CSS for 270° rotated portrait display
  css: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center',
    transform: 'rotate(270deg)' // CSS transform untuk 270°
  },
  
  // Container style untuk mobile dengan 270° rotation
  container: {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    background: '#000',
    transform: 'rotate(270deg)' // Container juga dirotasi
  }
});

// Validation dengan 270° rotation info
export const validateConfig = (): boolean => {
  const config = createMaxPortraitCameraKitConfig();
  
  if (import.meta.env.MODE === 'development') {
    console.log('🔧 270° Portrait Camera Kit Config:', {
      hasApiToken: !!config.apiToken,
      lensId: config.lensId,
      lensGroupId: config.lensGroupId,
      canvasRes: `${config.canvas.width}x${config.canvas.height}`,
      aspectRatio: (config.canvas.width / config.canvas.height).toFixed(2),
      rotation: '270° counterclockwise',
      flow: 'Landscape Hardware → 270° Portrait Software',
      environment: import.meta.env.MODE
    });
  }
  
  // Validate portrait aspect ratio
  const aspectRatio = config.canvas.width / config.canvas.height;
  if (aspectRatio > 0.6) { // Should be around 0.56 for 9:16
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

// Export dengan nama yang tepat
export const createAdaptiveCameraKitConfig = createMaxPortraitCameraKitConfig;
export const CAMERA_KIT_CONFIG = createMaxPortraitCameraKitConfig();