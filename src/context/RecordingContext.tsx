// src/context/RecordingContext.tsx - Skip modal, direct share
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useMediaRecorder } from '../hooks';
import { VideoProcessor, ProcessingProgress } from '../utils/VideoProcessor';
import type { RecordingState } from '../hooks';

interface RecordingContextValue {
  // Recording State
  recordingState: RecordingState;
  recordingTime: number;
  recordedVideo: Blob | File | null;
  isRecording: boolean;
  isProcessing: boolean;
  isIdle: boolean;
  
  // Recording Controls
  startRecording: (canvas: HTMLCanvasElement, audioStream?: MediaStream) => boolean;
  stopRecording: () => void;
  toggleRecording: (canvas: HTMLCanvasElement, audioStream?: MediaStream) => void;
  clearRecording: () => void;
  cleanup: () => void;
  formatTime: (seconds: number) => string;
  
  // FIXED: Direct share without modal
  processAndShareVideo: () => Promise<void>;
  downloadVideo: () => void;
  
  // Processing State (minimal for background processing)
  isVideoProcessing: boolean;
  processingProgress: number;
  processingMessage: string;
  processingError: string | null;
  showRenderingModal: boolean;
  setShowRenderingModal: (show: boolean) => void;
  
  // Preview State
  showPreview: boolean;
  setShowPreview: (show: boolean) => void;
  
  // Share Options
  autoShareEnabled: boolean; // NEW
  setAutoShareEnabled: (enabled: boolean) => void; // NEW
  
  // Legacy
  showShareModal: boolean;
  setShowShareModal: (show: boolean) => void;
}

const RecordingContext = createContext<RecordingContextValue | undefined>(undefined);

export const useRecordingContext = () => {
  const context = useContext(RecordingContext);
  if (context === undefined) {
    throw new Error('useRecordingContext must be used within a RecordingProvider');
  }
  return context;
};

interface RecordingProviderProps {
  children: React.ReactNode;
  addLog: (message: string) => void;
}

export const RecordingProvider: React.FC<RecordingProviderProps> = ({ 
  children, 
  addLog 
}) => {
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [autoShareEnabled, setAutoShareEnabled] = useState<boolean>(true); // NEW: Default auto-share
  
  // Minimal processing state (background only)
  const [isVideoProcessing, setIsVideoProcessing] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingMessage, setProcessingMessage] = useState<string>('');
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [showRenderingModal, setShowRenderingModal] = useState<boolean>(false);
  
  const videoProcessor = new VideoProcessor(addLog);
  
  const {
    recordingState,
    recordingTime,
    recordedVideo,
    startRecording,
    stopRecording,
    toggleRecording,
    clearRecording,
    cleanup,
    formatTime,
    isRecording,
    isProcessing,
    isIdle
  } = useMediaRecorder(addLog);

  // FIXED: Auto-share when recording completes (no preview)
  useEffect(() => {
    if (recordedVideo && recordingState === 'idle' && autoShareEnabled) {
      addLog('🚀 Auto-sharing video...');
      processAndShareVideo();
    } else if (recordedVideo && recordingState === 'idle' && !autoShareEnabled) {
      addLog('🎬 Recording completed - showing preview');
      setShowPreview(true);
    }
  }, [recordedVideo, recordingState, autoShareEnabled, addLog]);

  // FIXED: Direct share without modal
  const processAndShareVideo = async () => {
    if (!recordedVideo) {
      addLog('❌ No video to process');
      return;
    }
    
    try {
      setIsVideoProcessing(true);
      setProcessingProgress(0);
      setProcessingError(null);
      
      const recordingDuration = (recordedVideo as any).recordingDuration || 
                               recordingTime || 
                               5;
      
      addLog(`🎬 Processing ${recordingDuration}s video for direct share...`);
      
      // Background processing (no modal)
      const processedFile = await videoProcessor.processVideo(
        recordedVideo,
        recordingDuration,
        (progress: ProcessingProgress) => {
          setProcessingProgress(progress.percent);
          setProcessingMessage(progress.message);
          addLog(`📊 ${progress.message} (${progress.percent}%)`);
        }
      );
      
      // FIXED: Immediate native share attempt
      addLog('📱 Attempting native share...');
      const shareSuccess = await videoProcessor.shareVideo(processedFile);
      
      if (shareSuccess) {
        addLog('✅ Video shared successfully via native share');
      } else {
        addLog('📥 Fallback: Video downloaded with share instructions');
      }
      
      // Reset state after share
      setTimeout(() => {
        setShowPreview(false);
        clearRecording();
      }, 1000);
      
    } catch (error) {
      addLog(`❌ Processing failed: ${error}`);
      setProcessingError(error instanceof Error ? error.message : 'Processing failed');
      
      // Fallback to direct download
      downloadVideo();
      
    } finally {
      setIsVideoProcessing(false);
    }
  };

  const downloadVideo = () => {
    if (!recordedVideo) return;
    
    const url = URL.createObjectURL(recordedVideo);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ar-video-${Date.now()}${recordedVideo.type.includes('mp4') ? '.mp4' : '.webm'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('💾 Video downloaded');
  };

  const value: RecordingContextValue = {
    // Recording State
    recordingState,
    recordingTime,
    recordedVideo,
    isRecording,
    isProcessing,
    isIdle,
    
    // Recording Controls
    startRecording,
    stopRecording,
    toggleRecording,
    clearRecording,
    cleanup,
    formatTime,
    
    // Video Processing & Sharing
    processAndShareVideo,
    downloadVideo,
    
    // Processing State
    isVideoProcessing,
    processingProgress,
    processingMessage,
    processingError,
    showRenderingModal,
    setShowRenderingModal,
    
    // Preview State
    showPreview,
    setShowPreview,
    
    // Share Options
    autoShareEnabled,
    setAutoShareEnabled,
    
    // Legacy
    showShareModal,
    setShowShareModal
  };

  return (
    <RecordingContext.Provider value={value}>
      {children}
    </RecordingContext.Provider>
  );
};