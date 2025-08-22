// src/hooks/useCameraKit.ts - Adaptive resolution detection + camera rotation
import { useState, useRef, useCallback, useEffect } from 'react';
import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from '@snap/camera-kit';
import { CAMERA_KIT_CONFIG, validateConfig } from '../config/cameraKit';
import type { CameraState } from './useCameraPermissions';

// Resolution detection utilities
const detectMaxCameraResolution = async (
  facingMode: 'user' | 'environment' = 'user',
  addLog: (msg: string) => void
): Promise<{ width: number; height: number; fps: number }> => {
  const presets = [
    { width: 3840, height: 2160, name: '4K' },
    { width: 2560, height: 1440, name: '1440p' },
    { width: 1920, height: 1080, name: '1080p' },
    { width: 1280, height: 720, name: '720p' }
  ];
  
  for (const preset of presets) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: preset.width },
          height: { ideal: preset.height },
          frameRate: { ideal: 30 }
        }
      });
      
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      stream.getTracks().forEach(t => t.stop());
      
      const result = {
        width: settings.width || preset.width,
        height: settings.height || preset.height,
        fps: settings.frameRate || 30
      };
      
      addLog(`✅ Max camera: ${result.width}x${result.height}@${result.fps}fps (${preset.name})`);
      return result;
    } catch (error) {
      addLog(`❌ ${preset.name} (${preset.width}x${preset.height}) not supported`);
    }
  }
  
  return { width: 1280, height: 720, fps: 30 };
};

const detectMaxDisplayResolution = (addLog: (msg: string) => void) => {
  const dpr = window.devicePixelRatio || 1;
  const physical = {
    width: window.screen.width * dpr,
    height: window.screen.height * dpr
  };
  
  const presets = [
    { width: 3840, height: 2160, name: '4K' },
    { width: 2560, height: 1440, name: '1440p' },
    { width: 1920, height: 1080, name: '1080p' }
  ];
  
  addLog(`📱 Physical screen: ${physical.width}x${physical.height} (DPR: ${dpr})`);
  
  for (const preset of presets) {
    if (physical.width >= preset.width && physical.height >= preset.height) {
      addLog(`✅ Max display: ${preset.width}x${preset.height} (${preset.name})`);
      return preset;
    }
  }
  
  return { width: 1920, height: 1080, name: 'HD' };
};

const needsCameraRotation = (): boolean => {
  return /brio|logitech/i.test(navigator.userAgent) || 
         window.location.search.includes('rotate=true');
};

// Singleton Camera Kit instance
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
        apiToken: CAMERA_KIT_CONFIG.apiToken 
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

// Start preloading
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
  const resolutionConfigRef = useRef<any>(null);

  // Adaptive canvas attachment with auto-rotation
  const attachCameraOutput = useCallback((
    canvas: HTMLCanvasElement, 
    containerReference: React.RefObject<HTMLDivElement>
  ) => {
    if (!containerReference.current) {
      addLog('❌ Camera feed container not available');
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
        
        // Canvas managed by Camera Kit
        addLog(`📊 Canvas: ${canvas.width}x${canvas.height} (Camera Kit controlled)`);
        
        // Detect orientation and rotation
        const isPortrait = window.innerHeight > window.innerWidth;
        const needsRotation = needsCameraRotation();
        const orientation = isPortrait ? 'portrait' : 'landscape';
        
        addLog(`📱 Display: ${orientation} (${window.innerWidth}x${window.innerHeight})`);
        addLog(`🔄 Camera rotation: ${needsRotation ? 'YES (90°)' : 'NO'}`);
        
        // CSS with optional rotation
        const rotationTransform = needsRotation ? 'rotate(90deg)' : '';
        
        canvas.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center;
          background: transparent;
          image-rendering: crisp-edges;
          transform: translateZ(0) ${rotationTransform};
          will-change: transform;
          backface-visibility: hidden;
          max-width: 100vw;
          max-height: 100vh;
        `;
        
        canvas.className = 'absolute inset-0 w-full h-full object-contain';
        
        // Container styling
        const container = containerReference.current;
        container.style.cssText = `
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
          container.appendChild(canvas);
          isAttachedRef.current = true;
          
          const rect = container.getBoundingClientRect();
          addLog(`✅ Canvas attached (${orientation}${needsRotation ? ', rotated' : ''}): ${Math.round(rect.width)}x${Math.round(rect.height)}`);
        } catch (e) {
          addLog(`❌ Canvas attachment failed: ${e}`);
        }
      });
    } catch (error) {
      addLog(`❌ Canvas attachment error: ${error}`);
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
      if (lenses && lenses.length > 0) {
        const targetLens = lenses.find((lens: any) => lens.id === CAMERA_KIT_CONFIG.lensId) || lenses[0];
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
      // Re-initialization check
      if (isInitializedRef.current && sessionRef.current && cameraState === 'ready') {
        addLog('📱 Updating existing session...');
        
        const source = createMediaStreamSource(stream, {
          transform: currentFacingMode === 'user' ? Transform2D.MirrorX : undefined,
          cameraType: currentFacingMode
        });
        
        await withTimeout(sessionRef.current.setSource(source), 3000);
        
        // Use cached resolution config
        const config = resolutionConfigRef.current;
        if (config) {
          await source.setRenderSize(config.display.width, config.display.height);
          addLog(`✅ AR render: ${config.display.width}x${config.display.height}`);
        }
        
        streamRef.current = stream;
        containerRef.current = containerReference;
        
        if (sessionRef.current.output?.live && containerReference.current && !isAttachedRef.current) {
          setTimeout(() => {
            if (sessionRef.current.output.live) {
              attachCameraOutput(sessionRef.current.output.live, containerReference);
            }
          }, 100);
        }
        
        addLog('✅ Stream updated');
        return true;
      }

      addLog('🎭 Initializing Camera Kit with adaptive resolution...');
      setCameraState('initializing');
      containerRef.current = containerReference;

      // Detect maximum capabilities
      const [maxCamera, maxDisplay] = await Promise.all([
        detectMaxCameraResolution(currentFacingMode, addLog),
        Promise.resolve(detectMaxDisplayResolution(addLog))
      ]);

      // Cache resolution config
      resolutionConfigRef.current = { camera: maxCamera, display: maxDisplay };

      // Bootstrap Camera Kit
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

      // Create source
      const source = createMediaStreamSource(stream, {
        transform: currentFacingMode === 'user' ? Transform2D.MirrorX : undefined,
        cameraType: currentFacingMode
      });
      
      await withTimeout(session.setSource(source), 3000);
      addLog('✅ Camera source configured');

      // Set render size based on detected display capability
      await source.setRenderSize(maxDisplay.width, maxDisplay.height);
      addLog(`✅ AR render: ${maxDisplay.width}x${maxDisplay.height} (${maxDisplay.name})`);

      // Load lens repository
      if (!lensRepositoryRef.current) {
        try {
          const lensResult: any = await withTimeout(
            cameraKit.lensRepository.loadLensGroups([CAMERA_KIT_CONFIG.lensGroupId]), 
            5000
          );
          lensRepositoryRef.current = lensResult.lenses;
          addLog('✅ Lens repository loaded');
        } catch (lensError) {
          addLog(`⚠️ Lens loading failed: ${lensError}`);
        }
      }

      // Apply lens
      const lenses = lensRepositoryRef.current;
      if (lenses && lenses.length > 0) {
        try {
          const targetLens = lenses.find((lens: any) => lens.id === CAMERA_KIT_CONFIG.lensId) || lenses[0];
          await withTimeout(session.applyLens(targetLens), 3000);
          addLog(`✅ Lens applied: ${targetLens.name}`);
        } catch (lensApplyError) {
          addLog(`⚠️ Lens application failed: ${lensApplyError}`);
        }
      }

      // Start session
      session.play('live');

      // Attach output
      setTimeout(() => {
        if (session.output.live && containerReference.current && !isAttachedRef.current) {
          addLog('🎥 Attaching Camera Kit output...');
          attachCameraOutput(session.output.live, containerReference);
        }
      }, 500);

      setCameraState('ready');
      addLog('🎉 Camera Kit initialization complete');
      return true;

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`❌ Camera Kit error: ${errorMessage}`);
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
      addLog(`🔄 Switching to ${newFacingMode} camera...`);

      // Pause session
      if (sessionRef.current.output?.live) {
        sessionRef.current.pause();
        addLog('⏸️ Session paused');
      }

      // Stop current stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          addLog(`🛑 Stopped ${track.kind} track`);
        });
        streamRef.current = null;
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // Get maximum resolution for new camera
      const maxCamera = await detectMaxCameraResolution(newFacingMode, addLog);
      
      const newStream = await withTimeout(
        navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: newFacingMode,
            width: { ideal: maxCamera.width, min: 1280 },
            height: { ideal: maxCamera.height, min: 720 },
            frameRate: { ideal: 30 }
          },
          audio: true
        }),
        5000
      );

      addLog(`✅ New ${newFacingMode} stream obtained`);
      streamRef.current = newStream;

      // Set source
      const source = createMediaStreamSource(newStream, {
        transform: newFacingMode === 'user' ? Transform2D.MirrorX : undefined,
        cameraType: newFacingMode
      });
      
      await withTimeout(sessionRef.current.setSource(source), 3000);
      addLog('✅ Source set');

      // Apply render size
      const config = resolutionConfigRef.current;
      if (config) {
        await source.setRenderSize(config.display.width, config.display.height);
        addLog(`✅ AR render: ${config.display.width}x${config.display.height}`);
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      // Resume session
      if (sessionRef.current.output?.live) {
        sessionRef.current.play('live');
        addLog('▶️ Session resumed');
      }

      setCurrentFacingMode(newFacingMode);
      addLog(`🎉 Camera switched to ${newFacingMode}`);
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