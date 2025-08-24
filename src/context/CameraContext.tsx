// src/context/CameraContext.tsx - Push2Web integration
import React, { createContext, useContext, useRef, useState } from 'react';
import { useCameraKit, useCameraPermissions, useDebugLogger } from '../hooks';
import type { CameraState, PermissionState, ErrorInfo } from '../hooks';

interface CameraContextValue {
  // Camera Kit
  cameraState: CameraState;
  currentFacingMode: 'user' | 'environment';
  initializeCameraKit: (stream: MediaStream, containerRef: React.RefObject<HTMLDivElement>) => Promise<boolean>;
  switchCamera: () => Promise<MediaStream | null>;
  reloadLens: () => Promise<boolean>;
  pauseSession: () => void;
  resumeSession: () => void;
  cleanup: () => void;
  getCanvas: () => HTMLCanvasElement | null;
  getStream: () => MediaStream | null;
  restoreCameraFeed: () => void;
  isReady: boolean;
  isInitializing: boolean;
  
  // Permissions
  permissionState: PermissionState;
  errorInfo: ErrorInfo | null;
  checkCameraPermission: () => Promise<boolean>;
  requestCameraStream: (facingMode?: 'user' | 'environment', includeAudio?: boolean) => Promise<MediaStream | null>;
  requestPermission: () => Promise<MediaStream | null>;
  clearError: () => void;
  resetPermissionState: () => void;
  
  // Debug Logger
  debugLogs: string[];
  addLog: (message: string, level?: 'info' | 'warning' | 'error' | 'success') => void;
  clearLogs: () => void;
  exportLogs: () => void;
  
  // Push2Web Functions
  subscribePush2Web: (accessToken: string) => Promise<boolean>;
  unsubscribePush2Web: () => void;
  getPush2WebStatus: () => {
    available: boolean;
    subscribed: boolean;
    session: boolean;
    repository: boolean;
    lastLens: any;
    hasToken: boolean;
  };
  
  // Push2Web State
  isSubscribed: boolean;
  lastReceivedLens: any;
  
  // Login Kit State
  isLoggedIn: boolean;
  snapchatUser: any;
  accessToken: string | null;
  setLoginState: (loggedIn: boolean, user: any, token: string | null) => void;
  
  // Refs
  cameraFeedRef: React.RefObject<HTMLDivElement>;
}

const CameraContext = createContext<CameraContextValue | undefined>(undefined);

export const useCameraContext = () => {
  const context = useContext(CameraContext);
  if (context === undefined) {
    throw new Error('useCameraContext must be used within a CameraProvider');
  }
  return context;
};

interface CameraProviderProps {
  children: React.ReactNode;
}

export const CameraProvider: React.FC<CameraProviderProps> = ({ children }) => {
  const cameraFeedRef = useRef<HTMLDivElement>(null);
  
  // Login Kit state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [snapchatUser, setSnapchatUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  
  const { debugLogs, addLog, clearLogs, exportLogs } = useDebugLogger();
  
  const {
    permissionState,
    errorInfo,
    checkCameraPermission,
    requestCameraStream,
    requestPermission,
    clearError,
    resetPermissionState
  } = useCameraPermissions(addLog);
  
  const {
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
    isReady,
    isInitializing,
    subscribePush2Web,
    unsubscribePush2Web,
    getPush2WebStatus,
    isSubscribed,
    lastReceivedLens
  } = useCameraKit(addLog);

  // Handle login state changes
  const setLoginState = (loggedIn: boolean, user: any, token: string | null) => {
    setIsLoggedIn(loggedIn);
    setSnapchatUser(user);
    setAccessToken(token);
    
    if (loggedIn && token) {
      addLog(`✅ Login state updated: ${user?.displayName || 'Unknown'}`);
      
      // Auto-subscribe to Push2Web if Camera Kit is ready
      if (isReady) {
        addLog('🔄 Auto-subscribing to Push2Web...');
        setTimeout(() => {
          subscribePush2Web(token).then((success) => {
            if (success) {
              addLog('🎉 Auto-subscription successful');
            } else {
              addLog('❌ Auto-subscription failed');
            }
          });
        }, 500);
      } else {
        addLog('⏳ Camera Kit not ready - will auto-subscribe when ready');
      }
    } else {
      addLog('👋 Login state cleared');
      // Unsubscribe from Push2Web
      if (isSubscribed) {
        unsubscribePush2Web();
      }
    }
  };

  // Enhanced subscribePush2Web that updates login state
  const enhancedSubscribePush2Web = async (token: string): Promise<boolean> => {
    try {
      const success = await subscribePush2Web(token);
      if (success) {
        // Update access token if subscription successful
        setAccessToken(token);
      }
      return success;
    } catch (error) {
      addLog(`❌ Enhanced subscription failed: ${error}`);
      return false;
    }
  };

  // Enhanced cleanup that handles login state
  const enhancedCleanup = () => {
    // Clear login state
    setIsLoggedIn(false);
    setSnapchatUser(null);
    setAccessToken(null);
    
    // Original cleanup
    cleanup();
    
    addLog('🧹 Enhanced cleanup completed');
  };

  const value: CameraContextValue = {
    // Camera Kit
    cameraState,
    currentFacingMode,
    initializeCameraKit,
    switchCamera,
    reloadLens,
    pauseSession,
    resumeSession,
    cleanup: enhancedCleanup,
    getCanvas,
    getStream,
    restoreCameraFeed,
    isReady,
    isInitializing,
    
    // Permissions
    permissionState,
    errorInfo,
    checkCameraPermission,
    requestCameraStream,
    requestPermission,
    clearError,
    resetPermissionState,
    
    // Debug Logger
    debugLogs,
    addLog,
    clearLogs,
    exportLogs,
    
    // Push2Web Functions
    subscribePush2Web: enhancedSubscribePush2Web,
    unsubscribePush2Web,
    getPush2WebStatus,
    
    // Push2Web State
    isSubscribed,
    lastReceivedLens,
    
    // Login Kit State
    isLoggedIn,
    snapchatUser,
    accessToken,
    setLoginState,
    
    // Refs
    cameraFeedRef
  };

  return (
    <CameraContext.Provider value={value}>
      {children}
    </CameraContext.Provider>
  );
};