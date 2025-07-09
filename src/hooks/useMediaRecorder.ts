// src/hooks/useMediaRecorder.ts
import { useState, useRef, useCallback, useEffect } from 'react';
import { EnhancedMediaRecorder, detectAndroid } from '../utils/androidRecorderFix';

export type RecordingState = 'idle' | 'recording' | 'processing';

export const useMediaRecorder = (addLog: (message: string) => void) => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [recordedVideo, setRecordedVideo] = useState<Blob | File | null>(null);

  const enhancedRecorderRef = useRef<EnhancedMediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

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

      enhancedRecorderRef.current = new EnhancedMediaRecorder(
        canvasStream,
        (file: File) => {
          setRecordedVideo(file);
          setRecordingState('idle');
          addLog('✅ Recording completed');
        },
        addLog
      );

      enhancedRecorderRef.current.start();
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
    if (enhancedRecorderRef.current && recordingState === 'recording') {
      enhancedRecorderRef.current.stop();
      setRecordingState('processing');
      addLog('⏹️ Recording stopped');
    }
  }, [recordingState, addLog]);

  const toggleRecording = useCallback((canvas: HTMLCanvasElement, audioStream?: MediaStream) => {
    if (recordingState === 'recording') {
      if (recordingTime >= 2) {
        stopRecording();
      }
    } else if (recordingState === 'idle') {
      startRecording(canvas, audioStream);
    }
  }, [recordingState, recordingTime, startRecording, stopRecording]);

  const clearRecording = useCallback(() => {
    setRecordedVideo(null);
    setRecordingTime(0);
    setRecordingState('idle');
  }, []);

  const cleanup = useCallback(() => {
    if (enhancedRecorderRef.current) {
      enhancedRecorderRef.current.stop();
      enhancedRecorderRef.current = null;
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