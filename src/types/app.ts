// src/types/app.ts

/**
 * Main application state interface
 */
export interface AppState {
    isInitialized: boolean;
    isLoading: boolean;
    error: string | null;
    currentView: AppView;
  }
  
  /**
   * Application views/screens
   */
  export type AppView = 
    | 'camera'
    | 'preview'
    | 'settings'
    | 'error'
    | 'loading';
  
  /**
   * Device information interface
   */
  export interface DeviceInfo {
    userAgent: string;
    platform: string;
    isAndroid: boolean;
    isiOS: boolean;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    hasTouch: boolean;
    screenWidth: number;
    screenHeight: number;
    devicePixelRatio: number;
    orientation: 'portrait' | 'landscape';
    isHTTPS: boolean;
    isLocalhost: boolean;
  }
  
  /**
   * Browser capabilities interface
   */
  export interface BrowserCapabilities {
    mediaDevices: boolean;
    getUserMedia: boolean;
    mediaRecorder: boolean;
    canvasCapture: boolean;
    webShare: boolean;
    clipboard: boolean;
    permissions: boolean;
    fullscreen: boolean;
    webGL: boolean;
    webGL2: boolean;
    indexedDB: boolean;
    localStorage: boolean;
    serviceWorker: boolean;
  }
  
  /**
   * Performance metrics interface
   */
  export interface PerformanceMetrics {
    initializationTime: number;
    cameraStartTime: number;
    lensLoadTime: number;
    recordingStartTime: number;
    processingTime: number;
    memoryUsage?: number;
    fps?: number;
    batteryLevel?: number;
  }
  
  /**
   * User preferences interface
   */
  export interface UserPreferences {
    defaultFacingMode: 'user' | 'environment';
    enableAudio: boolean;
    recordingQuality: 'low' | 'medium' | 'high';
    autoDownload: boolean;
    showDebugInfo: boolean;
    enableVibration: boolean;
    theme: 'light' | 'dark' | 'auto';
    language: string;
  }
  
  /**
   * Analytics event interface
   */
  export interface AnalyticsEvent {
    eventName: string;
    timestamp: number;
    properties: Record<string, any>;
    userId?: string;
    sessionId: string;
  }
  
  /**
   * Error report interface
   */
  export interface ErrorReport {
    id: string;
    timestamp: number;
    error: {
      name: string;
      message: string;
      stack?: string;
    };
    context: {
      component: string;
      action: string;
      userAgent: string;
      url: string;
      userId?: string;
      sessionId: string;
    };
    deviceInfo: DeviceInfo;
    browserCapabilities: BrowserCapabilities;
    additionalData?: Record<string, any>;
  }
  
  /**
   * Video file metadata interface
   */
  export interface VideoMetadata {
    filename: string;
    size: number;
    duration: number;
    width: number;
    height: number;
    frameRate: number;
    bitrate: number;
    format: string;
    codec: string;
    createdAt: number;
    deviceInfo: Partial<DeviceInfo>;
    recordingSettings: {
      facingMode: 'user' | 'environment';
      hasAudio: boolean;
      quality: string;
    };
  }
  
  /**
   * Share options interface
   */
  export interface ShareOptions {
    title: string;
    text: string;
    url?: string;
    files?: File[];
    platforms?: string[];
  }
  
  /**
   * Toast notification interface
   */
  export interface ToastNotification {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    duration?: number;
    action?: {
      label: string;
      onClick: () => void;
    };
  }
  
  /**
   * Modal configuration interface
   */
  export interface ModalConfig {
    id: string;
    title: string;
    content: React.ReactNode;
    size?: 'small' | 'medium' | 'large' | 'fullscreen';
    closable?: boolean;
    backdrop?: boolean;
    animation?: boolean;
    onClose?: () => void;
    onOpen?: () => void;
  }
  
  /**
   * Feature flag interface
   */
  export interface FeatureFlag {
    key: string;
    enabled: boolean;
    description: string;
    rolloutPercentage?: number;
    conditions?: {
      platform?: string[];
      userAgent?: string[];
      country?: string[];
    };
  }
  
  /**
   * API response interface
   */
  export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
      code: string;
      message: string;
      details?: any;
    };
    metadata?: {
      timestamp: number;
      requestId: string;
      version: string;
    };
  }
  
  /**
   * Configuration validation result
   */
  export interface ConfigValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    recommendations: string[];
  }
  
  /**
   * Network status interface
   */
  export interface NetworkStatus {
    online: boolean;
    connectionType: string;
    effectiveType: string;
    downlink: number;
    rtt: number;
    saveData: boolean;
  }
  
  /**
   * Geolocation data interface
   */
  export interface GeolocationData {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number;
    altitudeAccuracy?: number;
    heading?: number;
    speed?: number;
    timestamp: number;
  }
  
  /**
   * Session data interface
   */
  export interface SessionData {
    id: string;
    userId?: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    events: AnalyticsEvent[];
    deviceInfo: DeviceInfo;
    userPreferences: UserPreferences;
    performanceMetrics: PerformanceMetrics;
    videosRecorded: number;
    errorsEncountered: number;
  }
  
  /**
   * Component props with common properties
   */
  export interface BaseComponentProps {
    className?: string;
    testId?: string;
    'data-testid'?: string;
    'aria-label'?: string;
    role?: string;
  }
  
  /**
   * Loading state interface
   */
  export interface LoadingState {
    isLoading: boolean;
    message?: string;
    progress?: number;
    stage?: string;
  }
  
  /**
   * Validation rule interface
   */
  export interface ValidationRule {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    custom?: (value: any) => boolean | string;
  }
  
  /**
   * Form field interface
   */
  export interface FormField {
    name: string;
    label: string;
    type: 'text' | 'email' | 'password' | 'number' | 'select' | 'checkbox' | 'radio';
    value: any;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    validation?: ValidationRule;
    options?: { label: string; value: any }[];
    error?: string;
  }
  
  /**
   * Theme configuration interface
   */
  export interface ThemeConfig {
    name: string;
    colors: {
      primary: string;
      secondary: string;
      background: string;
      surface: string;
      text: string;
      textSecondary: string;
      border: string;
      success: string;
      warning: string;
      error: string;
      info: string;
    };
    fonts: {
      primary: string;
      secondary: string;
      monospace: string;
    };
    spacing: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };
    borderRadius: {
      sm: string;
      md: string;
      lg: string;
      full: string;
    };
    shadows: {
      sm: string;
      md: string;
      lg: string;
    };
  }