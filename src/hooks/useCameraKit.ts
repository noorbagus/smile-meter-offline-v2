// src/hooks/useCameraKit.ts - Fixed camera switching without re-initialization
import { useState, useRef, useCallback, useEffect } from 'react';
import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from '@snap/camera-kit';
import { CAMERA_KIT_CONFIG, validateConfig } from '../config/cameraKit';
import type { CameraState } from './useCameraPermissions';

// Singleton instance
let cameraKitInstance: any = null;
let preloadPromise: Promise<any> | null = null;

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
      // FIXED: Prevent re-initialization if already done
      if (isInitializedRef.current && sessionRef.current && cameraState === 'ready') {
        addLog('📱 Camera Kit already initialized, updating stream only...');
        
        // Just update the stream source
        const source = createMediaStreamSource(stream);
        await sessionRef.current.setSource(source);
        
        if (currentFacingMode === 'user') {
          source.setTransform(Transform2D.MirrorX);
        }
        
        streamRef.current = stream;
        containerRef.current = containerReference;
        
        // Re-attach canvas if needed
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

      // Get or bootstrap Camera Kit (only once)
      let cameraKit = cameraKitInstance;
      if (!cameraKit) {
        addLog('Camera Kit not preloaded, bootstrapping now...');
        try {
          cameraKit = await preloadCameraKit();
        } catch (ckError: any) {
          addLog(`❌ Camera Kit bootstrap failed: ${ckError.message}`);
          setCameraState('error');
          return false;
        }
      }
      
      if (!cameraKit) {
        throw new Error('Failed to initialize Camera Kit instance');
      }

      // Create session (only first time)
      addLog('🎬 Creating Camera Kit session...');
      const session = await cameraKit.createSession();
      sessionRef.current = session;
      streamRef.current = stream;
      isInitializedRef.current = true;
      
      session.events.addEventListener("error", (event: any) => {
        addLog(`❌ Session error: ${event.detail}`);
        setCameraState('error');
      });

      // Configure camera source
      const source = createMediaStreamSource(stream);
      await session.setSource(source);
      
      if (currentFacingMode === 'user') {
        source.setTransform(Transform2D.MirrorX);
      }
      addLog('✅ Camera source configured');

      // Load lens (cache for reuse)
      if (!lensRepositoryRef.current) {
        try {
          const { lenses } = await cameraKit.lensRepository.loadLensGroups([
            CAMERA_KIT_CONFIG.lensGroupId
          ]);
          lensRepositoryRef.current = lenses;
          addLog('✅ Lens repository cached');
        } catch (lensError) {
          addLog(`⚠️ Lens loading failed: ${lensError}`);
        }
      }

      const lenses = lensRepositoryRef.current;
      if (lenses && lenses.length > 0) {
        try {
          const targetLens = lenses.find((lens: any) => lens.id === CAMERA_KIT_CONFIG.lensId) || lenses[0];
          await session.applyLens(targetLens);
          addLog(`✅ Lens applied: ${targetLens.name}`);
        } catch (lensApplyError) {
          addLog(`⚠️ Lens application failed: ${lensApplyError}`);
        }
      }

      // Start session
      session.play('live');

      // Attach to DOM with delay
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
    // FIXED: Don't re-initialize, just update stream source
    if (!sessionRef.current || !isInitializedRef.current) {
      addLog('❌ Cannot switch camera - session not initialized');
      return null;
    }

    try {
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      addLog(`🔄 Switching to ${newFacingMode} camera (reusing session)`);

      // Stop current stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Get new stream
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: newFacingMode,
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        },
        audio: true
      });
      
      streamRef.current = newStream;
      
      // FIXED: Update existing session source instead of creating new session
      const source = createMediaStreamSource(newStream);
      await sessionRef.current.setSource(source);
      
      if (newFacingMode === 'user') {
        source.setTransform(Transform2D.MirrorX);
      }
      
      // Resume session if needed
      if (sessionRef.current.output?.live) {
        sessionRef.current.play('live');
      }
      
      setCurrentFacingMode(newFacingMode);
      addLog(`✅ Switched to ${newFacingMode} camera (session reused)`);
      return newStream;
      
    } catch (error) {
      addLog(`❌ Camera switch failed: ${error}`);
      setCameraState('error');
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
    // Don't reset isInitializedRef - keep session for reuse
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