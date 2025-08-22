// src/hooks/useCameraKit.ts - Fixed 4K with proper scaling
import { useState, useRef, useCallback, useEffect } from 'react';
import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from '@snap/camera-kit';
import { CAMERA_KIT_CONFIG, validateConfig } from '../config/cameraKit';
import type { CameraState } from './useCameraPermissions';

// Fixed 4K configuration
const FIXED_4K_CONFIG = {
  canvas: { width: 3840, height: 2160 },
  render: { width: 1920, height: 1080 },
  aspectRatio: 16 / 9
};

// Singleton instance
let cameraKitInstance: any = null;
let preloadPromise: Promise<any> | null = null;

// Timeout wrapper
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timeout after ${ms}ms`)), ms)
    )
  ]);
};

const preloadCameraKit = async () => {
  if (cameraKitInstance) return cameraKitInstance;
  if (preloadPromise) return preloadPromise;
  
  preloadPromise = (async () => {
    try {
      console.log('🚀 Preloading Camera Kit...');
      
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        throw new Error('HTTPS_REQUIRED');
      }
      
      validateConfig();
      cameraKitInstance = await bootstrapCameraKit({ 
        apiToken: CAMERA_KIT_CONFIG.apiToken 
      });
      
      console.log('✅ Camera Kit preloaded');
      return cameraKitInstance;
    } catch (error) {
      console.error('❌ Failed to preload Camera Kit:', error);
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

  // Fixed 4K Canvas attachment with portrait optimization
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
        
        // Don't resize - Camera Kit controls canvas dimensions
        // Canvas is managed by Camera Kit after transferControlToOffscreen()
        addLog(`📊 Canvas dimensions: ${canvas.width}x${canvas.height} (Camera Kit controlled)`);
        
        // Detect orientation
        const isPortrait = window.innerHeight > window.innerWidth;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const orientation = isPortrait ? 'portrait' : 'landscape';
        
        addLog(`📱 Orientation: ${orientation} (${viewportWidth}x${viewportHeight})`);
        
        // Portrait-optimized 4K scaling CSS
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
          image-rendering: -webkit-optimize-contrast;
          transform: translateZ(0);
          will-change: transform;
          backface-visibility: hidden;
          max-width: 100vw;
          max-height: 100vh;
        `;
        
        canvas.className = 'absolute inset-0 w-full h-full object-contain';
        
        // Portrait-aware container styling
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
          addLog(`✅ 4K Canvas attached (${orientation}): ${canvas.width}x${canvas.height} → ${Math.round(rect.width)}x${Math.round(rect.height)}`);
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
      addLog('🔄 Restoring 4K camera feed...');
      
      const isCanvasAttached = containerRef.current.current.contains(outputCanvasRef.current);
      
      if (!isCanvasAttached) {
        addLog('📱 Re-attaching 4K canvas after app return');
        attachCameraOutput(outputCanvasRef.current, containerRef.current);
      }
      
      if (sessionRef.current.output?.live) {
        try {
          sessionRef.current.play('live');
          addLog('▶️ Camera Kit session resumed');
        } catch (error) {
          addLog(`⚠️ Session resume error: ${error}`);
        }
      }
    }
  }, [addLog, attachCameraOutput]);

  const reloadLens = useCallback(async (): Promise<boolean> => {
    if (!sessionRef.current || !isInitializedRef.current) {
      addLog('❌ Cannot reload lens - session not ready');
      return false;
    }

    try {
      addLog('🔄 Hard restarting AR lens...');
      
      sessionRef.current.pause();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      try {
        await withTimeout(sessionRef.current.removeLens(), 2000);
        addLog('🗑️ Current lens removed');
      } catch (removeError) {
        addLog(`⚠️ Lens removal failed, continuing anyway: ${removeError}`);
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
      
      addLog('🎉 AR lens hard restarted successfully');
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
        addLog('👁️ App became visible, checking 4K camera feed...');
        setTimeout(() => {
          restoreCameraFeed();
        }, 100);
      } else {
        addLog('🙈 App backgrounded');
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
        addLog('📱 Camera Kit already initialized, updating stream...');
        
        const source = createMediaStreamSource(stream, {
          transform: currentFacingMode === 'user' ? Transform2D.MirrorX : undefined,
          cameraType: currentFacingMode
        });
        
        await withTimeout(sessionRef.current.setSource(source), 3000);
        
        // HD render size for AR processing (4K display)
        await source.setRenderSize(FIXED_4K_CONFIG.render.width, FIXED_4K_CONFIG.render.height);
        addLog(`✅ AR render size: ${FIXED_4K_CONFIG.render.width}x${FIXED_4K_CONFIG.render.height} (processing), display: 4K`);
        
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

      addLog('🎭 Initializing Camera Kit with fixed 4K...');
      setCameraState('initializing');
      containerRef.current = containerReference;

      // Bootstrap Camera Kit
      let cameraKit = cameraKitInstance;
      if (!cameraKit) {
        addLog('Camera Kit not preloaded, bootstrapping now...');
        try {
          cameraKit = await withTimeout(preloadCameraKit(), 10000);
        } catch (ckError: any) {
          addLog(`❌ Camera Kit bootstrap failed: ${ckError.message}`);
          setCameraState('error');
          return false;
        }
      }
      
      if (!cameraKit) {
        throw new Error('Failed to initialize Camera Kit instance');
      }

      addLog('🎬 Creating Camera Kit session...');
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

      // AR processing in HD, display upscaled to 4K
      await source.setRenderSize(FIXED_4K_CONFIG.render.width, FIXED_4K_CONFIG.render.height);
      addLog(`✅ AR render size: ${FIXED_4K_CONFIG.render.width}x${FIXED_4K_CONFIG.render.height} (processing), display: 4K`);

      // Load lens repository
      if (!lensRepositoryRef.current) {
        try {
          const lensResult: any = await withTimeout(
            cameraKit.lensRepository.loadLensGroups([CAMERA_KIT_CONFIG.lensGroupId]), 
            5000
          );
          lensRepositoryRef.current = lensResult.lenses;
          addLog('✅ Lens repository cached');
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
          addLog(`✅ 4K Lens applied: ${targetLens.name}`);
        } catch (lensApplyError) {
          addLog(`⚠️ Lens application failed: ${lensApplyError}`);
        }
      }

      // Start session
      session.play('live');

      // Attach 4K output with extended delay
      setTimeout(() => {
        if (session.output.live && containerReference.current && !isAttachedRef.current) {
          addLog('🎥 Attaching 4K Camera Kit output...');
          attachCameraOutput(session.output.live, containerReference);
        } else {
          addLog(`❌ Output attachment failed: live=${!!session.output.live}, container=${!!containerReference.current}, attached=${isAttachedRef.current}`);
        }
      }, 500);

      setCameraState('ready');
      addLog('🎉 Fixed 4K Camera Kit initialization complete');
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
      addLog('❌ Cannot switch camera - session not initialized');
      return null;
    }

    try {
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      addLog(`🔄 Switching to ${newFacingMode} camera with 4K...`);

      // Pause session
      if (sessionRef.current.output?.live) {
        sessionRef.current.pause();
        addLog('⏸️ Session paused for switch');
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

      // Get new 4K stream
      addLog(`📹 Requesting ${newFacingMode} camera for 4K...`);
      
      const newStream = await withTimeout(
        navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: newFacingMode,
            width: { ideal: 3840, min: 1280 },
            height: { ideal: 2160, min: 720 },
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
      addLog('✅ Source set successfully');

      // Apply HD render size for AR processing
      await source.setRenderSize(FIXED_4K_CONFIG.render.width, FIXED_4K_CONFIG.render.height);
      addLog(`✅ AR render size: ${FIXED_4K_CONFIG.render.width}x${FIXED_4K_CONFIG.render.height} (processing), display: 4K`);

      await new Promise(resolve => setTimeout(resolve, 300));

      // Resume session
      if (sessionRef.current.output?.live) {
        sessionRef.current.play('live');
        addLog('▶️ Session resumed');
      }

      setCurrentFacingMode(newFacingMode);
      addLog(`🎉 Camera switched to ${newFacingMode} with 4K quality`);
      return newStream;
      
    } catch (error: any) {
      addLog(`❌ Camera switch failed: ${error.message}`);
      
      try {
        if (sessionRef.current.output?.live) {
          sessionRef.current.play('live');
        }
        addLog('🔄 Restored previous camera state');
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
      addLog('⏸️ Camera Kit session paused');
    }
  }, [addLog]);

  const resumeSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.play('live');
      addLog('▶️ Camera Kit session resumed');
    }
  }, [addLog]);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      addLog('🔄 Camera stream stopped');
    }
    if (sessionRef.current) {
      sessionRef.current.pause();
      addLog('⏸️ Camera Kit session paused');
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