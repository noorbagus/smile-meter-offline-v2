// src/hooks/useCameraKit.ts - Fixed with timeout protection and proper state management
import { useState, useRef, useCallback, useEffect } from 'react';
import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from '@snap/camera-kit';
import { CAMERA_KIT_CONFIG, validateConfig } from '../config/cameraKit';
import type { CameraState } from './useCameraPermissions';

// Singleton instance
let cameraKitInstance: any = null;
let preloadPromise: Promise<any> | null = null;

// Timeout wrapper to prevent hanging operations
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

// Start preloading immediately
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

        // Safe DOM cleanup
        while (containerReference.current.firstChild) {
          try {
            containerReference.current.removeChild(containerReference.current.firstChild);
          } catch (e) {
            break;
          }
        }
        
        outputCanvasRef.current = canvas;
        canvas.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          inset: 0;
          background: transparent;
        `;
        canvas.className = 'absolute inset-0 w-full h-full object-cover';
        
        try {
          containerReference.current.appendChild(canvas);
          isAttachedRef.current = true;
          addLog('✅ Camera output attached successfully');
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
        addLog('📱 Re-attaching canvas after app return');
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

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        addLog('👁️ App became visible, checking camera feed...');
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
      // Prevent re-initialization if already done
      if (isInitializedRef.current && sessionRef.current && cameraState === 'ready') {
        addLog('📱 Camera Kit already initialized, updating stream only...');
        
        const source = createMediaStreamSource(stream);
        await withTimeout(sessionRef.current.setSource(source), 3000);
        
        if (currentFacingMode === 'user') {
          source.setTransform(Transform2D.MirrorX);
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
        
        addLog('✅ Stream updated without re-initialization');
        return true;
      }

      addLog('🎭 Initializing Camera Kit...');
      setCameraState('initializing');
      containerRef.current = containerReference;

      // Get or bootstrap Camera Kit
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

      const source = createMediaStreamSource(stream);
      await withTimeout(session.setSource(source), 3000);
      
      if (currentFacingMode === 'user') {
        source.setTransform(Transform2D.MirrorX);
      }
      addLog('✅ Camera source configured');

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

      session.play('live');

      setTimeout(() => {
        if (session.output.live && containerReference.current && !isAttachedRef.current) {
          attachCameraOutput(session.output.live, containerReference);
        }
      }, 100);

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
      addLog('❌ Cannot switch camera - session not initialized');
      return null;
    }

    try {
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      addLog(`🔄 Switching to ${newFacingMode} camera with timeout protection...`);

      // Step 1: Pause session
      if (sessionRef.current.output?.live) {
        sessionRef.current.pause();
        addLog('⏸️ Session paused for switch');
      }

      // Step 2: Stop current stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          addLog(`🛑 Stopped ${track.kind} track`);
        });
        streamRef.current = null;
      }

      // Step 3: Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 200));

      // Step 4: Get new stream with timeout
      addLog(`📹 Requesting ${newFacingMode} camera...`);
      const newStream = await withTimeout(
        navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: newFacingMode,
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 }
          },
          audio: true
        }),
        5000
      );

      addLog(`✅ New ${newFacingMode} stream obtained`);
      streamRef.current = newStream;

      // Step 5: Set source with timeout
      const source = createMediaStreamSource(newStream);
      await withTimeout(sessionRef.current.setSource(source), 3000);
      addLog('✅ Source set successfully');

      // Step 6: Apply transform if needed
      if (newFacingMode === 'user') {
        try {
          source.setTransform(Transform2D.MirrorX);
          addLog('🪞 Mirror transform applied');
        } catch (transformError) {
          addLog(`⚠️ Transform failed: ${transformError}`);
        }
      }

      // Step 7: Wait before resuming
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 8: Resume session
      if (sessionRef.current.output?.live) {
        sessionRef.current.play('live');
        addLog('▶️ Session resumed');
      }

      // Step 9: Update state
      setCurrentFacingMode(newFacingMode);
      addLog(`🎉 Camera switched to ${newFacingMode} successfully`);
      return newStream;
      
    } catch (error: any) {
      addLog(`❌ Camera switch failed: ${error.message}`);
      
      // Recovery: Try to restore previous state
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