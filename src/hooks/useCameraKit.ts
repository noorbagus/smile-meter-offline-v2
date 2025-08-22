// src/hooks/useCameraKit.ts - Complete Error-Free Version
import { useState, useRef, useCallback, useEffect } from 'react';
import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from '@snap/camera-kit';
import { createAdaptiveCameraKitConfig, validateConfig } from '../config/cameraKit';
import type { CameraState } from './useCameraPermissions';

// Global Camera Kit Instance
let cameraKitInstance: any = null;
let preloadPromise: Promise<any> | null = null;

// Timeout wrapper
const withTimeout = <T>(promise: Promise<T>, ms: number, operation: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`${operation} timeout after ${ms}ms`)), ms)
    )
  ]);
};

// Preload Camera Kit
const preloadCameraKit = async () => {
  if (cameraKitInstance) return cameraKitInstance;
  if (preloadPromise) return preloadPromise;
  
  preloadPromise = (async () => {
    try {
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        throw new Error('HTTPS_REQUIRED');
      }
      
      validateConfig();
      cameraKitInstance = await withTimeout(
        bootstrapCameraKit({ 
          apiToken: import.meta.env.VITE_CAMERA_KIT_API_TOKEN || 'eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzQ3MDM1OTAyLCJzdWIiOiI2YzMzMWRmYy0zNzEzLTQwYjYtYTNmNi0zOTc2OTU3ZTkyZGF-UFJPRFVDVElPTn5jZjM3ZDAwNy1iY2IyLTQ3YjEtODM2My1jYWIzYzliOGJhM2YifQ.UqGhWZNuWXplirojsPSgZcsO3yu98WkTM1MRG66dsHI'
        }),
        10000,
        'Camera Kit Bootstrap'
      );
      return cameraKitInstance;
    } catch (error) {
      cameraKitInstance = null;
      preloadPromise = null;
      throw error;
    }
  })();
  
  return preloadPromise;
};

preloadCameraKit().catch(console.error);

// Resolution Profile Interface
interface ResolutionProfile {
  camera: { width: number; height: number };
  canvas: { width: number; height: number };
  display: { width: number; height: number };
  scaling: number;
  pixelPerfect: boolean;
}

// Calculate Perfect Resolution - NO PARAMETERS
const calculatePerfectResolution = (): ResolutionProfile => {
  const containerWidth = window.innerWidth;
  const containerHeight = window.innerHeight;
  
  const dpr = window.devicePixelRatio || 1;
  const physicalWidth = Math.round(containerWidth * dpr);
  const physicalHeight = Math.round(containerHeight * dpr);
  
  const evenWidth = physicalWidth + (physicalWidth % 2);
  const evenHeight = physicalHeight + (physicalHeight % 2);
  
  const maxDimension = 2048;
  const canvasWidth = Math.min(evenWidth, maxDimension);
  const canvasHeight = Math.min(evenHeight, maxDimension);
  
  const scalingX = canvasWidth / containerWidth;
  const scalingY = canvasHeight / containerHeight;
  const scaling = Math.max(scalingX, scalingY);
  const pixelPerfect = Math.abs(scaling - Math.round(scaling)) < 0.01;
  
  return {
    camera: { width: canvasWidth, height: canvasHeight },
    canvas: { width: canvasWidth, height: canvasHeight },
    display: { width: containerWidth, height: containerHeight },
    scaling,
    pixelPerfect
  };
};

// Anti-Pixelated Canvas Styler
const applyAntiPixelatedStyling = (
  canvas: HTMLCanvasElement,
  displayWidth: number,
  displayHeight: number,
  isFlipped: boolean = false
) => {
  const transform = isFlipped 
    ? 'translate(-50%, -50%) scaleX(-1) translateZ(0)'
    : 'translate(-50%, -50%) translateZ(0)';
  
  canvas.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    width: ${displayWidth}px;
    height: ${displayHeight}px;
    transform: ${transform};
    image-rendering: smooth;
    image-rendering: -webkit-optimize-contrast;
    object-fit: contain;
    object-position: center;
    will-change: transform;
    backface-visibility: hidden;
    perspective: 1000px;
    filter: blur(0px);
    background: transparent;
    border: none;
    outline: none;
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    image-rendering: -webkit-optimize-contrast;
    image-rendering: optimize-contrast;
  `;
  
  // Removed WebGL context access - Canvas is controlled by Snap Camera Kit OffscreenCanvas
};

// Main Hook
export const useCameraKit = (addLog: (message: string) => void) => {
  const [cameraState, setCameraState] = useState<CameraState>('initializing');
  const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>('user');
  
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lensRepositoryRef = useRef<any>(null);
  const containerRef = useRef<React.RefObject<HTMLDivElement> | null>(null);
  const resolutionProfileRef = useRef<ResolutionProfile | null>(null);
  
  const isAttachedRef = useRef<boolean>(false);
  const isInitializedRef = useRef<boolean>(false);
  const currentConfigRef = useRef<any>(null);

  // Canvas Attachment
  const attachCameraOutput = useCallback((
    canvas: HTMLCanvasElement, 
    containerReference: React.RefObject<HTMLDivElement>
  ) => {
    if (!containerReference.current) {
      addLog('❌ Container not available');
      return;
    }

    requestAnimationFrame(() => {
      if (!containerReference.current) return;

      while (containerReference.current.firstChild) {
        try {
          containerReference.current.removeChild(containerReference.current.firstChild);
        } catch (e) {
          break;
        }
      }
      
      outputCanvasRef.current = canvas;
      
      // Use cached profile or calculate new one
      const profile = resolutionProfileRef.current || calculatePerfectResolution();
      
      applyAntiPixelatedStyling(
        canvas,
        profile.display.width,
        profile.display.height,
        currentFacingMode === 'user'
      );
      
      containerReference.current.style.cssText = `
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #000;
        touch-action: manipulation;
        image-rendering: smooth;
        will-change: transform;
      `;
      
      try {
        containerReference.current.appendChild(canvas);
        isAttachedRef.current = true;
        addLog(`✅ Canvas attached: ${canvas.width}x${canvas.height} → ${profile.display.width}x${profile.display.height}`);
      } catch (e) {
        addLog(`❌ Canvas attachment failed: ${e}`);
      }
    });
  }, [addLog, currentFacingMode]);

  // Camera Feed Restoration
  const restoreCameraFeed = useCallback(() => {
    if (sessionRef.current && outputCanvasRef.current && containerRef.current?.current) {
      addLog('🔄 Restoring camera feed...');
      
      const isCanvasAttached = containerRef.current.current.contains(outputCanvasRef.current);
      
      if (!isCanvasAttached) {
        addLog('📱 Re-attaching canvas');
        attachCameraOutput(outputCanvasRef.current, containerRef.current);
      } else {
        const profile = resolutionProfileRef.current;
        if (profile) {
          applyAntiPixelatedStyling(
            outputCanvasRef.current,
            profile.display.width,
            profile.display.height,
            currentFacingMode === 'user'
          );
          addLog('🎨 Canvas styling refreshed');
        }
      }
      
      if (sessionRef.current.output?.live) {
        try {
          sessionRef.current.play('live');
          addLog('▶️ Session resumed');
        } catch (error) {
          addLog(`⚠️ Resume error: ${error}`);
        }
      }
    }
  }, [addLog, attachCameraOutput, currentFacingMode]);

  // Lens Reload
  const reloadLens = useCallback(async (): Promise<boolean> => {
    if (!sessionRef.current || !isInitializedRef.current) {
      addLog('❌ Cannot reload - session not ready');
      return false;
    }

    try {
      addLog('🔄 Restarting AR lens...');
      
      sessionRef.current.pause();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      try {
        await withTimeout(sessionRef.current.removeLens(), 3000, 'Lens Removal');
        addLog('🗑️ Lens removed');
      } catch (removeError) {
        addLog(`⚠️ Lens removal failed: ${removeError}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const lenses = lensRepositoryRef.current;
      if (lenses && lenses.length > 0 && currentConfigRef.current) {
        const targetLens = lenses.find((lens: any) => lens.id === currentConfigRef.current.lensId) || lenses[0];
        await withTimeout(sessionRef.current.applyLens(targetLens), 5000, 'Lens Application');
        addLog(`✅ Lens restarted: ${targetLens.name || 'Default'}`);
      }
      
      sessionRef.current.play('live');
      
      setTimeout(() => {
        restoreCameraFeed();
      }, 500);
      
      addLog('🎉 AR lens restarted');
      return true;
      
    } catch (error) {
      addLog(`❌ Lens restart failed: ${error}`);
      
      try {
        sessionRef.current.play('live');
      } catch (recoveryError) {
        addLog(`❌ Recovery failed: ${recoveryError}`);
      }
      
      return false;
    }
  }, [addLog, restoreCameraFeed]);

  // Camera Kit Initialization - ZERO ARGUMENTS FOR calculatePerfectResolution
  const initializeCameraKit = useCallback(async (
    stream: MediaStream,
    containerReference: React.RefObject<HTMLDivElement>
  ): Promise<boolean> => {
    try {
      // Calculate resolution profile - NO ARGUMENTS
      const resolutionProfile = calculatePerfectResolution();
      resolutionProfileRef.current = resolutionProfile;
      
      // Create adaptive config - no parameters needed
      const adaptiveConfig = createAdaptiveCameraKitConfig();
      adaptiveConfig.canvas.width = resolutionProfile.canvas.width;
      adaptiveConfig.canvas.height = resolutionProfile.canvas.height;
      currentConfigRef.current = adaptiveConfig;
      
      if (isInitializedRef.current && sessionRef.current && cameraState === 'ready') {
        addLog('📱 Updating existing session...');
        
        const source = createMediaStreamSource(stream, {
          transform: currentFacingMode === 'user' ? Transform2D.MirrorX : undefined,
          cameraType: currentFacingMode
        });
        
        await withTimeout(sessionRef.current.setSource(source), 5000, 'Source Update');
        await source.setRenderSize(resolutionProfile.canvas.width, resolutionProfile.canvas.height);
        
        streamRef.current = stream;
        containerRef.current = containerReference;
        
        if (sessionRef.current.output?.live && containerReference.current && !isAttachedRef.current) {
          setTimeout(() => {
            if (sessionRef.current.output.live) {
              attachCameraOutput(sessionRef.current.output.live, containerReference);
            }
          }, 200);
        }
        
        addLog('✅ Session updated');
        return true;
      }

      addLog('🎭 Initializing Camera Kit...');
      setCameraState('initializing');
      containerRef.current = containerReference;

      let cameraKit = cameraKitInstance;
      if (!cameraKit) {
        addLog('🚀 Bootstrapping Camera Kit...');
        cameraKit = await withTimeout(preloadCameraKit(), 12000, 'Camera Kit Bootstrap');
      }
      
      if (!cameraKit) {
        throw new Error('Failed to initialize Camera Kit');
      }

      const session: any = await withTimeout(cameraKit.createSession(), 8000, 'Session Creation');
      sessionRef.current = session;
      streamRef.current = stream;
      isInitializedRef.current = true;
      
      session.events.addEventListener("error", (event: any) => {
        addLog(`❌ Session error: ${event.detail}`);
        setCameraState('error');
      });

      const source = createMediaStreamSource(stream, {
        transform: currentFacingMode === 'user' ? Transform2D.MirrorX : undefined,
        cameraType: currentFacingMode
      });
      
      await withTimeout(session.setSource(source), 5000, 'Source Configuration');
      await source.setRenderSize(resolutionProfile.canvas.width, resolutionProfile.canvas.height);
      addLog(`✅ Render size: ${resolutionProfile.canvas.width}x${resolutionProfile.canvas.height}`);

      if (!lensRepositoryRef.current) {
        try {
          const lensResult: any = await withTimeout(
            cameraKit.lensRepository.loadLensGroups([adaptiveConfig.lensGroupId]), 
            8000,
            'Lens Repository Loading'
          );
          lensRepositoryRef.current = lensResult.lenses;
          addLog(`✅ Lens repository loaded: ${lensResult.lenses.length} lenses`);
        } catch (lensError) {
          addLog(`⚠️ Lens loading failed: ${lensError}`);
        }
      }

      const lenses = lensRepositoryRef.current;
      if (lenses && lenses.length > 0) {
        try {
          const targetLens = lenses.find((lens: any) => lens.id === adaptiveConfig.lensId) || lenses[0];
          await withTimeout(session.applyLens(targetLens), 5000, 'Lens Application');
          addLog(`✅ Lens applied: ${targetLens.name || 'Default'}`);
        } catch (lensApplyError) {
          addLog(`⚠️ Lens application failed: ${lensApplyError}`);
        }
      }

      session.play('live');

      setTimeout(() => {
        if (session.output.live && containerReference.current && !isAttachedRef.current) {
          attachCameraOutput(session.output.live, containerReference);
        }
      }, 600);

      setCameraState('ready');
      addLog('🎉 Camera Kit Complete!');
      return true;

    } catch (error: any) {
      addLog(`❌ Camera Kit error: ${error.message}`);
      setCameraState('error');
      return false;
    }
  }, [currentFacingMode, addLog, attachCameraOutput, cameraState]);

  // Camera Switch
  const switchCamera = useCallback(async (): Promise<MediaStream | null> => {
    if (!sessionRef.current || !isInitializedRef.current) {
      addLog('❌ Cannot switch - session not initialized');
      return null;
    }

    try {
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      addLog(`🔄 Switching to ${newFacingMode} camera...`);

      if (sessionRef.current.output?.live) {
        sessionRef.current.pause();
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      // Use cached resolution profile or defaults
      const profile = resolutionProfileRef.current;
      const cameraWidth = profile?.camera.width || 1920;
      const cameraHeight = profile?.camera.height || 1080;

      const newStream = await withTimeout(
        navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: newFacingMode,
            width: { ideal: cameraWidth, min: 640, max: 3840 },
            height: { ideal: cameraHeight, min: 480, max: 2160 },
            frameRate: { ideal: 30, min: 15, max: 60 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        }),
        8000,
        'Camera Switch Stream'
      );

      streamRef.current = newStream;

      const source = createMediaStreamSource(newStream, {
        transform: newFacingMode === 'user' ? Transform2D.MirrorX : undefined,
        cameraType: newFacingMode
      });
      
      await withTimeout(sessionRef.current.setSource(source), 5000, 'Source Switch');

      if (profile) {
        await source.setRenderSize(profile.canvas.width, profile.canvas.height);
      }

      await new Promise(resolve => setTimeout(resolve, 400));

      if (sessionRef.current.output?.live) {
        sessionRef.current.play('live');
      }

      setCurrentFacingMode(newFacingMode);
      
      setTimeout(() => {
        if (outputCanvasRef.current && profile) {
          applyAntiPixelatedStyling(
            outputCanvasRef.current,
            profile.display.width,
            profile.display.height,
            newFacingMode === 'user'
          );
        }
      }, 200);

      addLog(`🎉 Camera switched to ${newFacingMode}`);
      return newStream;
      
    } catch (error: any) {
      addLog(`❌ Camera switch failed: ${error.message}`);
      
      try {
        if (sessionRef.current.output?.live) {
          sessionRef.current.play('live');
        }
      } catch (recoveryError) {
        setCameraState('error');
      }
      
      return null;
    }
  }, [currentFacingMode, addLog]);

  // Session Controls
  const pauseSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.pause();
      addLog('⏸️ Session paused');
    }
  }, [addLog]);

  const resumeSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.play('live');
      addLog('▶️ Session resumed');
    }
  }, [addLog]);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (sessionRef.current) {
      sessionRef.current.pause();
    }
    isAttachedRef.current = false;
    containerRef.current = null;
    currentConfigRef.current = null;
    resolutionProfileRef.current = null;
    addLog('🧹 Cleanup complete');
  }, [addLog]);

  // Getters
  const getCanvas = useCallback(() => outputCanvasRef.current, []);
  const getStream = useCallback(() => streamRef.current, []);
  const getResolutionProfile = useCallback(() => resolutionProfileRef.current, []);

  // Auto-recovery
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && cameraState === 'ready') {
        setTimeout(() => restoreCameraFeed(), 150);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [restoreCameraFeed, cameraState]);

  return {
    cameraState,
    currentFacingMode,
    initializeCameraKit,
    switchCamera,
    reloadLens,
    pauseSession,
    resumeSession,
    cleanup,
    restoreCameraFeed,
    getCanvas,
    getStream,
    getResolutionProfile,
    isReady: cameraState === 'ready',
    isInitializing: cameraState === 'initializing'
  };
};