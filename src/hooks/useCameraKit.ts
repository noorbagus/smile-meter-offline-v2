// src/hooks/useCameraKit.ts
import { useState, useRef, useCallback } from 'react';
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

  const attachCameraOutput = useCallback((
    canvas: HTMLCanvasElement, 
    containerRef: React.RefObject<HTMLDivElement>
  ) => {
    if (!containerRef.current) {
      addLog('❌ Camera feed container not available');
      return;
    }

    try {
      requestAnimationFrame(() => {
        if (!containerRef.current) return;

        // Safe DOM cleanup
        while (containerRef.current.firstChild) {
          try {
            containerRef.current.removeChild(containerRef.current.firstChild);
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
          containerRef.current.appendChild(canvas);
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

  const initializeCameraKit = useCallback(async (
    stream: MediaStream,
    containerRef: React.RefObject<HTMLDivElement>
  ): Promise<boolean> => {
    try {
      addLog('🎭 Initializing Camera Kit...');
      setCameraState('initializing');

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
        if (session.output.live && containerRef.current && !isAttachedRef.current) {
          attachCameraOutput(session.output.live, containerRef);
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
    isReady: cameraState === 'ready',
    isInitializing: cameraState === 'initializing'
  };
};