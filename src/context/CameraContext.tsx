// src/context/CameraContext.tsx - Pure Camera Kit without Push2Web
import React, { createContext, useContext, useRef } from 'react';
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
    isInitializing
  } = useCameraKit(addLog);

  const value: CameraContextValue = {
    // Camera Kit
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
    
    // Refs
    cameraFeedRef
  };

  return (
    <CameraContext.Provider value={value}>
      {children}
    </CameraContext.Provider>
  );
};