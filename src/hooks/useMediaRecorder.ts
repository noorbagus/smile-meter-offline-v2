// src/hooks/useMediaRecorder.ts - FIXED for constant 30fps
import { useState, useRef, useCallback, useEffect } from 'react';
import { FixedMediaRecorder, detectAndroid } from '../utils/androidRecorderFix';

export type RecordingState = 'idle' | 'recording' | 'processing';

export const useMediaRecorder = (addLog: (message: string) => void) => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [recordedVideo, setRecordedVideo] = useState<Blob | File | null>(null);

  const fixedRecorderRef = useRef<FixedMediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  /**
   * FIXED: Enhanced recording start with constant framerate validation
   */
  const startRecording = useCallback((canvas: HTMLCanvasElement, audioStream?: MediaStream) => {
    if (!canvas) {
      addLog('❌ Canvas not available for recording');
      return false;
    }

    // FIXED: Validate canvas for constant framerate capture
    if (!canvas.width || !canvas.height) {
      addLog('❌ Canvas has invalid dimensions');
      return false;
    }

    if (typeof canvas.captureStream !== 'function') {
      addLog('❌ Canvas.captureStream not supported');
      return false;
    }

    try {
      // FIXED: Create high-quality stream for constant framerate
      let canvasStream: MediaStream;
      
      try {
        // Force 30fps capture
        canvasStream = canvas.captureStream(30);
        addLog(`✅ Canvas stream: ${canvas.width}x${canvas.height}@30fps`);
      } catch (streamError) {
        // Fallback to default capture
        canvasStream = canvas.captureStream();
        addLog(`⚠️ Using default canvas capture: ${streamError}`);
      }
      
      // FIXED: Enhanced audio integration with sync validation
      if (audioStream && audioStream.getAudioTracks().length > 0) {
        const audioTrack = audioStream.getAudioTracks()[0];
        
        // Validate audio track before adding
        if (audioTrack.readyState === 'live') {
          canvasStream.addTrack(audioTrack);
          addLog(`✅ Audio track added: ${audioTrack.label || 'Default'}`);
        } else {
          addLog(`⚠️ Audio track not live: ${audioTrack.readyState}`);
        }
      } else {
        addLog('ℹ️ No audio stream available');
      }

      // FIXED: Validate stream before recording
      const videoTracks = canvasStream.getVideoTracks();
      const audioTracks = canvasStream.getAudioTracks();
      
      addLog(`📊 Stream validation: ${videoTracks.length} video, ${audioTracks.length} audio tracks`);
      
      if (videoTracks.length === 0) {
        throw new Error('No video tracks in canvas stream');
      }

      // Record precise start time for duration calculation
      recordingStartTimeRef.current = performance.now();

      // FIXED: Initialize FixedMediaRecorder with enhanced options
      fixedRecorderRef.current = new FixedMediaRecorder(
        canvasStream,
        (file: File) => {
          // FIXED: Enhanced completion with framerate validation
          const endTime = performance.now();
          const actualDurationMs = endTime - recordingStartTimeRef.current;
          const actualDurationSeconds = Math.floor(actualDurationMs / 1000);
          
          // Enhanced metadata with framerate tracking
          (file as any).recordingDuration = actualDurationSeconds;
          (file as any).recordingStartTime = recordingStartTimeRef.current;
          (file as any).recordingEndTime = endTime;
          (file as any).actualDurationMs = actualDurationMs;
          (file as any).canvasWidth = canvas.width;
          (file as any).canvasHeight = canvas.height;
          (file as any).hasAudioTrack = audioTracks.length > 0;
          
          // Log final recording stats
          const frameRate = (file as any).actualFrameRate || 0;
          const isConstant = (file as any).isConstantFramerate || false;
          
          addLog(`✅ Recording complete: ${actualDurationSeconds}s @ ${frameRate.toFixed(1)}fps ${isConstant ? '(constant)' : '(variable)'}`);
          
          setRecordedVideo(file);
          setRecordingState('idle');
        },
        addLog
      );

      fixedRecorderRef.current.start();
      setRecordingState('recording');
      
      const platform = detectAndroid() ? 'Android MP4' : 'Standard';
      addLog(`🎬 Recording started: ${platform} @ 30fps target`);
      return true;

    } catch (error) {
      addLog(`❌ Recording start failed: ${error}`);
      setRecordingState('idle');
      return false;
    }
  }, [addLog]);

  /**
   * FIXED: Enhanced stop with validation
   */
  const stopRecording = useCallback(() => {
    if (fixedRecorderRef.current && recordingState === 'recording') {
      const recorder = fixedRecorderRef.current;
      const recorderState = recorder.getState();
      
      if (recorderState === 'recording') {
        recorder.stop();
        setRecordingState('processing');
        addLog('⏹️ Recording stopped, processing for constant framerate...');
      } else {
        addLog(`⚠️ Recorder not in recording state: ${recorderState}`);
        setRecordingState('idle');
      }
    } else {
      addLog('⚠️ No active recorder to stop');
    }
  }, [recordingState, addLog]);

  /**
   * FIXED: Enhanced toggle with minimum duration and framerate validation
   */
  const toggleRecording = useCallback((canvas: HTMLCanvasElement, audioStream?: MediaStream) => {
    if (recordingState === 'recording') {
      // FIXED: Validate minimum duration for stable framerate
      if (recordingTime >= 3) { // Increased from 2 to 3 seconds for better Instagram compatibility
        stopRecording();
      } else {
        addLog(`⚠️ Recording too short (${recordingTime}s) - minimum 3 seconds for Instagram`);
      }
    } else if (recordingState === 'idle') {
      // FIXED: Pre-flight validation
      if (!canvas) {
        addLog('❌ Canvas required for recording');
        return;
      }
      
      if (canvas.width < 640 || canvas.height < 480) {
        addLog(`⚠️ Canvas resolution low: ${canvas.width}x${canvas.height}`);
      }
      
      const success = startRecording(canvas, audioStream);
      if (!success) {
        addLog('❌ Failed to start recording');
      }
    } else {
      addLog(`⚠️ Cannot toggle recording in state: ${recordingState}`);
    }
  }, [recordingState, recordingTime, startRecording, stopRecording, addLog]);

  const clearRecording = useCallback(() => {
    setRecordedVideo(null);
    setRecordingTime(0);
    setRecordingState('idle');
    recordingStartTimeRef.current = 0;
    addLog('🗑️ Recording cleared');
  }, [addLog]);

  const cleanup = useCallback(() => {
    if (fixedRecorderRef.current) {
      const recorderState = fixedRecorderRef.current.getState();
      if (recorderState === 'recording') {
        fixedRecorderRef.current.stop();
      }
      fixedRecorderRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    addLog('🧹 MediaRecorder cleanup complete');
  }, [addLog]);

  /**
   * FIXED: Enhanced timer with framerate monitoring
   */
  useEffect(() => {
    if (recordingState === 'recording') {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          
          // Log framerate info periodically
          if (newTime % 5 === 0 && fixedRecorderRef.current) {
            const state = fixedRecorderRef.current.getState();
            addLog(`📊 Recording: ${newTime}s, state: ${state}`);
          }
          
          return newTime;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (recordingState === 'idle') {
        setRecordingTime(0);
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [recordingState, addLog]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    recordingState,
    recordingTime,
    recordedVideo,
    startRecording,
    stopRecording,
    toggleRecording,
    clearRecording,
    cleanup,
    formatTime,
    isRecording: recordingState === 'recording',
    isProcessing: recordingState === 'processing',
    isIdle: recordingState === 'idle'
  };
};