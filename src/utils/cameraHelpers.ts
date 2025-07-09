// src/utils/cameraHelpers.ts

/**
 * Check if the current environment supports camera access
 */
export const isCameraSupported = (): boolean => {
    return !!(
      navigator.mediaDevices && 
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof window !== 'undefined' &&
      'MediaRecorder' in window
    );
  };
  
  /**
   * Check if the current environment requires HTTPS for camera access
   */
  export const requiresHTTPS = (): boolean => {
    return location.protocol !== 'https:' && location.hostname !== 'localhost';
  };
  
  /**
   * Get optimal camera constraints based on device capabilities
   */
  export const getOptimalCameraConstraints = (
    facingMode: 'user' | 'environment' = 'user',
    includeAudio: boolean = true
  ): MediaStreamConstraints => {
    return {
      video: {
        facingMode,
        width: { ideal: 1280, min: 640, max: 1920 },
        height: { ideal: 720, min: 480, max: 1080 },
        frameRate: { ideal: 30, min: 15, max: 60 }
      },
      audio: includeAudio ? {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } : false
    };
  };
  
  /**
   * Get available camera devices
   */
  export const getAvailableCameras = async (): Promise<MediaDeviceInfo[]> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
      console.warn('Failed to enumerate camera devices:', error);
      return [];
    }
  };
  
  /**
   * Check if device has multiple cameras
   */
  export const hasMultipleCameras = async (): Promise<boolean> => {
    const cameras = await getAvailableCameras();
    return cameras.length > 1;
  };
  
  /**
   * Stop all tracks in a media stream
   */
  export const stopMediaStream = (stream: MediaStream | null): void => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
    }
  };
  
  /**
   * Get camera capabilities for a given stream
   */
  export const getCameraCapabilities = (stream: MediaStream): {
    facingMode?: string;
    width?: number;
    height?: number;
    frameRate?: number;
  } => {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return {};
  
    const settings = videoTrack.getSettings();
    return {
      facingMode: settings.facingMode,
      width: settings.width,
      height: settings.height,
      frameRate: settings.frameRate
    };
  };
  
  /**
   * Switch camera facing mode
   */
  export const switchCameraFacing = (currentMode: 'user' | 'environment'): 'user' | 'environment' => {
    return currentMode === 'user' ? 'environment' : 'user';
  };
  
  /**
   * Check if stream has audio track
   */
  export const hasAudioTrack = (stream: MediaStream): boolean => {
    return stream.getAudioTracks().length > 0;
  };
  
  /**
   * Check if stream has video track
   */
  export const hasVideoTrack = (stream: MediaStream): boolean => {
    return stream.getVideoTracks().length > 0;
  };
  
  /**
   * Get stream track states
   */
  export const getStreamTrackStates = (stream: MediaStream): {
    video: {
      enabled: boolean;
      muted: boolean;
      readyState: MediaStreamTrackState;
    } | null;
    audio: {
      enabled: boolean;
      muted: boolean;
      readyState: MediaStreamTrackState;
    } | null;
  } => {
    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];
  
    return {
      video: videoTrack ? {
        enabled: videoTrack.enabled,
        muted: videoTrack.muted,
        readyState: videoTrack.readyState
      } : null,
      audio: audioTrack ? {
        enabled: audioTrack.enabled,
        muted: audioTrack.muted,
        readyState: audioTrack.readyState
      } : null
    };
  };
  
  /**
   * Create a safe canvas stream with fallback
   */
  export const createCanvasStream = (
    canvas: HTMLCanvasElement, 
    frameRate: number = 30
  ): MediaStream | null => {
    try {
      return canvas.captureStream(frameRate);
    } catch (error) {
      console.warn('Failed to capture canvas stream:', error);
      return null;
    }
  };
  
  /**
   * Check if canvas is valid for recording
   */
  export const isCanvasValid = (canvas: HTMLCanvasElement | null): boolean => {
    return !!(
      canvas && 
      canvas.width > 0 && 
      canvas.height > 0 &&
      typeof canvas.captureStream === 'function'
    );
  };
  
  /**
   * Get browser camera support info
   */
  export const getBrowserCameraSupport = (): {
    getUserMedia: boolean;
    mediaRecorder: boolean;
    canvasCapture: boolean;
    webShare: boolean;
    clipboard: boolean;
  } => {
    return {
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      mediaRecorder: typeof MediaRecorder !== 'undefined',
      canvasCapture: typeof HTMLCanvasElement.prototype.captureStream === 'function',
      webShare: typeof navigator.share === 'function',
      clipboard: !!(navigator.clipboard && 'write' in navigator.clipboard)
    };
  };