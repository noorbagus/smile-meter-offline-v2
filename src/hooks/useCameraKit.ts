// src/hooks/useCameraKit.ts - Push2Web integration
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
  if (cameraKitInstance) return { cameraKit: cameraKitInstance, push2Web: push2WebInstance };
  if (preloadPromise) return preloadPromise;
  
  preloadPromise = (async () => {
    try {
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        throw new Error('HTTPS_REQUIRED');
      }
      
      validateConfig();
      
      // Initialize Push2Web
      push2WebInstance = new Push2Web();
      
      // Bootstrap Camera Kit with Push2Web extension
      cameraKitInstance = await bootstrapCameraKit(
        { 
          apiToken: import.meta.env.VITE_CAMERA_KIT_API_TOKEN
        },
        (container) => {
          container.provides(push2WebInstance!.extension);
          return container;
        }
      );
      
      return { cameraKit: cameraKitInstance, push2Web: push2WebInstance };
    } catch (error) {
      cameraKitInstance = null;
      push2WebInstance = null;
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
  const [push2WebStatus, setPush2WebStatus] = useState({
    subscribed: false,
    connected: false,
    error: null as string | null
  });
  
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lensRepositoryRef = useRef<any>(null);
  const isAttachedRef = useRef<boolean>(false);
  const containerRef = useRef<React.RefObject<HTMLDivElement> | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  const currentConfigRef = useRef<any>(null);
  const accessTokenRef = useRef<string | null>(null);

  // Setup Push2Web events
  const setupPush2WebEvents = useCallback((push2Web: Push2Web) => {
    push2Web.events.addEventListener('lensReceived', (event: any) => {
      const { id, name, iconUrl, cameraFacingPreference } = event.detail;
      addLog(`📦 Push2Web lens received: ${name} (${id})`);
      
      // Apply lens to current session
      if (sessionRef.current && lensRepositoryRef.current) {
        try {
          // Find or create lens object
          let targetLens = lensRepositoryRef.current.find((lens: any) => lens.id === id);
          
          if (!targetLens) {
            targetLens = { id, name, iconUrl, cameraFacingPreference };
          }
          
          sessionRef.current.applyLens(targetLens).then(() => {
            addLog(`✅ Push2Web lens applied: ${name}`);
          }).catch((error: any) => {
            addLog(`❌ Failed to apply Push2Web lens: ${error}`);
          });
        } catch (error) {
          addLog(`❌ Push2Web lens application error: ${error}`);
        }
      }
    });

    push2Web.events.addEventListener('error', (event: any) => {
      const errorDetails = event.detail;
      addLog(`❌ Push2Web error: ${errorDetails}`);
      setPush2WebStatus(prev => ({ ...prev, error: errorDetails, connected: false }));
    });

    push2Web.events.addEventListener('subscriptionChanged', (event: any) => {
      const subState = event.detail;
      addLog(`🔗 Push2Web subscription: ${subState}`);
      setPush2WebStatus(prev => ({ 
        ...prev, 
        subscribed: subState === 'subscribed',
        connected: subState === 'subscribed',
        error: null
      }));
    });

    addLog('🎭 Push2Web event handlers configured');
  }, [addLog]);

  // Subscribe to Push2Web with Login Kit access token
  const subscribePush2Web = useCallback(async (accessToken: string): Promise<boolean> => {
    try {
      if (!push2WebInstance) {
        addLog('❌ Push2Web instance not available');
        return false;
      }

      if (!sessionRef.current) {
        addLog('❌ Camera Kit session not ready');
        return false;
      }

      if (!lensRepositoryRef.current) {
        addLog('❌ Lens repository not loaded');
        return false;
      }

      addLog('🔗 Subscribing to Push2Web...');
      
      // Store access token
      accessTokenRef.current = accessToken;

      await push2WebInstance.subscribe(
        accessToken,
        sessionRef.current,
        lensRepositoryRef.current
      );

      setPush2WebStatus({ subscribed: true, connected: true, error: null });
      addLog('✅ Push2Web subscription successful');
      addLog('📱 Ready to receive lenses from Lens Studio');
      
      return true;
    } catch (error) {
      addLog(`❌ Push2Web subscription failed: ${error}`);
      setPush2WebStatus(prev => ({ ...prev, subscribed: false, error: String(error) }));
      return false;
    }
  }, [addLog]);

  // Get Push2Web status
  const getPush2WebStatus = useCallback(() => {
    return {
      ...push2WebStatus,
      available: !!push2WebInstance,
      session: !!sessionRef.current,
      repository: !!lensRepositoryRef.current,
      hasAccessToken: !!accessTokenRef.current
    };
  }, [push2WebStatus]);

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
        
        // Perfect fit CSS
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
        
        addLog('✅ Stream updated');
        return true;
      }

      addLog('🎭 Initializing Camera Kit with Push2Web...');
      setCameraState('initializing');
      containerRef.current = containerReference;

      const { cameraKit, push2Web } = await withTimeout(preloadCameraKit(), 10000);
      
      if (!cameraKit) {
        throw new Error('Failed to initialize Camera Kit');
      }

      // Setup Push2Web events
      if (push2Web) {
        setupPush2WebEvents(push2Web);
        addLog('✅ Push2Web extension loaded');
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

      const source = createMediaStreamSource(stream, {
        transform: currentFacingMode === 'user' ? Transform2D.MirrorX : undefined,
        cameraType: currentFacingMode
      });
      
      await withTimeout(session.setSource(source), 3000);
      await source.setRenderSize(adaptiveConfig.canvas.width, adaptiveConfig.canvas.height);

      // Load lens repository
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

      // Apply default lens
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
      addLog('🎉 Camera Kit + Push2Web ready');

      // Auto-subscribe if access token available
      if (accessTokenRef.current) {
        setTimeout(() => {
          subscribePush2Web(accessTokenRef.current!);
        }, 1000);
      }

      return true;

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`❌ Camera Kit error: ${errorMessage}`);
      setCameraState('error');
      return false;
    }
  }, [currentFacingMode, addLog, attachCameraOutput, cameraState, setupPush2WebEvents, subscribePush2Web]);

  // Other existing methods remain the same...
  const switchCamera = useCallback(async (): Promise<MediaStream | null> => {
    // ... existing implementation
    return null;
  }, [currentFacingMode, addLog]);

  const reloadLens = useCallback(async (): Promise<boolean> => {
    // ... existing implementation
    return false;
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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      addLog('🔄 Stream stopped');
    }
    if (sessionRef.current) {
      sessionRef.current.pause();
      addLog('⏸️ Session paused');
    }
    accessTokenRef.current = null;
    setPush2WebStatus({ subscribed: false, connected: false, error: null });
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

  const unsubscribePush2Web = useCallback(() => {
    setPush2WebStatus({ subscribed: false, connected: false, error: null });
    accessTokenRef.current = null;
    addLog('🔗 Push2Web unsubscribed');
  }, [addLog]);

  const getPush2WebStatusFixed = useCallback(() => ({
    available: !!push2WebInstance,
    subscribed: push2WebStatus.subscribed,
    session: !!sessionRef.current,
    repository: !!lensRepositoryRef.current,
    lastLens: null,
    hasToken: !!accessTokenRef.current
  }), [push2WebStatus]);

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
    isInitializing: cameraState === 'initializing',
    
    // Push2Web specific
    subscribePush2Web,
    getPush2WebStatus: getPush2WebStatusFixed,
    push2WebStatus,
    unsubscribePush2Web,
    isSubscribed: push2WebStatus.subscribed,
    lastReceivedLens: null
  };
};