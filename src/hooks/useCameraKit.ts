import { useState, useRef, useCallback, useEffect } from 'react';
import { CameraState } from '../types/camera';

// TypeScript interfaces untuk CameraKit
interface CameraKitSession {
  setSource(source: any): Promise<void>;
  applyLens(lens: any): Promise<void>;
  play(mode: string): void;
  pause(): void;
  output: {
    live?: HTMLCanvasElement;
  };
  events: {
    addEventListener(event: string, callback: (event: any) => void): void;
  };
}

interface CameraKit {
  createSession(): Promise<CameraKitSession>;
  lensRepository: {
    loadLensGroups(groups: string[]): Promise<any>;
  };
}

interface Push2WebInstance {
  extension: any;
}

// Utility functions
const withTimeout = <T>(promise: Promise<T>, timeout: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
    )
  ]);
};

const createMediaStreamSource = (stream: MediaStream, config: any) => {
  const { createMediaStreamSource } = (window as any).CameraKit || {};
  return createMediaStreamSource ? createMediaStreamSource(stream, config) : null;
};

const Transform2D = {
  MirrorX: 'mirrorX'
};

// Global variables untuk singleton pattern
let cameraKitInstance: CameraKit | null = null;
let push2WebInstance: Push2WebInstance | null = null;
let preloadPromise: Promise<{ cameraKit: CameraKit; push2Web: Push2WebInstance }> | null = null;

// Preload function
const preloadCameraKit = (): Promise<{ cameraKit: CameraKit; push2Web: Push2WebInstance }> => {
  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = (async (): Promise<{ cameraKit: CameraKit; push2Web: Push2WebInstance }> => {
    try {
      if (cameraKitInstance && push2WebInstance) {
        return { cameraKit: cameraKitInstance, push2Web: push2WebInstance };
      }

      // Load scripts
      const [cameraKitLib, push2WebLib] = await Promise.all([
        import('@snap/camera-kit'),
        import('@snap/push2web')
      ]);

      // Initialize Push2Web
      push2WebInstance = new (push2WebLib as any).Push2Web();
      
      // Initialize CameraKit
      const { bootstrapCameraKit, createMediaStreamSource, Injectable, remoteApiServicesFactory } = cameraKitLib as any;
      
      // Create services
      const recordingControlService = new (cameraKitLib as any).RecordingControlService();
      const hadiahStatusService = new (cameraKitLib as any).HadiahStatusService();

      cameraKitInstance = await bootstrapCameraKit(
        {
          apiToken: 'eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc2htrapped"'
        },
        (container: any) => {
          container.provides(push2WebInstance!.extension);
          
          container.provides(
            Injectable(
              remoteApiServicesFactory.token,
              [remoteApiServicesFactory.token] as const,
              (existing: any) => [
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
      
      // Debug globals
      (window as any).cameraKitInstance = cameraKitInstance;
      (window as any).recordingControlService = recordingControlService;
      (window as any).hadiahStatusService = hadiahStatusService;
      
      // Throw error if either instance is null
      if (!cameraKitInstance || !push2WebInstance) {
        throw new Error('Failed to initialize CameraKit or Push2Web instances');
      }
      
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

// Initialize preload
preloadCameraKit().catch(console.error);

export const useCameraKit = (addLog: (message: string) => void) => {
  const [cameraState, setCameraState] = useState<CameraState>('initializing');
  const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>('user');
  
  // Refs dengan proper typing
  const sessionRef = useRef<CameraKitSession | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<React.RefObject<HTMLDivElement> | null>(null);
  const lensRepositoryRef = useRef<any>(null);
  const isInitializedRef = useRef(false);
  const isAttachedRef = useRef(false);
  const currentConfigRef = useRef<any>(null);

  // Process stream function
  const processStream = useCallback(async (stream: MediaStream, facingMode: string): Promise<MediaStream> => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const video = document.createElement('video');
      
      if (!ctx) throw new Error('Cannot get canvas context');
      
      // Set canvas size berdasarkan device
      const devicePixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.round(window.innerWidth * devicePixelRatio);
      canvas.height = Math.round(window.innerHeight * devicePixelRatio);
      
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      
      // Create processed stream
      const processedStream = canvas.captureStream(30);
      
      // Add audio tracks dari original stream
      stream.getAudioTracks().forEach(track => {
        processedStream.addTrack(track.clone());
      });
      
      addLog(`✅ Stream processed: ${canvas.width}x${canvas.height}`);
      return processedStream;
      
    } catch (error) {
      addLog(`❌ Stream processing failed: ${error}`);
      return stream; // Fallback ke original stream
    }
  }, [addLog]);

  // Setup Push2Web events
  const setupPush2WebEvents = useCallback((push2Web: Push2WebInstance) => {
    try {
      addLog('🔗 Setting up Push2Web events...');
      // Add event listeners untuk Push2Web jika diperlukan
      addLog('✅ Push2Web events configured');
    } catch (error) {
      addLog(`❌ Push2Web setup error: ${error}`);
    }
  }, [addLog]);

  // Attach camera output
  const attachCameraOutput = useCallback((
    canvas: HTMLCanvasElement,
    containerReference: React.RefObject<HTMLDivElement>
  ) => {
    try {
      if (!containerReference.current || !canvas) {
        addLog('❌ Cannot attach - missing container or canvas');
        return;
      }

      if (isAttachedRef.current && containerReference.current.contains(canvas)) {
        addLog('📱 Canvas already attached');
        return;
      }

      // Clear existing canvas
      const existingCanvas = containerReference.current.querySelector('canvas');
      if (existingCanvas && existingCanvas !== canvas) {
        existingCanvas.remove();
        addLog('🗑️ Removed old canvas');
      }

      // Style canvas
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.objectFit = 'cover';
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';

      // Attach canvas
      containerReference.current.appendChild(canvas);
      outputCanvasRef.current = canvas;
      isAttachedRef.current = true;
      
      addLog('✅ Camera output attached successfully');
      
    } catch (e) {
      addLog(`❌ Attachment failed: ${e}`);
    }
  }, [addLog]);

  // Restore camera feed
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

  // Initialize CameraKit
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
      
      // Update existing session
      if (isInitializedRef.current && sessionRef.current && cameraState === 'ready') {
        addLog('📱 Updating existing session...');
        
        const processedStream = await processStream(stream, currentFacingMode);
        
        const source = createMediaStreamSource(processedStream, {
          transform: currentFacingMode === 'user' ? Transform2D.MirrorX : undefined,
          cameraType: currentFacingMode
        });
        
        await withTimeout(sessionRef.current.setSource(source), 3000);
        await source.setRenderSize(adaptiveConfig.canvas.width, adaptiveConfig.canvas.height);
        
        streamRef.current = stream;
        containerRef.current = containerReference;
        
        if (sessionRef.current.output?.live && containerReference.current && !isAttachedRef.current) {
          setTimeout(() => {
            if (sessionRef.current?.output.live) {
              attachCameraOutput(sessionRef.current.output.live, containerReference);
            }
          }, 100);
        }
        
        addLog('✅ Stream updated with rotation support');
        return true;
      }

      // Initialize new session
      addLog('🎭 Initializing Camera Kit with Push2Web + Rotation...');
      setCameraState('initializing');
      containerRef.current = containerReference;
      
      // Clean up existing session
      if (sessionRef.current) {
        try {
          sessionRef.current.pause();
          sessionRef.current = null;
        } catch (e) {
          addLog(`⚠️ Session cleanup: ${e}`);
        }
      }

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
      const session = await withTimeout(cameraKit.createSession(), 5000) as CameraKitSession;
      sessionRef.current = session;
      streamRef.current = stream;
      isInitializedRef.current = true;
      
      session.events.addEventListener("error", (event: any) => {
        addLog(`❌ Session error: ${event.detail}`);
        setCameraState('error');
      });

      // Process stream with rotation
      const processedStream = await processStream(stream, currentFacingMode);

      const source = createMediaStreamSource(processedStream, {
        transform: currentFacingMode === 'user' ? Transform2D.MirrorX : undefined,
        cameraType: currentFacingMode
      });
      
      await withTimeout(sessionRef.current.setSource(source), 3000);
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
          await withTimeout(sessionRef.current.applyLens(targetLens), 3000);
          addLog(`✅ Lens applied: ${targetLens.name}`);
        } catch (lensApplyError) {
          addLog(`⚠️ Lens application failed: ${lensApplyError}`);
        }
      }

      sessionRef.current.play('live');

      setTimeout(() => {
        if (sessionRef.current?.output.live && containerReference.current && !isAttachedRef.current) {
          addLog('🎥 Attaching adaptive output...');
          attachCameraOutput(sessionRef.current.output.live, containerReference);
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
  }, [currentFacingMode, addLog, attachCameraOutput, cameraState, setupPush2WebEvents, processStream]);

  // Switch camera
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

      const newStream = await withTimeout(
        navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: newFacingMode,
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

      addLog(`✅ New ${newFacingMode} stream obtained`);
      streamRef.current = newStream;

      const videoTracks = newStream.getVideoTracks();
      const audioTracks = newStream.getAudioTracks();
      
      if (videoTracks.length > 0) {
        const settings = videoTracks[0].getSettings();
        const resolution = `${settings.width}x${settings.height}`;
        addLog(`📹 New stream: ${resolution}@${settings.frameRate}fps`);
      }
      
      addLog(`🎤 Audio tracks: ${audioTracks.length}`);

      const source = createMediaStreamSource(newStream, {
        transform: newFacingMode === 'user' ? Transform2D.MirrorX : undefined,
        cameraType: newFacingMode
      });

      await withTimeout(sessionRef.current.setSource(source), 3000);
      await source.setRenderSize(
        currentConfigRef.current.canvas.width,
        currentConfigRef.current.canvas.height
      );

      setCurrentFacingMode(newFacingMode);

      if (sessionRef.current.output?.live && containerRef.current?.current) {
        setTimeout(() => {
          if (sessionRef.current?.output.live && containerRef.current) {
            attachCameraOutput(sessionRef.current.output.live, containerRef.current);
          }
        }, 100);
      }

      sessionRef.current.play('live');
      addLog(`✅ Camera switched to ${newFacingMode}`);
      
      return newStream;

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`❌ Camera switch failed: ${errorMessage}`);
      
      try {
        await restoreCameraFeed();
        addLog('🔄 Camera feed restored after failed switch');
      } catch (recoveryError) {
        addLog(`❌ Recovery failed: ${recoveryError}`);
      }
      
      return null;
    }
  }, [currentFacingMode, addLog, attachCameraOutput, restoreCameraFeed]);

  // Handle visibility change
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

  // Get functions
  const getCanvas = useCallback((): HTMLCanvasElement | null => {
    return outputCanvasRef.current;
  }, []);

  const getStream = useCallback((): MediaStream | null => {
    return streamRef.current;
  }, []);

  const getSession = useCallback((): CameraKitSession | null => {
    return sessionRef.current;
  }, []);

  const isReady = cameraState === 'ready' && isInitializedRef.current;

  return {
    cameraState,
    currentFacingMode,
    isReady,
    initializeCameraKit,
    switchCamera,
    restoreCameraFeed,
    getCanvas,
    getStream,
    getSession
  };
};