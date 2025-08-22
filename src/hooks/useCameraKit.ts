// src/hooks/useCameraKit.ts - MAX QUALITY: Hardware Landscape → Software Portrait
import { useState, useRef, useCallback, useEffect } from 'react';
import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from '@snap/camera-kit';
import { createMaxPortraitCameraKitConfig, validateConfig } from '../config/cameraKit';
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
  const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>('user');
  
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
        addLog(`📊 MAX Canvas: ${canvas.width}x${canvas.height} (${canvas.width >= 1440 ? 'MAX QUALITY' : 'SCALED'})`);
        
        // Perfect fit untuk max quality portrait
        const containerRect = containerReference.current.getBoundingClientRect();
        const canvasAspect = canvas.width / canvas.height;
        const containerAspect = containerRect.width / containerRect.height;
        
        let displayWidth, displayHeight;
        // Cover fit untuk max quality (bukan contain)
        if (canvasAspect > containerAspect) {
          displayHeight = containerRect.height;
          displayWidth = containerRect.height * canvasAspect;
        } else {
          displayWidth = containerRect.width;
          displayHeight = containerRect.width / canvasAspect;
        }
        
        // MAX QUALITY CSS - ANTI-PIXELATED
        canvas.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          width: ${displayWidth}px;
          height: ${displayHeight}px;
          transform: translate(-50%, -50%);
          object-fit: cover;
          object-position: center;
          background: transparent;
          image-rendering: auto;
          image-rendering: -webkit-optimize-contrast;
          image-rendering: smooth;
          will-change: transform;
          backface-visibility: hidden;
          filter: none;
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
          const qualityIndicator = canvas.width >= 1440 ? '4K PORTRAIT' : '1080p PORTRAIT';
          addLog(`✅ ${qualityIndicator} attached - Scale: ${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`);
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
      addLog('🔄 Restoring MAX quality camera feed...');
      
      const isCanvasAttached = containerRef.current.current.contains(outputCanvasRef.current);
      
      if (!isCanvasAttached) {
        addLog('📱 Re-attaching MAX quality canvas');
        attachCameraOutput(outputCanvasRef.current, containerRef.current);
      }
      
      if (sessionRef.current.output?.live) {
        try {
          sessionRef.current.play('live');
          addLog('▶️ MAX quality session resumed');
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
      addLog('🔄 Restarting MAX quality AR lens...');
      
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
        addLog(`✅ MAX quality lens restarted: ${targetLens.name}`);
      }
      
      sessionRef.current.play('live');
      
      setTimeout(() => {
        restoreCameraFeed();
      }, 300);
      
      addLog('🎉 MAX quality AR lens restarted');
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
        addLog('👁️ App visible - checking MAX quality camera...');
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
      // MAX QUALITY CONFIG: Hardware 2560x1440 → Portrait 1440x2560
      const maxPortraitConfig = createMaxPortraitCameraKitConfig();
      currentConfigRef.current = maxPortraitConfig;
      
      // Log quality info
      const qualityMode = maxPortraitConfig.canvas.width >= 1440 ? 'MAX QUALITY' : 'SCALED';
      const pixels = maxPortraitConfig.canvas.width * maxPortraitConfig.canvas.height;
      const gain = ((pixels / (1080 * 1920)) * 100).toFixed(0);
      
      addLog(`🚀 ${qualityMode}: ${maxPortraitConfig.canvas.width}x${maxPortraitConfig.canvas.height}`);
      addLog(`📊 Quality gain: ${gain}% vs 1080p (${(pixels / 1000000).toFixed(1)}MP)`);
      
      if (isInitializedRef.current && sessionRef.current && cameraState === 'ready') {
        addLog('📱 Updating existing MAX quality session...');
        
        const source = createMediaStreamSource(stream, {
          transform: currentFacingMode === 'user' ? Transform2D.MirrorX : undefined,
          cameraType: currentFacingMode
        });
        
        await withTimeout(sessionRef.current.setSource(source), 3000);
        await source.setRenderSize(maxPortraitConfig.canvas.width, maxPortraitConfig.canvas.height);
        addLog(`✅ MAX portrait render: ${maxPortraitConfig.canvas.width}x${maxPortraitConfig.canvas.height}`);
        
        streamRef.current = stream;
        containerRef.current = containerReference;
        
        if (sessionRef.current.output?.live && containerReference.current && !isAttachedRef.current) {
          setTimeout(() => {
            if (sessionRef.current.output.live) {
              attachCameraOutput(sessionRef.current.output.live, containerReference);
            }
          }, 100);
        }
        
        addLog('✅ MAX quality stream updated');
        return true;
      }

      addLog('🎭 Initializing MAX QUALITY Camera Kit...');
      addLog(`📐 Rotated canvas: ${maxPortraitConfig.canvas.width}x${maxPortraitConfig.canvas.height} (landscape→portrait)`);
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

      addLog('🎬 Creating MAX quality session...');
      const session: any = await withTimeout(cameraKit.createSession(), 5000);
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
      
      await withTimeout(session.setSource(source), 3000);
      addLog('✅ Hardware landscape camera source configured');

      // CRITICAL: Set MAX portrait render size (rotated dari landscape)
      await source.setRenderSize(maxPortraitConfig.canvas.width, maxPortraitConfig.canvas.height);
      addLog(`✅ MAX portrait AR render: ${maxPortraitConfig.canvas.width}x${maxPortraitConfig.canvas.height} (rotated!)`);

      if (!lensRepositoryRef.current) {
        try {
          const lensResult: any = await withTimeout(
            cameraKit.lensRepository.loadLensGroups([maxPortraitConfig.lensGroupId]), 
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
          const targetLens = lenses.find((lens: any) => lens.id === maxPortraitConfig.lensId) || lenses[0];
          await withTimeout(session.applyLens(targetLens), 3000);
          addLog(`✅ MAX quality lens applied: ${targetLens.name}`);
        } catch (lensApplyError) {
          addLog(`⚠️ Lens application failed: ${lensApplyError}`);
        }
      }

      session.play('live');

      setTimeout(() => {
        if (session.output.live && containerReference.current && !isAttachedRef.current) {
          addLog('🎥 Attaching MAX quality output...');
          attachCameraOutput(session.output.live, containerReference);
        }
      }, 500);

      setCameraState('ready');
      addLog(`🎉 MAX QUALITY Camera Kit complete - ${qualityMode}!`);
      return true;

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`❌ MAX quality Camera Kit error: ${errorMessage}`);
      setCameraState('error');
      return false;
    }
  }, [currentFacingMode, addLog, attachCameraOutput, cameraState]);

  const switchCamera = useCallback(async (): Promise<MediaStream | null> => {
    if (!sessionRef.current || !isInitializedRef.current) {
      addLog('❌ Cannot switch - session not initialized');
      return null;
    }

    try {
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      addLog(`🔄 Switching to ${newFacingMode} camera (MAX quality)...`);

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

      // LANDSCAPE constraints for MAX quality (hardware optimal)
      const newStream = await withTimeout(
        navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: newFacingMode,
            // Request LANDSCAPE untuk MAX quality
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

      addLog(`✅ New ${newFacingMode} MAX quality stream obtained`);
      streamRef.current = newStream;

      // Log stream quality
      const videoTracks = newStream.getVideoTracks();
      const audioTracks = newStream.getAudioTracks();
      
      if (videoTracks.length > 0) {
        const settings = videoTracks[0].getSettings();
        const resolution = `${settings.width}x${settings.height}`;
        const isLandscape = (settings.width || 0) > (settings.height || 0);
        const isMaxQuality = (settings.width || 0) >= 2560;
        
        addLog(`📹 New stream: ${resolution}@${settings.frameRate}fps`);
        addLog(`🔄 Orientation: ${isLandscape ? 'LANDSCAPE ✅' : 'PORTRAIT ⚠️'}`);
        addLog(`🚀 Quality: ${isMaxQuality ? 'MAX QUALITY ✅' : 'STANDARD'}`);
        
        if (!isLandscape) {
          addLog(`⚠️ Expected landscape, got portrait - browser may have auto-rotated`);
        }
      }
      
      addLog(`🎤 Audio tracks: ${audioTracks.length}`);

      const source = createMediaStreamSource(newStream, {
        transform: newFacingMode === 'user' ? Transform2D.MirrorX : undefined,
        cameraType: newFacingMode
      });
      
      await withTimeout(sessionRef.current.setSource(source), 3000);
      addLog('✅ Source set');

      const config = currentConfigRef.current;
      if (config) {
        await source.setRenderSize(config.canvas.width, config.canvas.height);
        addLog(`✅ MAX portrait render: ${config.canvas.width}x${config.canvas.height} (rotated)`);
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      if (sessionRef.current.output?.live) {
        sessionRef.current.play('live');
        addLog('▶️ MAX quality session resumed');
      }

      setCurrentFacingMode(newFacingMode);
      addLog(`🎉 Camera switched to ${newFacingMode} (MAX QUALITY)`);
      return newStream;
      
    } catch (error: any) {
      addLog(`❌ Camera switch failed: ${error.message}`);
      
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
      addLog('⏸️ MAX quality session paused');
    }
  }, [addLog]);

  const resumeSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.play('live');
      addLog('▶️ MAX quality session resumed');
    }
  }, [addLog]);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      addLog('🔄 MAX quality stream stopped');
    }
    if (sessionRef.current) {
      sessionRef.current.pause();
      addLog('⏸️ MAX quality session paused');
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
    currentFacingMode,
    initializeCameraKit,
    switchCamera,
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