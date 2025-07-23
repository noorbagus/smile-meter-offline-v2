// src/utils/audioDebug.ts - Complete audio debugging utilities
export interface AudioTrackInfo {
    index: number;
    label: string;
    id: string;
    kind: string;
    readyState: MediaStreamTrackState;
    enabled: boolean;
    muted: boolean;
    settings: MediaTrackSettings;
    constraints?: MediaTrackConstraints;
  }
  
  export interface StreamDebugInfo {
    id: string;
    active: boolean;
    videoTracks: number;
    audioTracks: number;
    audioDetails: AudioTrackInfo[];
    timestamp: number;
    context: string;
  }
  
  /**
   * Comprehensive audio track debugging
   */
  export const debugAudioTracks = (
    stream: MediaStream | null, 
    context: string, 
    addLog: (msg: string) => void
  ): StreamDebugInfo | null => {
    if (!stream) {
      addLog(`🔇 ${context}: No stream available`);
      return null;
    }
    
    const audioTracks = stream.getAudioTracks();
    const videoTracks = stream.getVideoTracks();
    
    addLog(`📊 ${context}: ${videoTracks.length} video, ${audioTracks.length} audio tracks`);
    
    const audioDetails: AudioTrackInfo[] = audioTracks.map((track, index) => {
      const settings = track.getSettings();
      const info: AudioTrackInfo = {
        index,
        label: track.label || 'Unknown',
        id: track.id,
        kind: track.kind,
        readyState: track.readyState,
        enabled: track.enabled,
        muted: track.muted,
        settings
      };
  
      addLog(`🎤 ${context} Audio ${index}:`);
      addLog(`   - Label: ${info.label}`);
      addLog(`   - State: ${info.readyState}, Enabled: ${info.enabled}, Muted: ${info.muted}`);
      addLog(`   - Sample Rate: ${settings.sampleRate}Hz, Channels: ${settings.channelCount}`);
      
      if (settings.echoCancellation !== undefined) {
        addLog(`   - Echo Cancel: ${settings.echoCancellation}, Noise Suppress: ${settings.noiseSuppression}`);
      }
  
      return info;
    });
  
    const debugInfo: StreamDebugInfo = {
      id: stream.id,
      active: stream.active,
      videoTracks: videoTracks.length,
      audioTracks: audioTracks.length,
      audioDetails,
      timestamp: Date.now(),
      context
    };
  
    return debugInfo;
  };
  
  /**
   * Check if audio tracks are recording-ready
   */
  export const validateAudioForRecording = (
    stream: MediaStream | null,
    addLog: (msg: string) => void
  ): boolean => {
    if (!stream) {
      addLog('❌ No stream for audio validation');
      return false;
    }
  
    const audioTracks = stream.getAudioTracks();
    
    if (audioTracks.length === 0) {
      addLog('🔇 FAIL: No audio tracks for recording');
      return false;
    }
  
    let validTracks = 0;
    audioTracks.forEach((track, index) => {
      if (track.readyState === 'live' && track.enabled && !track.muted) {
        validTracks++;
        addLog(`✅ Audio track ${index} ready for recording`);
      } else {
        addLog(`❌ Audio track ${index} NOT ready: state=${track.readyState}, enabled=${track.enabled}, muted=${track.muted}`);
      }
    });
  
    const isValid = validTracks > 0;
    addLog(`📊 Audio validation: ${validTracks}/${audioTracks.length} tracks ready`);
    
    return isValid;
  };
  
  /**
   * Test audio recording capabilities
   */
  export const testAudioRecording = async (addLog: (msg: string) => void): Promise<boolean> => {
    try {
      addLog('🧪 Testing audio recording capability...');
      
      const testStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      debugAudioTracks(testStream, 'Audio Test', addLog);
      
      // Test MediaRecorder with audio
      const formats = [
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm'
      ];
      
      let supportedFormat = null;
      for (const format of formats) {
        if (MediaRecorder.isTypeSupported(format)) {
          supportedFormat = format;
          addLog(`✅ Audio format supported: ${format}`);
          break;
        }
      }
      
      if (!supportedFormat) {
        addLog('❌ No audio formats supported by MediaRecorder');
        testStream.getTracks().forEach(track => track.stop());
        return false;
      }
      
      // Quick recording test
      const recorder = new MediaRecorder(testStream, { mimeType: supportedFormat });
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: supportedFormat });
        addLog(`✅ Audio test recording: ${blob.size} bytes`);
      };
      
      recorder.start();
      setTimeout(() => {
        recorder.stop();
        testStream.getTracks().forEach(track => track.stop());
      }, 1000);
      
      addLog('✅ Audio recording test completed');
      return true;
      
    } catch (error) {
      addLog(`❌ Audio test failed: ${error}`);
      return false;
    }
  };
  
  /**
   * Monitor audio levels (for visual feedback)
   */
  export const createAudioLevelMonitor = (
    stream: MediaStream,
    onLevel: (level: number) => void,
    addLog: (msg: string) => void
  ): (() => void) | null => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      microphone.connect(analyser);
      
      let animationId: number;
      
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        const level = average / 255;
        onLevel(level);
        animationId = requestAnimationFrame(updateLevel);
      };
      
      updateLevel();
      addLog('🎵 Audio level monitor started');
      
      return () => {
        cancelAnimationFrame(animationId);
        microphone.disconnect();
        audioContext.close();
        addLog('🔇 Audio level monitor stopped');
      };
      
    } catch (error) {
      addLog(`❌ Audio monitor failed: ${error}`);
      return null;
    }
  };
  
  /**
   * Export audio debug report
   */
  export const exportAudioDebugReport = (
    debugHistory: StreamDebugInfo[],
    addLog: (msg: string) => void
  ): void => {
    try {
      const report = {
        timestamp: new Date().toISOString(),
        browser: navigator.userAgent,
        audioSupport: {
          mediaDevices: !!navigator.mediaDevices,
          getUserMedia: !!(navigator.mediaDevices?.getUserMedia),
          audioContext: !!(window.AudioContext || (window as any).webkitAudioContext)
        },
        debugHistory,
        summary: {
          totalStreams: debugHistory.length,
          streamsWithAudio: debugHistory.filter(s => s.audioTracks > 0).length,
          contexts: [...new Set(debugHistory.map(s => s.context))]
        }
      };
      
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audio-debug-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      addLog('📄 Audio debug report exported');
    } catch (error) {
      addLog(`❌ Export failed: ${error}`);
    }
  };
  
  /**
   * Quick audio status check
   */
  export const getAudioStatus = (stream: MediaStream | null): {
    hasAudio: boolean;
    trackCount: number;
    readyTracks: number;
    issues: string[];
  } => {
    if (!stream) {
      return { hasAudio: false, trackCount: 0, readyTracks: 0, issues: ['No stream'] };
    }
    
    const audioTracks = stream.getAudioTracks();
    const issues: string[] = [];
    
    if (audioTracks.length === 0) {
      issues.push('No audio tracks');
    }
    
    const readyTracks = audioTracks.filter(track => 
      track.readyState === 'live' && track.enabled && !track.muted
    ).length;
    
    if (readyTracks === 0 && audioTracks.length > 0) {
      issues.push('Audio tracks not ready');
    }
    
    return {
      hasAudio: readyTracks > 0,
      trackCount: audioTracks.length,
      readyTracks,
      issues
    };
  };
  
  // Usage examples for integration:
  /*
  // In your recording flow:
  const streamInfo = debugAudioTracks(cameraStream, "Camera Stream", addLog);
  const isValid = validateAudioForRecording(canvasStream, addLog);
  
  // Before recording:
  const status = getAudioStatus(finalStream);
  if (!status.hasAudio) {
    addLog(`🔇 Audio issues: ${status.issues.join(', ')}`);
  }
  
  // Test on app start:
  testAudioRecording(addLog);
  */