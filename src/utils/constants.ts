// src/utils/constants.ts

/**
 * App-wide constants
 */
export const APP_CONFIG = {
    name: 'Web AR Netramaya',
    version: '1.0.0',
    description: 'AR Camera with Snap Camera Kit',
    attribution: 'Powered by Snap Camera Kit'
  } as const;
  
  /**
   * Camera configuration constants
   */
  export const CAMERA_CONFIG = {
    DEFAULT_FACING_MODE: 'user' as const,
    IDEAL_WIDTH: 1280,
    IDEAL_HEIGHT: 720,
    MIN_WIDTH: 640,
    MIN_HEIGHT: 480,
    MAX_WIDTH: 1920,
    MAX_HEIGHT: 1080,
    IDEAL_FRAME_RATE: 30,
    MIN_FRAME_RATE: 15,
    MAX_FRAME_RATE: 60
  } as const;
  
  /**
   * Recording configuration constants
   */
  export const RECORDING_CONFIG = {
    DEFAULT_FRAME_RATE: 30,
    ANDROID_BITRATE: 2000000, // 2 Mbps for Android
    STANDARD_BITRATE: 2500000, // 2.5 Mbps for other platforms
    AUDIO_BITRATE: 128000, // 128 kbps
    MIN_RECORDING_DURATION: 2, // seconds
    MAX_RECORDING_DURATION: 60, // seconds
    TIME_SLICE: 1000, // milliseconds
    ANDROID_TIME_SLICE: 100 // milliseconds for Android
  } as const;
  
  /**
   * File format and mime types
   */
  export const MEDIA_FORMATS = {
    ANDROID_PREFERRED: [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=h264,aac',
      'video/mp4'
    ],
    STANDARD_PREFERRED: [
      'video/mp4;codecs=h264,aac',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm'
    ],
    FALLBACK: 'video/webm'
  } as const;
  
  /**
   * Social media platform limits
   */
  export const SOCIAL_MEDIA_LIMITS = {
    INSTAGRAM: {
      MAX_SIZE: 100 * 1024 * 1024, // 100MB
      MAX_DURATION: 60, // seconds
      FORMATS: ['video/mp4']
    },
    TIKTOK: {
      MAX_SIZE: 72 * 1024 * 1024, // 72MB
      MAX_DURATION: 60, // seconds
      FORMATS: ['video/mp4']
    },
    YOUTUBE: {
      MAX_SIZE: 256 * 1024 * 1024, // 256MB
      MAX_DURATION: Infinity,
      FORMATS: ['video/mp4', 'video/webm']
    },
    TWITTER: {
      MAX_SIZE: 512 * 1024 * 1024, // 512MB
      MAX_DURATION: 140, // seconds
      FORMATS: ['video/mp4']
    }
  } as const;
  
  /**
   * UI timing constants
   */
  export const UI_TIMING = {
    LOADING_DELAY: 100, // ms
    ANIMATION_DURATION: 300, // ms
    TOAST_DURATION: 3000, // ms
    AUTO_HIDE_CONTROLS: 5000, // ms
    DEBOUNCE_DELAY: 300, // ms
    RETRY_DELAY: 1000 // ms
  } as const;
  
  /**
   * Debug and logging constants
   */
  export const DEBUG_CONFIG = {
    MAX_LOGS: 15,
    LOG_LEVELS: ['info', 'warning', 'error', 'success'] as const,
    CONSOLE_COLORS: {
      info: '#3b82f6',
      warning: '#f59e0b',
      error: '#ef4444',
      success: '#10b981'
    }
  } as const;
  
  /**
   * Error retry configuration
   */
  export const RETRY_CONFIG = {
    MAX_RETRIES: 3,
    BASE_DELAY: 1000, // ms
    MAX_DELAY: 5000, // ms
    BACKOFF_FACTOR: 2
  } as const;
  
  /**
   * Browser feature detection
   */
  export const BROWSER_FEATURES = {
    REQUIRED: [
      'mediaDevices',
      'getUserMedia',
      'MediaRecorder',
      'canvas',
      'WebGL'
    ],
    OPTIONAL: [
      'share',
      'clipboard',
      'permissions',
      'deviceMemory'
    ]
  } as const;
  
  /**
   * Canvas and rendering constants
   */
  export const CANVAS_CONFIG = {
    DEFAULT_WIDTH: 1280,
    DEFAULT_HEIGHT: 720,
    BACKGROUND_COLOR: 'transparent',
    CONTEXT_TYPE: '2d' as const,
    WEBGL_CONTEXT: 'webgl2' as const
  } as const;
  
  /**
   * Network and API constants
   */
  export const NETWORK_CONFIG = {
    TIMEOUT: 10000, // ms
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // ms
    CDN_BASE_URL: 'https://cdnjs.cloudflare.com'
  } as const;
  
  /**
   * Local storage keys
   */
  export const STORAGE_KEYS = {
    USER_PREFERENCES: 'webar_preferences',
    DEBUG_LOGS: 'webar_debug_logs',
    CAMERA_SETTINGS: 'webar_camera_settings',
    LAST_FACING_MODE: 'webar_facing_mode'
  } as const;
  
  /**
   * Error messages
   */
  export const ERROR_MESSAGES = {
    CAMERA_NOT_SUPPORTED: 'Camera not supported on this device',
    HTTPS_REQUIRED: 'HTTPS is required for camera access',
    PERMISSION_DENIED: 'Camera permission denied',
    DEVICE_NOT_FOUND: 'No camera found',
    RECORDING_FAILED: 'Recording failed',
    SHARE_NOT_SUPPORTED: 'Sharing not supported on this device',
    NETWORK_ERROR: 'Network connection error',
    UNKNOWN_ERROR: 'An unexpected error occurred'
  } as const;
  
  /**
   * Success messages
   */
  export const SUCCESS_MESSAGES = {
    CAMERA_INITIALIZED: 'Camera initialized successfully',
    RECORDING_STARTED: 'Recording started',
    RECORDING_COMPLETED: 'Recording completed',
    VIDEO_SHARED: 'Video shared successfully',
    VIDEO_DOWNLOADED: 'Video downloaded',
    PERMISSION_GRANTED: 'Camera permission granted'
  } as const;
  
  /**
   * Feature flags
   */
  export const FEATURE_FLAGS = {
    ENABLE_DEBUG_PANEL: true,
    ENABLE_PERFORMANCE_MONITORING: false,
    ENABLE_ANALYTICS: false,
    ENABLE_ERROR_REPORTING: false,
    ENABLE_OFFLINE_MODE: false
  } as const;