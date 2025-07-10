// src/hooks/useCameraKit.ts - Fixed with camera feed restoration
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

  // FIXED: Camera feed restoration on app return
  const restoreCameraFeed = useCallback(() => {
    if (sessionRef.current && outputCanvasRef.current && containerRef.current?.current) {
      addLog('🔄 Restoring camera feed...');
      
      // Check if canvas is still attached
      const isCanvasAttached = containerRef.current.current.contains(outputCanvasRef.current);
      
      if (!isCanvasAttached) {
        addLog('📱 Re-attaching canvas after app return');
        attachCameraOutput(outputCanvasRef.current, containerRef.current);
      }
      
      // Resume session if paused
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

  // FIXED: Page visibility handler for camera restoration
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        addLog('👁️ App became visible, checking camera feed...');
        
        // Delay to ensure DOM is ready
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
      addLog('🎭 Initializing Camera Kit...');
      setCameraState('initializing');

      // Store container reference for restoration
      containerRef.current = containerReference;

      // Get or bootstrap Camera Kit
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

      // Create session
      addLog('🎬 Creating Camera Kit session...');
      const session = await cameraKit.createSession();
      sessionRef.current = session;
      streamRef.current = stream;
      
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

      // Load lens
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
  }, [currentFacingMode, addLog, attachCameraOutput]);

  const switchCamera = useCallback(async (): Promise<MediaStream | null> => {
    if (!sessionRef.current || cameraState !== 'ready') {
      addLog('❌ Cannot switch camera - session not ready');
      return null;
    }

    try {
      setCameraState('initializing');
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      
      addLog(`🔄 Switching to ${newFacingMode} camera`);

      sessionRef.current.pause();
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: newFacingMode,
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        },
        audio: true
      });
      
      streamRef.current = newStream;
      
      const source = createMediaStreamSource(newStream);
      await sessionRef.current.setSource(source);
      
      if (newFacingMode === 'user') {
        source.setTransform(Transform2D.MirrorX);
      }
      
      sessionRef.current.play('live');
      setCurrentFacingMode(newFacingMode);
      setCameraState('ready');
      
      addLog(`✅ Switched to ${newFacingMode} camera`);
      return newStream;
      
    } catch (error) {
      addLog(`❌ Camera switch failed: ${error}`);
      setCameraState('error');
      return null;
    }
  }, [currentFacingMode, cameraState, addLog]);

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
    restoreCameraFeed, // NEW: Manual restore function
    isReady: cameraState === 'ready',
    isInitializing: cameraState === 'initializing'
  };
};