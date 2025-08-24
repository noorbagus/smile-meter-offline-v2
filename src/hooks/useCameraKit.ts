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
      console.log('🔧 Push2Web instance created');
      
      // Bootstrap Camera Kit with Push2Web extension
      cameraKitInstance = await bootstrapCameraKit(
        { 
          apiToken: import.meta.env.VITE_CAMERA_KIT_API_TOKEN || 'eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzQ3MDM1OTAyLCJzdWIiOiI2YzMzMWRmYy0zNzEzLTQwYjYtYTNmNi0zOTc2OTU3ZTkyZGZ-UFJPRFVDVElPTn5jZjM3ZDAwNy1iY2IyLTQ3YjEtODM2My1jYWIzYzliOGJhM2YifQ.UqGhWZNuWXplirojsPSgZcsO3yu98WkTM1MRG66dsHI'
        },
        (container) => {
          container.provides(push2WebInstance!.extension);
          console.log('✅ Push2Web extension provided to Camera Kit');
          return container;
        }
      );
      
      console.log('🎭 Camera Kit + Push2Web initialized');
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

// Preload on module load
preloadCameraKit().catch(console.error);

export const useCameraKit = (addLog: (message: string) => void) => {
  const [cameraState, setCameraState] = useState<CameraState>('initializing');
  const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>('user');
  
  // Push2Web state
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [lastReceivedLens, setLastReceivedLens] = useState<any>(null);
  
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lensRepositoryRef = useRef<any>(null);
  const isAttachedRef = useRef<boolean>(false);
  const containerRef = useRef<React.RefObject<HTMLDivElement> | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  const currentConfigRef = useRef<any>(null);
  const accessTokenRef = useRef<string | null>(null);

  // Setup Push2Web event handlers
  const setupPush2WebEvents = useCallback((push2Web: Push2Web) => {
    // Lens received event
    push2Web.events.addEventListener('lensReceived', (event: any) => {
      const { id, name, iconUrl, cameraFacingPreference } = event.detail;
      addLog(`📦 Push2Web lens received: ${name} (${id})`);
      addLog(`📱 Camera preference: ${cameraFacingPreference}`);
      
      setLastReceivedLens({ id, name, iconUrl, cameraFacingPreference });
      
      // Apply lens to current session
      if (sessionRef.current && lensRepositoryRef.current) {
        try {
          // Find lens in repository or create from received data
          let targetLens = lensRepositoryRef.current.find((lens: any) => lens.id === id);
          
          if (!targetLens && event.detail) {
            // Create lens object from Push2Web data
            targetLens = {
              id,
              name,
              iconUrl,
              cameraFacingPreference
            };
            addLog(`🔧 Created lens object from Push2Web data`);
          }
          
          if (targetLens) {
            sessionRef.current.applyLens(targetLens).then(() => {
              addLog(`✅ Push2Web lens applied: ${name}`);
            }).catch((error: any) => {
              addLog(`❌ Failed to apply Push2Web lens: ${error}`);
            });
          } else {
            addLog(`❌ Lens not found: ${id}`);
          }
        } catch (error) {
          addLog(`❌ Push2Web lens application error: ${error}`);
        }
      } else {
        addLog(`⚠️ Session or repository not ready for Push2Web lens`);
      }
    });

    // Error event
    push2Web.events.addEventListener('error', (event: any) => {
      const errorDetails = event.detail;
      addLog(`❌ Push2Web error: ${errorDetails}`);
    });

    // Subscription changed event
    push2Web.events.addEventListener('subscriptionChanged', (event: any) => {
      const subState = event.detail;
      addLog(`🔗 Push2Web subscription: ${subState}`);
      setIsSubscribed(subState === 'subscribed');
    });

    addLog('🎭 Push2Web event handlers configured');
  }, [addLog]);

  // Subscribe to Push2Web with access token
  const subscribePush2Web = useCallback(async (accessToken: string): Promise<boolean> => {
    try {
      if (!push2WebInstance) {
        addLog('❌ Push2Web instance not available');
        return false;
      }

      if (!sessionRef.current) {
        addLog('❌ Camera Kit session not ready for Push2Web');
        return false;
      }

      if (!lensRepositoryRef.current) {
        addLog('❌ Lens repository not loaded for Push2Web');
        return false;
      }

      addLog('🔗 Subscribing to Push2Web...');
      
      // Store access token
      accessTokenRef.current = accessToken;
      
      // Subscribe with access token, session, and lens repository
      await push2WebInstance.subscribe(
        accessToken,
        sessionRef.current,
        lensRepositoryRef.current
      );

      setIsSubscribed(true);
      addLog('✅ Push2Web subscription successful');
      addLog('📱 Ready to receive lenses from Lens Studio');
      addLog('🎯 Instructions: Login to Lens Studio → Send lens via "Send to Camera Kit"');
      
      return true;
    } catch (error) {
      addLog(`❌ Push2Web subscription failed: ${error}`);
      setIsSubscribed(false);
      return false;
    }
  }, [addLog]);

  // Unsubscribe from Push2Web
  const unsubscribePush2Web = useCallback(() => {
    if (push2WebInstance && isSubscribed) {
      try {
        // Push2Web doesn't have explicit unsubscribe, but we can reset state
        setIsSubscribed(false);
        setLastReceivedLens(null);
        accessTokenRef.current = null;
        addLog('🔌 Push2Web unsubscribed');
      } catch (error) {
        addLog(`⚠️ Push2Web unsubscribe warning: ${error}`);
      }
    }
  }, [isSubscribed, addLog]);

  // Get Push2Web status
  const getPush2WebStatus = useCallback(() => {
    return {
      available: !!push2WebInstance,
      subscribed: isSubscribed,
      session: !!sessionRef.current,
      repository: !!lensRepositoryRef.current,
      lastLens: lastReceivedLens,
      hasToken: !!accessTokenRef.current
    };
  }, [isSubscribed, lastReceivedLens]);

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
      if (lenses && lenses.length > 0 && currentConfigRef.current) {
        const targetLens = lenses.find((lens: any) => lens.id === currentConfigRef.current.lensId) || lenses[0];
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

      addLog('🎭 Initializing Camera Kit with Push2Web...');
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
        if (session.output.live && containerReference.current && !isAttachedRef.current) {
          addLog('🎥 Attaching adaptive output...');
          attachCameraOutput(session.output.live, containerReference);
        }
      }, 500);

      setCameraState('ready');
      addLog('🎉 Camera Kit + Push2Web ready');
      
      // Auto-subscribe if we have access token
      if (accessTokenRef.current) {
        addLog('🔄 Auto-subscribing to Push2Web with existing token...');
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

  const switchCamera = useCallback(async (): Promise<MediaStream | null> => {
    if (!sessionRef.current || !isInitializedRef.current) {
      addLog('❌ Cannot switch - session not initialized');
      return null;
    }

    try {
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      addLog(`🔄 Switching to ${newFacingMode} camera...`);

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

      // LANDSCAPE constraints for camera switch (match Brio hardware)
      const newStream = await withTimeout(
        navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: newFacingMode,
            // Request LANDSCAPE to match hardware sensor
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

      addLog(`✅ New ${newFacingMode} LANDSCAPE stream obtained`);
      streamRef.current = newStream;

      // Log new stream details with orientation check
      const videoTracks = newStream.getVideoTracks();
      const audioTracks = newStream.getAudioTracks();
      
      if (videoTracks.length > 0) {
        const settings = videoTracks[0].getSettings();
        const resolution = `${settings.width}x${settings.height}`;
        const isLandscape = (settings.width || 0) > (settings.height || 0);
        
        addLog(`📹 New stream: ${resolution}@${settings.frameRate}fps`);
        addLog(`🔄 Orientation: ${isLandscape ? 'LANDSCAPE ✅' : 'PORTRAIT ⚠️'}`);
        
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
        addLog(`✅ Adaptive render: ${config.canvas.width}x${config.canvas.height}`);
      }

      await new Promise(resolve => setTimeout(resolve, 300));

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
    // Unsubscribe from Push2Web
    unsubscribePush2Web();
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      addLog('🔄 Stream stopped');
    }
    if (sessionRef.current) {
      sessionRef.current.pause();
      addLog('⏸️ Session paused');
    }
    
    // Reset refs
    isAttachedRef.current = false;
    containerRef.current = null;
    currentConfigRef.current = null;
    accessTokenRef.current = null;
    setLastReceivedLens(null);
  }, [addLog, unsubscribePush2Web]);

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
    isInitializing: cameraState === 'initializing',
    
    // Push2Web functions
    subscribePush2Web,
    unsubscribePush2Web,
    getPush2WebStatus,
    
    // Push2Web state
    isSubscribed,
    lastReceivedLens
  };
};