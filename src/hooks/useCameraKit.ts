// src/hooks/useCameraKit.ts - Fixed Remote API registration
import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  bootstrapCameraKit, 
  createMediaStreamSource, 
  Transform2D,
  Injectable,
  remoteApiServicesFactory,
  type RemoteApiService
} from '@snap/camera-kit';
import { Push2Web } from '@snap/push2web';
import { validateConfig } from '../config/cameraKit';
import type { CameraState } from './useCameraPermissions';
import { recordingControlService, hadiahStatusService } from '../utils/RemoteApiService';

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
      
      // FIXED: Correct Remote API service registration
      const configuration = { 
        apiToken: import.meta.env.VITE_CAMERA_KIT_API_TOKEN || 'eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzQ3MDM1OTAyLCJzdWIiOiI2YzMzMWRmYy0zNzEzLTQwYjYtYTNmNi0zOTc2OTU3ZTkyZGF+UFJPRFVDVElPTn5jZjM3ZDAwNy1iY2IyLTQsrc/q9Lcy5hYjYzLTg2My1jYWIzYzliOGJhM2YifQ.UqGhWZNuWXplirojsPSgZcsO3yu98WkTM1MRG66dsHI'
      };

      cameraKitInstance = await bootstrapCameraKit(
        configuration,
        (container) => {
          // Provide Push2Web extension
          container.provides(push2WebInstance!.extension);
          
          // FIXED: Correct Remote API service registration
          container.provides(
            Injectable(
              remoteApiServicesFactory.token,
              [remoteApiServicesFactory.token] as const,
              (existing: RemoteApiService[]) => [
                ...existing, 
                recordingControlService, 
                hadiahStatusService
              ]
            )
          );
          
          return container;
        }
      );
      
      console.log('✅ Camera Kit initialized with Remote API services');
      
      // Make available for debugging
      (window as any).cameraKitInstance = cameraKitInstance;
      (window as any).recordingControlService = recordingControlService;
      (window as any).hadiahStatusService = hadiahStatusService;
      
      console.log('[Camera Kit] SDK Version:', cameraKitInstance?.version || 'Unknown');
      
      return { cameraKit: cameraKitInstance, push2Web: push2WebInstance };
    } catch (error) {
      cameraKitInstance = null;
      push2WebInstance = null;
      preloadPromise = null;
      console.error('Camera Kit initialization failed:', error);
      throw error;
    }
  })();
  
  return preloadPromise;
};

// Preload Camera Kit on module import
preloadCameraKit().catch(console.error);

export const useCameraKit = (addLog: (message: string) => void) => {
  const [cameraState, setCameraState] = useState<CameraState>('initializing');
  const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>('user');
  
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<React.RefObject<HTMLDivElement> | null>(null);
  const isInitializedRef = useRef(false);
  const isAttachedRef = useRef(false);
  const lensRepositoryRef = useRef<any>(null);
  const currentConfigRef = useRef<any>(null);

  const setupPush2WebEvents = useCallback((push2Web: Push2Web) => {
    if (!push2Web) return;
    
    try {
      push2Web.events.addEventListener('error', (event: any) => {
        addLog(`❌ Push2Web error: ${event.detail}`);
      });
      
      push2Web.events.addEventListener('lensReceived', (event: any) => {
        addLog(`📦 Push2Web lens received: ${event.detail}`);
      });
      
      push2Web.events.addEventListener('subscriptionChanged', (event: any) => {
        addLog(`🔄 Push2Web subscription changed: ${event.detail}`);
      });
      
      addLog('✅ Push2Web event listeners registered');
    } catch (error) {
      addLog(`⚠️ Push2Web events setup failed: ${error}`);
    }
  }, [addLog]);

  const attachCameraOutput = useCallback((output: any, containerReference: React.RefObject<HTMLDivElement>) => {
    if (!output || !containerReference.current || isAttachedRef.current) {
      return;
    }

    try {
      const existingCanvas = containerReference.current.querySelector('canvas');
      if (existingCanvas) {
        addLog('🎨 Removing existing canvas');
        existingCanvas.remove();
      }

      // Handle both direct canvas and wrapped output
      let canvas: HTMLCanvasElement | null = null;
      
      if (output instanceof HTMLCanvasElement) {
        canvas = output;
        addLog('🎥 Direct canvas output detected');
      } else if (output.live && output.live instanceof HTMLCanvasElement) {
        canvas = output.live;
        addLog('🎥 Wrapped canvas output detected');
      } else if (output.element && output.element instanceof HTMLCanvasElement) {
        canvas = output.element;
        addLog('🎥 Element canvas output detected');
      } else {
        addLog(`❌ Invalid output format: ${typeof output}, live: ${typeof output.live}, element: ${typeof output.element}`);
        return;
      }

      if (canvas) {
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.objectFit = 'cover';
        canvas.style.transform = currentFacingMode === 'user' ? 'scaleX(-1)' : 'none';
        
        containerReference.current.appendChild(canvas);
        outputCanvasRef.current = canvas;
        isAttachedRef.current = true;
        
        addLog('🎥 Camera output attached');
      }
    } catch (error) {
      addLog(`❌ Output attachment failed: ${error}`);
    }
  }, [currentFacingMode, addLog]);

  const cleanup = useCallback(() => {
    addLog('🧹 Starting cleanup...');
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        addLog(`🛑 Stopped ${track.kind} track`);
      });
      streamRef.current = null;
    }

    if (sessionRef.current) {
      try {
        sessionRef.current.destroy();
        addLog('🗑️ Session destroyed');
      } catch (error) {
        addLog(`⚠️ Session cleanup error: ${error}`);
      }
      sessionRef.current = null;
    }

    outputCanvasRef.current = null;
    isInitializedRef.current = false;
    isAttachedRef.current = false;
    setCameraState('initializing');
    
    addLog('✅ Cleanup complete');
  }, [addLog]);

  const pauseSession = useCallback(() => {
    if (sessionRef.current) {
      try {
        sessionRef.current.pause();
        addLog('⏸️ Session paused');
      } catch (error) {
        addLog(`❌ Pause failed: ${error}`);
      }
    }
  }, [addLog]);

  const resumeSession = useCallback(() => {
    if (sessionRef.current) {
      try {
        sessionRef.current.play('live');
        addLog('▶️ Session resumed');
      } catch (error) {
        addLog(`❌ Resume failed: ${error}`);
      }
    }
  }, [addLog]);

  const restoreCameraFeed = useCallback(async () => {
    if (!sessionRef.current?.output?.live || !containerRef.current?.current) {
      addLog('❌ Cannot restore - missing session or container');
      return false;
    }

    try {
      addLog('🔄 Restoring camera feed...');
      
      if (!isAttachedRef.current) {
        attachCameraOutput(sessionRef.current.output.live, containerRef.current);
        addLog('✅ Camera feed restored');
        return true;
      }
      
      addLog('✅ Camera feed already active');
      return true;
    } catch (recoveryError) {
      addLog(`❌ Recovery failed: ${recoveryError}`);
      return false;
    }
  }, [addLog, attachCameraOutput]);

  const reloadLens = useCallback(async (): Promise<boolean> => {
    if (!sessionRef.current || !isInitializedRef.current) {
      addLog('❌ Cannot reload lens - session not initialized');
      return false;
    }

    try {
      addLog('🔄 Reloading lens...');
      const config = currentConfigRef.current;
      
      if (!config || !lensRepositoryRef.current) {
        addLog('❌ Missing configuration or lens repository');
        return false;
      }

      const lenses = lensRepositoryRef.current;
      if (lenses && lenses.length > 0) {
        const targetLens = lenses.find((lens: any) => lens.id === config.lensId) || lenses[0];
        await withTimeout(sessionRef.current.applyLens(targetLens), 3000);
        addLog(`✅ Lens reloaded: ${targetLens.name}`);
        return true;
      }
      
      addLog('❌ No lenses available');
      return false;
    } catch (error) {
      addLog(`❌ Lens reload failed: ${error}`);
      return false;
    }
  }, [addLog]);

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
        addLog(`✅ Adaptive render: ${adaptiveConfig.canvas.width}x${adaptiveConfig.canvas.height}`);
        
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

      addLog('🎭 Initializing Camera Kit with Remote API & Push2Web...');
      addLog(`📐 Adaptive canvas: ${adaptiveConfig.canvas.width}x${adaptiveConfig.canvas.height}`);
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
      addLog('✅ Camera source configured');

      await source.setRenderSize(adaptiveConfig.canvas.width, adaptiveConfig.canvas.height);
      addLog(`✅ Adaptive AR render: ${adaptiveConfig.canvas.width}x${adaptiveConfig.canvas.height}`);

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
        if (session.output && containerReference.current && !isAttachedRef.current) {
          addLog('🎥 Attaching adaptive output...');
          // Debug the actual output structure
          addLog(`🔍 Output type: ${typeof session.output}`);
          addLog(`🔍 Output keys: ${Object.keys(session.output).join(', ')}`);
          
          // Try different output paths
          if (session.output.live) {
            addLog(`🔍 Live type: ${typeof session.output.live}`);
            addLog(`🔍 Live constructor: ${session.output.live.constructor.name}`);
          }
          
          attachCameraOutput(session.output, containerReference);
        }
      }, 500);

      setCameraState('ready');
      addLog('🎉 Camera Kit + Remote API + Push2Web ready');
      return true;

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`❌ Camera Kit error: ${errorMessage}`);
      setCameraState('error');
      return false;
    }
  }, [currentFacingMode, addLog, attachCameraOutput, cameraState, setupPush2WebEvents]);

  const switchCamera = useCallback(async (): Promise<MediaStream | null> => {
    if (!sessionRef.current || !isInitializedRef.current) {
      addLog('❌ Cannot switch - session not initialized');
      return null;
    }

    try {
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      addLog(`🔄 Switching camera: ${currentFacingMode} → ${newFacingMode}`);

      const constraints = {
        video: {
          facingMode: newFacingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true
      };

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = newStream;

      const source = createMediaStreamSource(newStream, {
        transform: newFacingMode === 'user' ? Transform2D.MirrorX : undefined,
        cameraType: newFacingMode
      });

      await withTimeout(sessionRef.current.setSource(source), 3000);
      
      const config = currentConfigRef.current;
      if (config) {
        await source.setRenderSize(config.canvas.width, config.canvas.height);
      }

      if (outputCanvasRef.current) {
        outputCanvasRef.current.style.transform = newFacingMode === 'user' ? 'scaleX(-1)' : 'none';
      }

      setCurrentFacingMode(newFacingMode);
      addLog(`✅ Camera switched to ${newFacingMode}`);
      
      return newStream;
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`❌ Camera switch failed: ${errorMessage}`);
      return null;
    }
  }, [currentFacingMode, addLog]);

  const getCanvas = useCallback((): HTMLCanvasElement | null => {
    return outputCanvasRef.current;
  }, []);

  const getStream = useCallback((): MediaStream | null => {
    return streamRef.current;
  }, []);

  const isReady = cameraState === 'ready' && isInitializedRef.current;
  const isInitializing = cameraState === 'initializing';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    // Core state
    cameraState,
    currentFacingMode,
    isReady,
    isInitializing,
    
    // Camera Kit functions
    initializeCameraKit,
    switchCamera,
    reloadLens,
    pauseSession,
    resumeSession,
    cleanup,
    restoreCameraFeed,
    
    // Output access
    getCanvas,
    getStream
  };
};