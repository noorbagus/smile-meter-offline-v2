// src/hooks/useCameraKit.ts - Refactored implementation
import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  bootstrapCameraKit, 
  createMediaStreamSource, 
  Transform2D,
  Injectable,
  remoteApiServicesFactory
} from '@snap/camera-kit';
import { Push2Web } from '@snap/push2web';
import { validateConfig } from '../config/cameraKit';
import type { CameraState } from './useCameraPermissions';
import { recordingControlService, hadiahStatusService } from '../utils/RemoteApiService';

// Types
interface CameraKitConfig {
  apiToken: string;
  lensId: string;
  lensGroupId: string;
  canvas: {
    width: number;
    height: number;
  };
}

interface CameraKitInstance {
  cameraKit: any;
  push2Web: Push2Web | null;
}

// Singleton instances
let cameraKitInstance: any = null;
let push2WebInstance: Push2Web | null = null;
let preloadPromise: Promise<CameraKitInstance> | null = null;

// Utility functions
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    )
  ]);
};

const createAdaptiveConfig = (): CameraKitConfig => ({
  apiToken: import.meta.env.VITE_CAMERA_KIT_API_TOKEN || 'eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzQ3MDM1OTAyLCJzdWIiOiI2YzMzMWRmYy0zNzEzLTQwYjYtYTNmNi0zOTc2OTU3ZTkyZGF+UFJPRFVDVElPTn5jZjM3ZDAwNy1iY2IyLTQ3YjEtODM2My1jYWIzYzliOGJhM2YifQ.UqGhWZNuWXplirojsPSgZcsO3yu98WkTM1MRG66dsHI',
  lensId: import.meta.env.VITE_CAMERA_KIT_LENS_ID || '04441cd2-8e9d-420b-b293-90b5df8f577f',
  lensGroupId: import.meta.env.VITE_CAMERA_KIT_LENS_GROUP_ID || 'cd5b1b49-4483-45ea-9772-cb241939e2ce',
  canvas: {
    width: Math.round(window.innerWidth * (window.devicePixelRatio || 1)),
    height: Math.round(window.innerHeight * (window.devicePixelRatio || 1))
  }
});

// Camera Kit preload
const preloadCameraKit = async (): Promise<CameraKitInstance> => {
  if (cameraKitInstance) return { cameraKit: cameraKitInstance, push2Web: push2WebInstance };
  if (preloadPromise) return preloadPromise;
  
  preloadPromise = (async () => {
    try {
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        throw new Error('HTTPS_REQUIRED');
      }
      
      validateConfig();
      
      push2WebInstance = new Push2Web();
      
      cameraKitInstance = await bootstrapCameraKit(
        { 
          apiToken: createAdaptiveConfig().apiToken
        },
        (container) => {
          container.provides(push2WebInstance!.extension);
          container.provides(
            Injectable(
              remoteApiServicesFactory.token,
              [remoteApiServicesFactory.token] as const,
              (existing: any) => [...existing, recordingControlService, hadiahStatusService]
            )
          );
          return container;
        }
      );
      
      console.log('✅ Camera Kit initialized with Remote API services');
      console.log(`🎯 Recording API registered: ${recordingControlService.apiSpecId}`);
      console.log(`🎁 Hadiah API registered: ${hadiahStatusService.apiSpecId}`);
      
      // Debug access
      (window as any).cameraKitInstance = cameraKitInstance;
      (window as any).recordingControlService = recordingControlService;
      (window as any).hadiahStatusService = hadiahStatusService;
      
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

// Initialize on load
preloadCameraKit().catch(console.error);

// Main hook
export const useCameraKit = (addLog: (message: string) => void) => {
  // State
  const [cameraState, setCameraState] = useState<CameraState>('initializing');
  const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>('user');
  
  // Refs
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaSourceRef = useRef<any>(null);
  const lensRepositoryRef = useRef<any>(null);
  const configRef = useRef<CameraKitConfig>(createAdaptiveConfig());
  const isInitializedRef = useRef<boolean>(false);
  const push2WebSubscribed = useRef<boolean>(false);

  // Media source creation
  const createSource = useCallback((stream: MediaStream) => {
    return createMediaStreamSource(stream, {
      transform: currentFacingMode === 'user' ? Transform2D.MirrorX : undefined
    });
  }, [currentFacingMode]);

  // Canvas creation and setup
  const createCanvas = useCallback((container: HTMLElement) => {
    const canvas = document.createElement('canvas');
    const config = configRef.current;
    
    canvas.width = config.canvas.width;
    canvas.height = config.canvas.height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'cover';
    canvas.style.transform = currentFacingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)';

    container.innerHTML = '';
    container.appendChild(canvas);
    
    return canvas;
  }, [currentFacingMode]);

  // Push2Web event subscription
  const setupPush2WebEvents = useCallback(() => {
    if (!push2WebInstance || push2WebSubscribed.current) return;
  
    try {
      push2WebInstance.events.addEventListener('error', (error: any) => {
        addLog(`❌ Push2Web error: ${error}`);
      });
  
      push2WebInstance.events.addEventListener('lensReceived', (event: any) => {
        addLog('📦 Lens received via Push2Web');
      });
  
      push2WebInstance.events.addEventListener('subscriptionChanged', (event: any) => {
        addLog('🔄 Push2Web subscription changed');
      });
  
      push2WebSubscribed.current = true;
      addLog('📡 Push2Web events subscribed');
    } catch (error) {
      addLog(`⚠️ Push2Web setup failed: ${error}`);
    }
  }, [addLog]);

  // Stream restoration for app visibility changes
  const restoreCameraFeed = useCallback(async (): Promise<boolean> => {
    if (!sessionRef.current || cameraState !== 'ready') return false;
    if (streamRef.current?.active) return true;

    try {
      addLog('🔄 Restoring camera feed...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: currentFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      mediaSourceRef.current = createSource(stream);

      await sessionRef.current.setSource(mediaSourceRef.current);
      addLog('✅ Camera feed restored');
      
      return true;
    } catch (error) {
      addLog(`❌ Restore failed: ${error}`);
      return false;
    }
  }, [addLog, currentFacingMode, cameraState, createSource]);

  // Visibility change handler
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => restoreCameraFeed(), 100);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [restoreCameraFeed]);

  // Main initialization method
  const initializeCameraKit = useCallback(async (
    stream: MediaStream,
    containerReference: React.RefObject<HTMLDivElement>
  ): Promise<boolean> => {
    try {
      const config = createAdaptiveConfig();
      configRef.current = config;
      
      // Update existing session
      if (isInitializedRef.current && sessionRef.current && cameraState === 'ready') {
        addLog('📱 Updating session...');
        
        streamRef.current = stream;
        mediaSourceRef.current = createSource(stream);
        
        await sessionRef.current.setSource(mediaSourceRef.current);
        addLog('✅ Session updated');
        return true;
      }

      setCameraState('initializing');
      addLog('🚀 Initializing Camera Kit...');
      
      const { cameraKit } = await withTimeout(preloadCameraKit(), 30000);
      
      // Create canvas
      if (!containerReference.current) throw new Error('Container not found');
      const canvas = createCanvas(containerReference.current);
      outputCanvasRef.current = canvas;

      // Create media source
      streamRef.current = stream;
      mediaSourceRef.current = createSource(stream);

      // Create session
      addLog('🔗 Creating session...');
      const session = await withTimeout(
        cameraKit.createSession({
          mediaStream: mediaSourceRef.current,
          canvas: canvas
        }),
        15000
      );

      sessionRef.current = session;

      // Load lens repository
      addLog('🔍 Loading lenses...');
      lensRepositoryRef.current = await withTimeout(
        cameraKit.lensRepository.loadLensGroups([config.lensGroupId]),
        10000
      );

      // Apply lens
      addLog(`🎨 Applying lens: ${config.lensId}`);
      await withTimeout(
        (session as any).applyLens({
          lensId: config.lensId,
          groupId: config.lensGroupId
        }),
        10000
      );

      setCameraState('ready');
      isInitializedRef.current = true;
      setupPush2WebEvents();
      
      addLog('🎉 Camera Kit ready!');
      return true;

    } catch (error) {
      setCameraState('error');
      addLog(`❌ Initialization failed: ${error}`);
      throw error;
    }
  }, [addLog, currentFacingMode, cameraState, createSource, createCanvas, setupPush2WebEvents]);

  // Simple camera initialization
  const initializeCamera = useCallback(async (canvas: HTMLCanvasElement, facingMode: 'user' | 'environment' = 'user') => {
    try {
      setCameraState('initializing');
      addLog('Starting camera...');

      const { cameraKit } = await withTimeout(preloadCameraKit(), 30000);
      
      const stream = await withTimeout(
        navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        }),
        15000
      );

      streamRef.current = stream;
      mediaSourceRef.current = createMediaStreamSource(stream);

      const session = await withTimeout(
        cameraKit.createSession({
          mediaStream: mediaSourceRef.current,
          canvas: canvas
        }),
        15000
      );

      sessionRef.current = session;
      outputCanvasRef.current = canvas;
      setCurrentFacingMode(facingMode);
      setCameraState('ready');
      
      addLog('✅ Camera ready');
      return session;

    } catch (error) {
      setCameraState('error');
      addLog(`❌ Camera failed: ${error}`);
      throw error;
    }
  }, [addLog]);

  // Camera switching
  const switchCamera = useCallback(async () => {
    if (!outputCanvasRef.current) return;

    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    
    // Cleanup
    sessionRef.current?.destroy();
    streamRef.current?.getTracks().forEach(track => track.stop());
    
    // Reinitialize
    await initializeCamera(outputCanvasRef.current, newFacingMode);
  }, [currentFacingMode, initializeCamera]);

  // Lens operations
  const reloadLens = useCallback(async () => {
    if (!sessionRef.current || !configRef.current) {
      throw new Error('No active session');
    }

    try {
      addLog('🔄 Reloading lens...');
      await sessionRef.current.applyLens({
        lensId: configRef.current.lensId,
        groupId: configRef.current.lensGroupId
      });
      addLog('✅ Lens reloaded');
    } catch (error) {
      addLog(`❌ Lens reload failed: ${error}`);
      throw error;
    }
  }, [addLog]);

  const applyLens = useCallback(async (lensId: string, lensGroupId: string) => {
    if (!sessionRef.current) {
      throw new Error('No active session');
    }

    try {
      addLog(`Applying lens: ${lensId}`);
      await sessionRef.current.applyLens({ lensId, groupId: lensGroupId });
      
      // Update config
      configRef.current.lensId = lensId;
      configRef.current.lensGroupId = lensGroupId;
      
      addLog('✅ Lens applied');
    } catch (error) {
      addLog(`❌ Lens failed: ${error}`);
      throw error;
    }
  }, [addLog]);

  // Getters
  const getCanvas = useCallback(() => outputCanvasRef.current, []);
  const getStream = useCallback(() => streamRef.current, []);

  // Push2Web utilities
  const getPush2WebStatus = useCallback(() => {
    if (!push2WebInstance) return null;
    
    return {
      isConnected: false,
      hasSession: !!sessionRef.current,
      subscribed: push2WebSubscribed.current
    };
  }, []);

  const subscribePush2Web = useCallback(async (eventHandlers: Record<string, (evt: any) => void> = {}) => {
    if (!push2WebInstance) {
      throw new Error('Push2Web not available');
    }

    try {
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        if (typeof handler === 'function') {
          push2WebInstance!.events.addEventListener(event as any, handler);
        }
      });

      push2WebSubscribed.current = true;
      addLog('✅ Push2Web subscribed');
    } catch (error) {
      addLog(`❌ Push2Web failed: ${error}`);
      throw error;
    }
  }, [addLog]);

  // Cleanup
  const cleanup = useCallback(() => {
    sessionRef.current?.destroy();
    streamRef.current?.getTracks().forEach(track => track.stop());
    
    if (outputCanvasRef.current?.parentElement) {
      outputCanvasRef.current.parentElement.innerHTML = '';
    }

    // Reset refs
    sessionRef.current = null;
    streamRef.current = null;
    outputCanvasRef.current = null;
    mediaSourceRef.current = null;
    lensRepositoryRef.current = null;
    isInitializedRef.current = false;
    push2WebSubscribed.current = false;
    
    setCameraState('initializing');
    addLog('Cleanup completed');
  }, [addLog]);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  return {
    // State
    cameraState,
    currentFacingMode,
    isReady: cameraState === 'ready' && !!sessionRef.current,
    
    // Methods
    initializeCamera,
    initializeCameraKit,
    switchCamera,
    reloadLens,
    applyLens,
    cleanup,
    restoreCameraFeed,
    
    // Getters
    getCanvas,
    getStream,
    getPush2WebStatus,
    subscribePush2Web,
    
    // Direct access (for advanced use)
    session: sessionRef.current,
    stream: streamRef.current,
    canvas: outputCanvasRef.current,
    mediaSource: mediaSourceRef.current,
    lensRepository: lensRepositoryRef.current
  };
};