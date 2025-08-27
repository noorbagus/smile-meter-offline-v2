// src/hooks/useCameraPermissions.ts - FORCE EXACT 4K constraints + Firefox orientation fix
import { useState, useCallback } from 'react';
import { detectBrowser, testCameraOrientation, getBrowserOptimizedConstraints, CameraOrientationFix } from '../utils/browserDetection';

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
  const [cameraOrientationFix, setCameraOrientationFix] = useState<CameraOrientationFix | null>(null);

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

      // Test Firefox orientation fix
      const browserInfo = detectBrowser();
      if (browserInfo.isFirefox) {
        addLog(`🦊 Firefox ${browserInfo.version} detected - testing camera orientation...`);
        try {
          const orientationFix = await testCameraOrientation(addLog);
          setCameraOrientationFix(orientationFix);
        } catch (orientationError) {
          addLog(`⚠️ Orientation test failed: ${orientationError}`);
        }
      }

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
  }, [addLog]);

  const requestCameraStream = useCallback(async (
    facingMode: 'user' | 'environment' = 'user',
    includeAudio: boolean = true
  ): Promise<MediaStream | null> => {
    try {
      const browserInfo = detectBrowser();
      
      if (browserInfo.isFirefox) {
        addLog(`🦊 Firefox detected - using optimized constraints`);
        // Use Firefox-optimized constraints
        const constraints = getBrowserOptimizedConstraints(facingMode);
        if (!includeAudio) {
          constraints.audio = false;
        }
        
        addLog(`🎤 Audio requested: ${includeAudio ? 'YES' : 'NO'}`);
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        const audioTracks = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();
        
        addLog(`✅ Firefox stream: ${videoTracks.length} video, ${audioTracks.length} audio tracks`);
        
        if (videoTracks.length > 0) {
          const settings = videoTracks[0].getSettings();
          const actualWidth = settings.width || 0;
          const actualHeight = settings.height || 0;
          const actualFPS = settings.frameRate || 0;
          
          addLog(`📹 Firefox resolution: ${actualWidth}×${actualHeight}@${actualFPS}fps`);
          
          // Check if landscape orientation achieved
          const isLandscape = actualWidth > actualHeight;
          addLog(`🔄 Orientation: ${isLandscape ? 'LANDSCAPE ✅' : 'PORTRAIT ⚠️'}`);
        }
        
        if (includeAudio && audioTracks.length === 0) {
          addLog('⚠️ WARNING: Firefox audio not available');
        }
        
        setPermissionState('granted');
        setErrorInfo(null);
        return stream;
      }
      
      // Non-Firefox: Use EXACT 4K constraints
      addLog('📸 Non-Firefox: Requesting EXACT 4K landscape camera stream...');
      
      const exactConstraints: MediaStreamConstraints = {
        video: { 
          facingMode,
          width: { exact: 2560 },
          height: { exact: 1440 },
          frameRate: { exact: 30 }
        },
        audio: includeAudio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { exact: 48000 },
          channelCount: { exact: 2 }
        } : false
      };

      addLog(`🎤 Audio requested: ${includeAudio ? 'YES with EXACT 48kHz stereo' : 'NO'}`);
      addLog(`🎯 FORCE EXACT: 2560×1440@30fps (NO FALLBACK)`);
      
      const stream = await navigator.mediaDevices.getUserMedia(exactConstraints);
      
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      
      addLog(`✅ EXACT stream obtained: ${videoTracks.length} video, ${audioTracks.length} audio tracks`);
      
      if (videoTracks.length > 0) {
        const settings = videoTracks[0].getSettings();
        const actualWidth = settings.width || 0;
        const actualHeight = settings.height || 0;
        const actualFPS = settings.frameRate || 0;
        
        addLog(`📹 Video: ${actualWidth}×${actualHeight}@${actualFPS}fps`);
        
        if (actualWidth === 2560 && actualHeight === 1440) {
          addLog(`✅ SUCCESS: Got EXACT 4K landscape!`);
        } else {
          addLog(`❌ FAILED: Expected 2560×1440, got ${actualWidth}×${actualHeight}`);
        }
      }
      
      setPermissionState('granted');
      setErrorInfo(null);
      return stream;

    } catch (streamError: any) {
      addLog(`❌ Camera stream failed: ${streamError.name} - ${streamError.message}`);
      
      if (streamError.name === 'OverconstrainedError') {
        addLog(`🚨 Constraints too strict - trying fallback...`);
        
        try {
          const fallbackConstraints: MediaStreamConstraints = {
            video: { 
              facingMode,
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
          
          const fallbackStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
          
          const fallbackVideo = fallbackStream.getVideoTracks()[0];
          const fallbackSettings = fallbackVideo?.getSettings();
          const fallbackRes = `${fallbackSettings?.width}×${fallbackSettings?.height}`;
          
          addLog(`✅ FALLBACK successful: ${fallbackRes}@${fallbackSettings?.frameRate}fps`);
          
          setPermissionState('granted');
          setErrorInfo(null);
          return fallbackStream;
          
        } catch (fallbackError) {
          addLog(`❌ Fallback also failed: ${fallbackError}`);
          setErrorInfo({
            type: 'device',
            message: 'Camera constraints not supported',
            solution: 'Device/browser has WebRTC limitations'
          });
        }
      } else if (streamError.name === 'NotAllowedError') {
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
      addLog('🔒 Requesting camera + microphone permission...');
      
      const browserInfo = detectBrowser();
      const constraints = browserInfo.isFirefox ? 
        getBrowserOptimizedConstraints('user') :
        {
          video: { 
            facingMode: 'user',
            width: { exact: 2560 },
            height: { exact: 1440 }
          },
          audio: true
        };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      const videoSettings = videoTracks[0]?.getSettings();
      const resolution = `${videoSettings?.width}×${videoSettings?.height}`;
      
      addLog(`✅ Permission granted: ${resolution}, ${audioTracks.length} audio tracks`);
      
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
        solution: 'Enable camera access in browser settings'
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
    cameraOrientationFix,
    checkCameraPermission,
    requestCameraStream,
    requestPermission,
    clearError,
    resetPermissionState,
    isHTTPS: checkHTTPS,
    hasMediaDeviceSupport: checkMediaDeviceSupport
  };
};