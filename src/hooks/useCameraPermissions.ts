// src/hooks/useCameraPermissions.ts - Landscape constraints for Brio hardware
import { useState, useCallback } from 'react';

export type PermissionState = 'checking' | 'granted' | 'denied' | 'prompt';
export type CameraState = 'initializing' | 'ready' | 'error' | 'permission_denied' | 'https_required';

export interface ErrorInfo {
  type: 'permission' | 'https' | 'camera_kit' | 'device' | 'unknown';
  message: string;
  solution: string;
}

export const useCameraPermissions = (addLog: (message: string) => void) => {
  const [permissionState, setPermissionState] = useState<PermissionState>('checking');
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);

  const checkHTTPS = useCallback((): boolean => {
    const isHTTPS = location.protocol === 'https:' || location.hostname === 'localhost';
    
    if (!isHTTPS) {
      addLog('❌ HTTPS required for camera access');
      setErrorInfo({
        type: 'https',
        message: 'Camera access requires HTTPS',
        solution: 'Please access this site via HTTPS or use localhost for development'
      });
      return false;
    }
    
    return true;
  }, [addLog]);

  const checkMediaDeviceSupport = useCallback((): boolean => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      addLog('❌ Media devices not supported');
      setErrorInfo({
        type: 'device',
        message: 'Your device/browser does not support camera access',
        solution: 'Please use a modern browser with camera support'
      });
      return false;
    }
    
    return true;
  }, [addLog]);

  const checkPermissionAPI = useCallback(async (): Promise<boolean> => {
    if (!navigator.permissions) {
      addLog('⚠️ Permissions API not available, will prompt on getUserMedia');
      return true;
    }

    try {
      const cameraPermission = await navigator.permissions.query({ 
        name: 'camera' as PermissionName 
      });
      
      addLog(`📋 Camera permission state: ${cameraPermission.state}`);
      
      if (cameraPermission.state === 'denied') {
        setPermissionState('denied');
        setErrorInfo({
          type: 'permission',
          message: 'Camera access has been denied',
          solution: 'Please enable camera access in your browser settings and refresh the page'
        });
        return false;
      } else if (cameraPermission.state === 'granted') {
        setPermissionState('granted');
        return true;
      } else {
        setPermissionState('prompt');
        return true;
      }
    } catch (permErr) {
      addLog(`⚠️ Permission query failed: ${permErr}`);
      return true;
    }
  }, [addLog]);

  const checkCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      addLog('🔍 Checking camera permissions...');
      setErrorInfo(null);

      if (!checkHTTPS()) return false;
      if (!checkMediaDeviceSupport()) return false;

      const permissionOK = await checkPermissionAPI();
      if (!permissionOK) return false;

      addLog('✅ Permission checks passed');
      return true;

    } catch (error) {
      addLog(`❌ Permission check failed: ${error}`);
      setErrorInfo({
        type: 'unknown',
        message: 'Failed to check camera permissions',
        solution: 'Please refresh the page and try again'
      });
      return false;
    }
  }, [addLog, checkHTTPS, checkMediaDeviceSupport, checkPermissionAPI]);

  const requestCameraStream = useCallback(async (
    facingMode: 'user' | 'environment' = 'user',
    includeAudio: boolean = true
  ): Promise<MediaStream | null> => {
    try {
      addLog('📸 Requesting LANDSCAPE camera stream (Brio native resolution)...');
      
      // LANDSCAPE constraints for Brio hardware (2560x1440 native)
      const constraints: MediaStreamConstraints = {
        video: { 
          facingMode,
          // Request LANDSCAPE to match Brio sensor orientation
          width: { ideal: 2560, min: 1280, max: 3840 },
          height: { ideal: 1440, min: 720, max: 2160 },
          frameRate: { ideal: 30, min: 15, max: 60 }
        },
        audio: includeAudio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 2 }
        } : false
      };

      addLog(`🎤 Audio requested: ${includeAudio ? 'YES with high-quality constraints' : 'NO'}`);
      addLog(`🏞️ LANDSCAPE constraints: ${(constraints.video as any).width.ideal}x${(constraints.video as any).height.ideal} (Brio native)`);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Verify stream quality
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      
      addLog(`✅ Stream obtained: ${videoTracks.length} video, ${audioTracks.length} audio tracks`);
      
      if (includeAudio && audioTracks.length === 0) {
        addLog('⚠️ WARNING: Audio requested but no audio tracks received!');
      }
      
      // Log detailed track info with landscape focus
      videoTracks.forEach((track, index) => {
        const settings = track.getSettings();
        const resolution = `${settings.width || 'unknown'}x${settings.height || 'unknown'}`;
        const isBrioOptimal = (settings.width || 0) >= 2560;
        const isLandscape = (settings.width || 0) > (settings.height || 0);
        
        addLog(`📹 Video track ${index}: ${track.label || 'Camera'}`);
        addLog(`   - Resolution: ${resolution}@${settings.frameRate}fps`);
        addLog(`   - Orientation: ${isLandscape ? 'LANDSCAPE ✅' : 'PORTRAIT ⚠️'}`);
        addLog(`   - Quality: ${isBrioOptimal ? 'Brio Optimal ✅' : 'Standard'}`);
        addLog(`   - Facing: ${settings.facingMode}`);
        
        if (!isLandscape) {
          addLog(`⚠️ Got portrait ${resolution} instead of landscape - browser may have rotated`);
        }
      });
      
      audioTracks.forEach((track, index) => {
        const settings = track.getSettings();
        addLog(`🎤 Audio track ${index}: ${track.label || 'Microphone'}`);
        addLog(`   - State: ${track.readyState}, Enabled: ${track.enabled}`);
        addLog(`   - Sample rate: ${settings.sampleRate}Hz, Channels: ${settings.channelCount}`);
      });
      
      setPermissionState('granted');
      setErrorInfo(null);
      return stream;

    } catch (streamError: any) {
      addLog(`❌ Landscape camera stream failed: ${streamError.name} - ${streamError.message}`);
      
      if (streamError.name === 'NotAllowedError') {
        setPermissionState('denied');
        setErrorInfo({
          type: 'permission',
          message: 'Camera/microphone access denied by user',
          solution: 'Please click "Allow" when prompted for camera and microphone access'
        });
      } else if (streamError.name === 'NotFoundError') {
        setErrorInfo({
          type: 'device',
          message: 'No camera found on this device',
          solution: 'Please ensure your device has a camera and try again'
        });
      } else if (streamError.name === 'NotSupportedError') {
        setErrorInfo({
          type: 'device',
          message: 'Camera not supported in this browser',
          solution: 'Please try using Chrome, Firefox, Safari, or Edge'
        });
      } else if (streamError.name === 'OverconstrainedError') {
        addLog('⚠️ Brio constraints too strict, trying HD landscape fallback...');
        
        // HD landscape fallback
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode,
              // HD landscape fallback
              width: { ideal: 1920, min: 640 },
              height: { ideal: 1080, min: 480 }
            },
            audio: includeAudio
          });
          
          const fallbackVideo = fallbackStream.getVideoTracks()[0];
          const fallbackSettings = fallbackVideo?.getSettings();
          const fallbackRes = `${fallbackSettings?.width}x${fallbackSettings?.height}`;
          
          addLog(`✅ HD landscape fallback successful: ${fallbackRes}`);
          setPermissionState('granted');
          setErrorInfo(null);
          return fallbackStream;
          
        } catch (fallbackError) {
          addLog(`❌ HD landscape fallback also failed: ${fallbackError}`);
          setErrorInfo({
            type: 'device',
            message: 'Camera constraints not supported',
            solution: 'Try using a different browser or device'
          });
        }
      } else {
        setErrorInfo({
          type: 'unknown',
          message: `Camera error: ${streamError.message}`,
          solution: 'Please refresh the page and try again'
        });
      }
      
      return null;
    }
  }, [addLog]);

  const requestPermission = useCallback(async (): Promise<MediaStream | null> => {
    try {
      addLog('🔒 Manually requesting LANDSCAPE camera + microphone permission...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          // Request landscape for permission check
          width: { ideal: 2560, min: 640 },
          height: { ideal: 1440, min: 480 }
        },
        audio: true
      });
      
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      const videoSettings = videoTracks[0]?.getSettings();
      const resolution = `${videoSettings?.width}x${videoSettings?.height}`;
      const isLandscape = (videoSettings?.width || 0) > (videoSettings?.height || 0);
      
      addLog(`✅ Permission granted: ${resolution} ${isLandscape ? '(LANDSCAPE)' : '(PORTRAIT)'}, ${audioTracks.length} audio tracks`);
      
      // Stop immediately after permission check
      stream.getTracks().forEach(track => track.stop());
      
      setPermissionState('granted');
      setErrorInfo(null);
      
      return stream;
    } catch (error: any) {
      addLog(`❌ Permission request failed: ${error.message}`);
      setPermissionState('denied');
      setErrorInfo({
        type: 'permission',
        message: 'Camera/microphone permission denied',
        solution: 'Please enable camera and microphone access in browser settings'
      });
      
      return null;
    }
  }, [addLog]);

  const clearError = useCallback(() => {
    setErrorInfo(null);
  }, []);

  const resetPermissionState = useCallback(() => {
    setPermissionState('checking');
    setErrorInfo(null);
  }, []);

  return {
    permissionState,
    errorInfo,
    checkCameraPermission,
    requestCameraStream,
    requestPermission,
    clearError,
    resetPermissionState,
    isHTTPS: checkHTTPS,
    hasMediaDeviceSupport: checkMediaDeviceSupport
  };
};