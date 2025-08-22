// src/hooks/useCameraPermissions.ts - FORCE EXACT 4K constraints
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
      addLog('📸 FORCE EXACT: Requesting 4K landscape camera stream...');
      
      // FORCE EXACT constraints - no fallback!
      const exactConstraints: MediaStreamConstraints = {
        video: { 
          facingMode,
          // FORCE EXACT 4K landscape - no compromise!
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
      
      // Verify we got EXACT resolution
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      
      addLog(`✅ EXACT stream obtained: ${videoTracks.length} video, ${audioTracks.length} audio tracks`);
      
      if (includeAudio && audioTracks.length === 0) {
        addLog('⚠️ WARNING: Audio requested but no audio tracks received!');
      }
      
      // CRITICAL: Verify exact resolution achieved
      videoTracks.forEach((track, index) => {
        const settings = track.getSettings();
        const actualWidth = settings.width || 0;
        const actualHeight = settings.height || 0;
        const actualFPS = settings.frameRate || 0;
        
        addLog(`📹 Video track ${index}: ${track.label || 'Camera'}`);
        addLog(`   - EXACT Resolution: ${actualWidth}×${actualHeight}@${actualFPS}fps`);
        addLog(`   - Facing: ${settings.facingMode}`);
        
        // Verify we got EXACT 4K
        if (actualWidth === 2560 && actualHeight === 1440) {
          addLog(`✅ SUCCESS: Got EXACT 4K landscape!`);
        } else {
          addLog(`❌ FAILED: Expected 2560×1440, got ${actualWidth}×${actualHeight}`);
          addLog(`🚨 WebRTC EXACT constraints rejected by browser/hardware`);
        }
        
        // Check if landscape orientation achieved
        const isLandscape = actualWidth > actualHeight;
        addLog(`🔄 Orientation: ${isLandscape ? 'LANDSCAPE ✅' : 'PORTRAIT ⚠️'}`);
      });
      
      audioTracks.forEach((track, index) => {
        const settings = track.getSettings();
        addLog(`🎤 Audio track ${index}: ${track.label || 'Microphone'}`);
        addLog(`   - State: ${track.readyState}, Enabled: ${track.enabled}`);
        addLog(`   - EXACT Sample rate: ${settings.sampleRate}Hz, Channels: ${settings.channelCount}`);
      });
      
      setPermissionState('granted');
      setErrorInfo(null);
      return stream;

    } catch (streamError: any) {
      addLog(`❌ FORCE EXACT constraints FAILED: ${streamError.name} - ${streamError.message}`);
      
      if (streamError.name === 'OverconstrainedError') {
        addLog(`🚨 EXACT constraints TOO STRICT for this device/browser`);
        addLog(`📱 Browser/WebRTC cannot provide EXACT 2560×1440@30fps`);
        
        // Fallback to ideal constraints
        addLog(`🔄 Falling back to IDEAL constraints...`);
        
        try {
          const fallbackConstraints: MediaStreamConstraints = {
            video: { 
              facingMode,
              // Fallback to ideal with reasonable range
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
          addLog(`⚠️ Could not achieve EXACT 4K - WebRTC browser limitation`);
          
          setPermissionState('granted');
          setErrorInfo(null);
          return fallbackStream;
          
        } catch (fallbackError) {
          addLog(`❌ Fallback also failed: ${fallbackError}`);
          setErrorInfo({
            type: 'device',
            message: 'Camera constraints not supported - even fallback failed',
            solution: 'Device/browser has severe WebRTC limitations'
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
      } else if (streamError.name === 'NotSupportedError') {
        setErrorInfo({
          type: 'device',
          message: 'Camera not supported in this browser',
          solution: 'Please try using Chrome, Firefox, Safari, or Edge'
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
      addLog('🔒 Manually requesting EXACT 4K camera + microphone permission...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          // EXACT for permission check too
          width: { exact: 2560 },
          height: { exact: 1440 }
        },
        audio: true
      });
      
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      const videoSettings = videoTracks[0]?.getSettings();
      const resolution = `${videoSettings?.width}×${videoSettings?.height}`;
      const isExact4K = videoSettings?.width === 2560 && videoSettings?.height === 1440;
      
      addLog(`✅ Permission granted: ${resolution}, ${audioTracks.length} audio tracks`);
      addLog(`🎯 EXACT 4K achieved: ${isExact4K ? 'YES ✅' : 'NO ❌'}`);
      
      // Stop immediately after permission check
      stream.getTracks().forEach(track => track.stop());
      
      setPermissionState('granted');
      setErrorInfo(null);
      
      return stream;
    } catch (error: any) {
      addLog(`❌ EXACT permission request failed: ${error.message}`);
      
      if (error.name === 'OverconstrainedError') {
        addLog(`🚨 Device cannot provide EXACT 4K even for permission check`);
      }
      
      setPermissionState('denied');
      setErrorInfo({
        type: 'permission',
        message: 'Camera/microphone permission denied or constraints too strict',
        solution: 'Enable camera access or device has WebRTC limitations'
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