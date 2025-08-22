// src/hooks/useCameraKit.ts - Always mirror, no facingMode
import { useState, useRef, useCallback, useEffect } from 'react';
import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from '@snap/camera-kit';
import { createAdaptiveCameraKitConfig, validateConfig } from '../config/cameraKit';
import type { CameraState } from './useCameraPermissions';

let cameraKitInstance: any = null;
let preloadPromise: Promise<any> | null = null;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    )
  ]);
};

const preloadCameraKit = async () => {
  if (cameraKitInstance) return cameraKitInstance;
  if (preloadPromise) return preloadPromise;
  
  preloadPromise = (async () => {
    try {
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        throw new Error('HTTPS_REQUIRED');
      }
      
      validateConfig();
      cameraKitInstance = await bootstrapCameraKit({ 
        apiToken: import.meta.env.VITE_CAMERA_KIT_API_TOKEN || 'eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzQ3MDM1OTAyLCJzdWIiOiI2YzMzMWRmYy0zNzEzLTQwYjYtYTNmNi0zOTc2OTU3ZTkyZGF-UFJPRFVDVElPTn5jZjM3ZDAwNy1iY2IyLTQ3YjEtODM2My1jYWIzYzliOGJhM2YifQ.UqGhWZNuWXplirojsPSgZcsO3yu98WkTM1MRG66dsHI'
      });
      
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

export const useCameraKit = (addLog: (message: string) => void) => {
  const [cameraState, setCameraState] = useState<CameraState>('initializing');
  const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>('user'); // For UI only
  
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lensRepositoryRef = useRef<any>(null);
  const isAttachedRef = useRef<boolean>(false);
  const containerRef = useRef<React.RefObject<HTMLDivElement> | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  const currentConfigRef = useRef<any>(null);

  const attachCameraOutput = useCallback((
    canvas: HTMLCanvasElement, 
    containerReference: React.RefObject<HTMLDivElement>
  ) => {
    if (!containerReference.current) {
      addLog('❌ Container not available');
      return;
    }

    try {
      requestAnimationFrame(() => {
        if (!containerReference.current) return;

        // Clear container
        while (containerReference.current.firstChild) {
          try {
            containerReference.current.removeChild(containerReference.current.firstChild);
          } catch (e) {
            break;
          }
        }
        
        outputCanvasRef.current = canvas;
        addLog(`📊 Canvas: ${canvas.width}x${canvas.height}`);
        
        // Perfect fit calculations
        const containerRect = containerReference.current.getBoundingClientRect();
        const canvasAspect = canvas.width / canvas.height;
        const containerAspect = containerRect.width / containerRect.height;
        
        let displayWidth, displayHeight;
        if (canvasAspect > containerAspect) {
          displayWidth = containerRect.width;
          displayHeight = containerRect.width / canvasAspect;
        } else {
          displayHeight = containerRect.height;
          displayWidth = containerRect.height * canvasAspect;
        }
        
        // HIGH QUALITY CSS with mirroring
        canvas.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          width: ${displayWidth}px;
          height: ${displayHeight}px;
          transform: translate(-50%, -50%);
          object-fit: contain;
          object-position: center;
          background: transparent;
          image-rendering: auto;
          image-rendering: -webkit-optimize-contrast;
          filter: contrast(1.05);
          will-change: transform;
          backface-visibility: hidden;
        `;
        
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
        `;
        
        try {
          containerReference.current.appendChild(canvas);
          isAttachedRef.current = true;
          
          const scaleX = displayWidth / canvas.width;
          const scaleY = displayHeight / canvas.height;
          addLog(`✅ Canvas attached - Scale: ${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`);
        } catch (e) {
          addLog(`❌ Attachment failed: ${e}`);
        }
      });
    } catch (error) {
      addLog(`❌ Canvas error: ${error}`);
    }
  }, [addLog]);

  const restoreCameraFeed = useCallback(() => {
    if (sessionRef.current && outputCanvasRef.current && containerRef.current?.current) {
      addLog('🔄 Restoring camera feed...');
      
      const isCanvasAttached = containerRef.current.current.contains(outputCanvasRef.current);
      
      if (!isCanvasAttached) {
        addLog('📱 Re-attaching canvas');
        attachCameraOutput(outputCanvasRef.current, containerRef.current);
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
  }, [addLog, attachCameraOutput]);

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
        await withTimeout(sessionRef.current.removeLens(), 2000);
        addLog('🗑️ Lens removed');
      } catch (removeError) {
        addLog(`⚠️ Lens removal failed: ${removeError}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const lenses = lensRepositoryRef.current;
      if (lenses && lenses.length > 0 && currentConfigRef.current) {
        const targetLens = lenses.find((lens: any) => lens.id === currentConfigRef.current.lensId) || lenses[0];
        await withTimeout(sessionRef.current.applyLens(targetLens), 3000);
        addLog(`✅ Lens restarted: ${targetLens.name}`);
      }
      
      sessionRef.current.play('live');
      
      setTimeout(() => {
        restoreCameraFeed();
      }, 300);
      
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

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        addLog('👁️ App visible - checking camera...');
        setTimeout(() => {
          restoreCameraFeed();
        }, 100);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [addLog, restoreCameraFeed]);

  const initializeCameraKit = useCallback(async (
    stream: MediaStream,
    containerReference: React.RefObject<HTMLDivElement>
  ): Promise<boolean> => {
    try {
      const adaptiveConfig = createAdaptiveCameraKitConfig(containerReference);
      currentConfigRef.current = adaptiveConfig;
      
      if (isInitializedRef.current && sessionRef.current && cameraState === 'ready') {
        addLog('📱 Updating existing session...');
        
        // ALWAYS MIRROR - no facingMode logic
        const source = createMediaStreamSource(stream, {
          transform: Transform2D.MirrorX, // Always mirror
          cameraType: 'user' // Fixed value for consistency
        });
        
        await withTimeout(sessionRef.current.setSource(source), 3000);
        
        // Match AR processing to camera resolution
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        await source.setRenderSize(
          settings.width || adaptiveConfig.canvas.width,
          settings.height || adaptiveConfig.canvas.height
        );
        addLog(`✅ Mirrored render: ${settings.width}x${settings.height}`);
        
        streamRef.current = stream;
        containerRef.current = containerReference;
        
        if (sessionRef.current.output?.live && containerReference.current && !isAttachedRef.current) {
          setTimeout(() => {
            if (sessionRef.current.output.live) {
              attachCameraOutput(sessionRef.current.output.live, containerReference);
            }
          }, 100);
        }
        
        addLog('✅ Stream updated with mirror');
        return true;
      }

      addLog('🎭 Initializing Camera Kit with mirrored output...');
      addLog(`📐 Adaptive canvas: ${adaptiveConfig.canvas.width}x${adaptiveConfig.canvas.height}`);
      setCameraState('initializing');
      containerRef.current = containerReference;

      let cameraKit = cameraKitInstance;
      if (!cameraKit) {
        addLog('Bootstrapping Camera Kit...');
        try {
          cameraKit = await withTimeout(preloadCameraKit(), 10000);
        } catch (ckError: any) {
          addLog(`❌ Bootstrap failed: ${ckError.message}`);
          setCameraState('error');
          return false;
        }
      }
      
      if (!cameraKit) {
        throw new Error('Failed to initialize Camera Kit');
      }

      addLog('🎬 Creating session...');
      const session: any = await withTimeout(cameraKit.createSession(), 5000);
      sessionRef.current = session;
      streamRef.current = stream;
      isInitializedRef.current = true;
      
      session.events.addEventListener("error", (event: any) => {
        addLog(`❌ Session error: ${event.detail}`);
        setCameraState('error');
      });

      // ALWAYS MIRROR - no facingMode logic
      const source = createMediaStreamSource(stream, {
        transform: Transform2D.MirrorX, // Always mirror
        cameraType: 'user' // Fixed value for consistency
      });
      
      await withTimeout(session.setSource(source), 3000);
      addLog('✅ Mirrored camera source configured');

      // High-quality AR rendering
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      await source.setRenderSize(
        settings.width || adaptiveConfig.canvas.width,
        settings.height || adaptiveConfig.canvas.height
      );
      addLog(`✅ Mirrored AR render: ${settings.width}x${settings.height}`);

      if (!lensRepositoryRef.current) {
        try {
          const lensResult: any = await withTimeout(
            cameraKit.lensRepository.loadLensGroups([adaptiveConfig.lensGroupId]), 
            5000
          );
          lensRepositoryRef.current = lensResult.lenses;
          addLog('✅ Lens repository loaded');
        } catch (lensError) {
          addLog(`⚠️ Lens loading failed: ${lensError}`);
        }
      }

      const lenses = lensRepositoryRef.current;
      if (lenses && lenses.length > 0) {
        try {
          const targetLens = lenses.find((lens: any) => lens.id === adaptiveConfig.lensId) || lenses[0];
          await withTimeout(session.applyLens(targetLens), 3000);
          addLog(`✅ Lens applied: ${targetLens.name}`);
        } catch (lensApplyError) {
          addLog(`⚠️ Lens application failed: ${lensApplyError}`);
        }
      }

      session.play('live');

      setTimeout(() => {
        if (session.output.live && containerReference.current && !isAttachedRef.current) {
          addLog('🎥 Attaching mirrored output...');
          attachCameraOutput(session.output.live, containerReference);
        }
      }, 500);

      setCameraState('ready');
      addLog('🎉 Mirrored Camera Kit complete');
      return true;

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`❌ Camera Kit error: ${errorMessage}`);
      setCameraState('error');
      return false;
    }
  }, [addLog, attachCameraOutput, cameraState]);

  const switchCamera = useCallback(async (): Promise<MediaStream | null> => {
    if (!sessionRef.current || !isInitializedRef.current) {
      addLog('❌ Cannot switch - session not initialized');
      return null;
    }

    try {
      // Toggle UI state only (doesn't affect actual camera)
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      addLog(`🔄 Refreshing camera stream (UI: ${newFacingMode})...`);

      if (sessionRef.current.output?.live) {
        sessionRef.current.pause();
        addLog('⏸️ Session paused');
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          addLog(`🛑 Stopped ${track.kind} track`);
        });
        streamRef.current = null;
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // Request new stream (no facingMode - always highest)
      const newStream = await withTimeout(
        navigator.mediaDevices.getUserMedia({
          video: { 
            // No facingMode - always get highest resolution
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
        }),
        5000
      );

      addLog(`✅ Refreshed stream obtained`);
      streamRef.current = newStream;

      const videoTracks = newStream.getVideoTracks();
      const audioTracks = newStream.getAudioTracks();
      
      if (videoTracks.length > 0) {
        const settings = videoTracks[0].getSettings();
        const resolution = `${settings.width}x${settings.height}`;
        const isLandscape = (settings.width || 0) > (settings.height || 0);
        
        addLog(`📹 Refreshed stream: ${resolution}@${settings.frameRate}fps`);
        addLog(`🔄 Orientation: ${isLandscape ? 'LANDSCAPE ✅' : 'PORTRAIT ⚠️'}`);
      }
      
      addLog(`🎤 Audio tracks: ${audioTracks.length}`);

      // ALWAYS MIRROR - no facingMode logic
      const source = createMediaStreamSource(newStream, {
        transform: Transform2D.MirrorX, // Always mirror
        cameraType: 'user' // Fixed value
      });
      
      await withTimeout(sessionRef.current.setSource(source), 3000);
      addLog('✅ Mirrored source set');

      // High-quality rendering
      const videoSettings = videoTracks[0]?.getSettings();
      if (videoSettings) {
        await source.setRenderSize(videoSettings.width || 1280, videoSettings.height || 720);
        addLog(`✅ Mirrored render: ${videoSettings.width}x${videoSettings.height}`);
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      if (sessionRef.current.output?.live) {
        sessionRef.current.play('live');
        addLog('▶️ Session resumed');
      }

      setCurrentFacingMode(newFacingMode); // UI state only
      addLog(`🎉 Camera refreshed (UI: ${newFacingMode})`);
      return newStream;
      
    } catch (error: any) {
      addLog(`❌ Camera refresh failed: ${error.message}`);
      
      try {
        if (sessionRef.current.output?.live) {
          sessionRef.current.play('live');
        }
        addLog('🔄 Restored previous state');
      } catch (recoveryError) {
        addLog(`❌ Recovery failed: ${recoveryError}`);
        setCameraState('error');
      }
      
      return null;
    }
  }, [currentFacingMode, addLog]);

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
      addLog('🔄 Stream stopped');
    }
    if (sessionRef.current) {
      sessionRef.current.pause();
      addLog('⏸️ Session paused');
    }
    isAttachedRef.current = false;
    containerRef.current = null;
    currentConfigRef.current = null;
  }, [addLog]);

  const getCanvas = useCallback(() => {
    return outputCanvasRef.current;
  }, []);

  const getStream = useCallback(() => {
    return streamRef.current;
  }, []);

  return {
    cameraState,
    currentFacingMode, // UI state only
    initializeCameraKit,
    switchCamera, // Now "refresh camera"
    reloadLens,
    pauseSession,
    resumeSession,
    cleanup,
    getCanvas,
    getStream,
    restoreCameraFeed,
    isReady: cameraState === 'ready',
    isInitializing: cameraState === 'initializing'
  };
};