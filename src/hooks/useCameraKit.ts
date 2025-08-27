import { useState, useRef, useCallback, useEffect } from 'react';
import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from '@snap/camera-kit';
import { Push2Web } from '@snap/push2web';
import { validateConfig } from '../config/cameraKit';
import type { CameraState } from './useCameraPermissions';

let cameraKitInstance: any = null;
let preloadPromise: Promise<any> | null = null;
let push2WebInstance: Push2Web | null = null;

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
      
      push2WebInstance = new Push2Web();
      
      const extensions = (container: any) => container.provides(push2WebInstance!.extension);
      
      cameraKitInstance = await bootstrapCameraKit({
        apiToken: import.meta.env.VITE_CAMERA_KIT_API_TOKEN
      }, extensions);
      
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
  const push2WebSubscriptionRef = useRef<any>(null);

  const subscribePush2Web = useCallback(async (accessToken: string): Promise<boolean> => {
    if (!push2WebInstance || !sessionRef.current || !cameraKitInstance) {
      addLog('❌ Push2Web not ready');
      return false;
    }

    try {
      addLog('🔗 Subscribing to Push2Web...');
      
      push2WebInstance.events.addEventListener('lensReceived', (event: any) => {
        const { id, name, iconUrl, cameraFacingPreference } = event.detail;
        addLog(`📡 Lens received: ${name} (${id})`);
      });

      push2WebInstance.events.addEventListener('error', (event: any) => {
        addLog(`❌ Push2Web error: ${event.detail}`);
      });

      push2WebInstance.events.addEventListener('subscriptionChanged', (event: any) => {
        addLog(`📊 Push2Web subscription: ${event.detail}`);
      });

      const subscription = push2WebInstance.subscribe(
        accessToken,
        sessionRef.current,
        cameraKitInstance.lensRepository
      );

      push2WebSubscriptionRef.current = subscription;
      addLog('✅ Push2Web subscription active');
      return true;
    } catch (error) {
      addLog(`❌ Push2Web subscription failed: ${error}`);
      return false;
    }
  }, [addLog]);

  const getPush2WebStatus = useCallback(() => {
    return {
      available: !!push2WebInstance,
      subscribed: !!push2WebSubscriptionRef.current,
      session: !!sessionRef.current,
      repository: !!lensRepositoryRef.current
    };
  }, []);

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

        while (containerReference.current.firstChild) {
          try {
            containerReference.current.removeChild(containerReference.current.firstChild);
          } catch (e) {
            break;
          }
        }
        
        outputCanvasRef.current = canvas;
        addLog(`📊 Canvas: ${canvas.width}x${canvas.height}`);
        
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
        
        canvas.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          width: ${displayWidth}px;
          height: ${displayHeight}px;
          transform: translate(-50%, -50%) rotate(-90deg);
          object-fit: contain;
          object-position: center;
          background: transparent;
          image-rendering: crisp-edges;
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

  const initializeCameraKit = useCallback(async (
    stream: MediaStream,
    containerReference: React.RefObject<HTMLDivElement>
  ): Promise<boolean> => {
    try {
      const adaptiveConfig = {
        apiToken: import.meta.env.VITE_CAMERA_KIT_API_TOKEN,
        lensId: import.meta.env.VITE_CAMERA_KIT_LENS_ID || '04441cd2-8e9d-420b-b293-90b5df8f577f',
        lensGroupId: import.meta.env.VITE_CAMERA_KIT_LENS_GROUP_ID || 'cd5b1b49-4483-45ea-9772-cb241939e2ce',
        canvas: {
          width: Math.round(window.innerWidth * (window.devicePixelRatio || 1)),
          height: Math.round(window.innerHeight * (window.devicePixelRatio || 1))
        }
      };
      currentConfigRef.current = adaptiveConfig;
      
      if (isInitializedRef.current && sessionRef.current && cameraState === 'ready') {
        addLog('📱 Updating existing session...');
        
        // Mirror untuk front camera, tanpa rotasi di Transform2D
        const source = createMediaStreamSource(stream, {
          transform: currentFacingMode === 'user' ? Transform2D.MirrorX : undefined,
          cameraType: currentFacingMode
        });
        
        await withTimeout(sessionRef.current.setSource(source), 3000);
        await source.setRenderSize(adaptiveConfig.canvas.width, adaptiveConfig.canvas.height);
        
        streamRef.current = stream;
        containerRef.current = containerReference;
        
        if (sessionRef.current.output?.live && containerReference.current && !isAttachedRef.current) {
          setTimeout(() => {
            if (sessionRef.current.output.live) {
              attachCameraOutput(sessionRef.current.output.live, containerReference);
            }
          }, 100);
        }
        
        addLog('✅ Stream updated with -90° rotation');
        return true;
      }

      addLog('🎭 Initializing Camera Kit with Push2Web + Rotation...');
      setCameraState('initializing');
      containerRef.current = containerReference;

      const cameraKit = await withTimeout(preloadCameraKit(), 10000);
      
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

      // Mirror untuk front camera, tanpa rotasi di Transform2D
      const source = createMediaStreamSource(stream, {
        transform: currentFacingMode === 'user' ? Transform2D.MirrorX : undefined,
        cameraType: currentFacingMode
      });
      
      await withTimeout(session.setSource(source), 3000);
      await source.setRenderSize(adaptiveConfig.canvas.width, adaptiveConfig.canvas.height);

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
          addLog(`✅ Default lens applied: ${targetLens.name}`);
        } catch (lensApplyError) {
          addLog(`⚠️ Lens application failed: ${lensApplyError}`);
        }
      }

      session.play('live');

      setTimeout(() => {
        if (session.output.live && containerReference.current && !isAttachedRef.current) {
          attachCameraOutput(session.output.live, containerReference);
        }
      }, 500);

      setCameraState('ready');
      addLog('🎉 Camera Kit ready with -90° rotation');

      return true;

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`❌ Camera Kit error: ${errorMessage}`);
      setCameraState('error');
      return false;
    }
  }, [currentFacingMode, addLog, attachCameraOutput, cameraState]);

  const switchCamera = useCallback(async (): Promise<MediaStream | null> => {
    if (!isInitializedRef.current || !sessionRef.current) {
      addLog('❌ Camera not initialized');
      return null;
    }

    try {
      addLog('🔄 Switching camera...');
      
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newFacingMode,
          width: { ideal: 1280, min: 640, max: 1920 },
          height: { ideal: 720, min: 480, max: 1080 },
          frameRate: { ideal: 30, min: 15, max: 60 }
        },
        audio: true
      });

      // Mirror untuk front camera, tanpa rotasi di Transform2D  
      const source = createMediaStreamSource(stream, {
        transform: newFacingMode === 'user' ? Transform2D.MirrorX : undefined,
        cameraType: newFacingMode
      });

      await sessionRef.current.setSource(source);
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      streamRef.current = stream;
      setCurrentFacingMode(newFacingMode);
      
      addLog(`✅ Switched to ${newFacingMode} camera with -90° rotation`);
      return stream;

    } catch (error) {
      addLog(`❌ Camera switch failed: ${error}`);
      return null;
    }
  }, [currentFacingMode, addLog]);

  const reloadLens = useCallback(async (): Promise<boolean> => {
    if (!sessionRef.current || !lensRepositoryRef.current || !currentConfigRef.current) {
      addLog('❌ Session or lens repository not ready');
      return false;
    }

    try {
      addLog('🔄 Reloading lens...');
      
      const lenses = lensRepositoryRef.current;
      if (lenses && lenses.length > 0) {
        const targetLens = lenses.find((lens: any) => lens.id === currentConfigRef.current.lensId) || lenses[0];
        await withTimeout(sessionRef.current.applyLens(targetLens), 3000);
        addLog(`✅ Lens reloaded: ${targetLens.name}`);
        return true;
      } else {
        addLog('❌ No lenses available');
        return false;
      }
    } catch (error) {
      addLog(`❌ Lens reload failed: ${error}`);
      return false;
    }
  }, [addLog]);

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
    if (push2WebSubscriptionRef.current) {
      push2WebSubscriptionRef.current = null;
      addLog('🔌 Push2Web unsubscribed');
    }
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
    subscribePush2Web,
    getPush2WebStatus,
    isReady: cameraState === 'ready',
    isInitializing: cameraState === 'initializing'
  };
};