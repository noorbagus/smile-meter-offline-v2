// src/hooks/useMediaRecorder.ts
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

  const startRecording = useCallback((canvas: HTMLCanvasElement, audioStream?: MediaStream) => {
    if (!canvas) {
      addLog('❌ Canvas not available for recording');
      return false;
    }

    try {
      const canvasStream = canvas.captureStream(30);
      
      // Add audio if available
      if (audioStream && audioStream.getAudioTracks().length > 0) {
        const audioTrack = audioStream.getAudioTracks()[0];
        canvasStream.addTrack(audioTrack);
      }

      // Record start time for accurate duration
      recordingStartTimeRef.current = performance.now();

      fixedRecorderRef.current = new FixedMediaRecorder(
        canvasStream,
        (file: File) => {
          // Calculate actual recording duration
          const endTime = performance.now();
          const actualDurationMs = endTime - recordingStartTimeRef.current;
          const actualDurationSeconds = Math.floor(actualDurationMs / 1000);
          
          // Add duration metadata to file
          (file as any).recordingDuration = actualDurationSeconds;
          (file as any).recordingStartTime = recordingStartTimeRef.current;
          (file as any).recordingEndTime = endTime;
          (file as any).actualDurationMs = actualDurationMs;
          
          setRecordedVideo(file);
          setRecordingState('idle');
          addLog(`✅ Recording completed: ${actualDurationSeconds}s`);
        },
        addLog
      );

      fixedRecorderRef.current.start();
      setRecordingState('recording');
      addLog(`🎬 Recording started (${detectAndroid() ? 'Android MP4' : 'Standard'} mode)`);
      return true;

    } catch (error) {
      addLog(`❌ Failed to start recording: ${error}`);
      setRecordingState('idle');
      return false;
    }
  }, [addLog]);

  const stopRecording = useCallback(() => {
    if (fixedRecorderRef.current && recordingState === 'recording') {
      fixedRecorderRef.current.stop();
      setRecordingState('processing');
      addLog('⏹️ Recording stopped, processing...');
    }
  }, [recordingState, addLog]);

  const toggleRecording = useCallback((canvas: HTMLCanvasElement, audioStream?: MediaStream) => {
    if (recordingState === 'recording') {
      if (recordingTime >= 2) {
        stopRecording();
      } else {
        addLog('⚠️ Recording too short (minimum 2 seconds)');
      }
    } else if (recordingState === 'idle') {
      startRecording(canvas, audioStream);
    }
  }, [recordingState, recordingTime, startRecording, stopRecording, addLog]);

  const clearRecording = useCallback(() => {
    setRecordedVideo(null);
    setRecordingTime(0);
    setRecordingState('idle');
    recordingStartTimeRef.current = 0;
  }, []);

  const cleanup = useCallback(() => {
    if (fixedRecorderRef.current) {
      fixedRecorderRef.current.stop();
      fixedRecorderRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, []);

  // Timer effect
  useEffect(() => {
    if (recordingState === 'recording') {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (recordingState === 'idle') {
        setRecordingTime(0);
      }
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recordingState]);

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