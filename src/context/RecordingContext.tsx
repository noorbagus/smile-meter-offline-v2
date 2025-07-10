// src/context/RecordingContext.tsx - Fixed camera restoration after share
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useMediaRecorder } from '../hooks';
import { VideoProcessor, ProcessingProgress } from '../utils/VideoProcessor';
import type { RecordingState } from '../hooks';

interface RecordingContextValue {
  recordingState: RecordingState;
  recordingTime: number;
  recordedVideo: Blob | File | null;
  isRecording: boolean;
  isProcessing: boolean;
  isIdle: boolean;
  
  startRecording: (canvas: HTMLCanvasElement, audioStream?: MediaStream) => boolean;
  stopRecording: () => void;
  toggleRecording: (canvas: HTMLCanvasElement, audioStream?: MediaStream) => void;
  clearRecording: () => void;
  cleanup: () => void;
  formatTime: (seconds: number) => string;
  
  processAndShareVideo: () => Promise<void>;
  downloadVideo: () => void;
  
  isVideoProcessing: boolean;
  processingProgress: number;
  processingMessage: string;
  processingError: string | null;
  showRenderingModal: boolean;
  setShowRenderingModal: (show: boolean) => void;
  
  showPreview: boolean;
  setShowPreview: (show: boolean) => void;
  
  autoShareEnabled: boolean;
  setAutoShareEnabled: (enabled: boolean) => void;
  
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
  restoreCameraFeed?: () => void;
}

export const RecordingProvider: React.FC<RecordingProviderProps> = ({ 
  children, 
  addLog,
  restoreCameraFeed 
}) => {
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [autoShareEnabled, setAutoShareEnabled] = useState<boolean>(false);
  
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
    clearRecording: originalClearRecording,
    cleanup,
    formatTime,
    isRecording,
    isProcessing,
    isIdle
  } = useMediaRecorder(addLog);

  // Auto-share when recording completes
  useEffect(() => {
    if (recordedVideo && recordingState === 'idle' && autoShareEnabled) {
      addLog('🚀 Auto-sharing video...');
      processAndShareVideo();
    } else if (recordedVideo && recordingState === 'idle' && !autoShareEnabled) {
      addLog('🎬 Recording completed - showing preview');
      setShowPreview(true);
    }
  }, [recordedVideo, recordingState, autoShareEnabled, addLog]);

  // Enhanced clear recording with camera restoration
  const clearRecording = React.useCallback(() => {
    originalClearRecording();
    
    if (restoreCameraFeed) {
      addLog('🔄 Restoring camera feed after clear...');
      setTimeout(() => {
        restoreCameraFeed();
      }, 200);
    }
  }, [originalClearRecording, restoreCameraFeed, addLog]);

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
      
      addLog(`🎬 Processing ${recordingDuration}s video for share...`);
      
      const processedFile = await videoProcessor.processVideo(
        recordedVideo,
        recordingDuration,
        (progress: ProcessingProgress) => {
          setProcessingProgress(progress.percent);
          setProcessingMessage(progress.message);
          addLog(`📊 ${progress.message} (${progress.percent}%)`);
        }
      );
      
      addLog('📱 Attempting native share...');
      const shareSuccess = await videoProcessor.shareVideo(processedFile);
      
      if (shareSuccess) {
        addLog('✅ Video shared successfully');
      } else {
        addLog('📥 Video downloaded with share instructions');
      }
      
      // Reset state after share with camera restoration
      setTimeout(() => {
        setShowPreview(false);
        clearRecording();
      }, 1000);
      
    } catch (error) {
      addLog(`❌ Processing failed: ${error}`);
      setProcessingError(error instanceof Error ? error.message : 'Processing failed');
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
    
    // Restore camera after download
    setTimeout(() => {
      if (restoreCameraFeed) {
        addLog('🔄 Restoring camera feed after download...');
        restoreCameraFeed();
      }
    }, 500);
  };

  const value: RecordingContextValue = {
    recordingState,
    recordingTime,
    recordedVideo,
    isRecording,
    isProcessing,
    isIdle,
    
    startRecording,
    stopRecording,
    toggleRecording,
    clearRecording,
    cleanup,
    formatTime,
    
    processAndShareVideo,
    downloadVideo,
    
    isVideoProcessing,
    processingProgress,
    processingMessage,
    processingError,
    showRenderingModal,
    setShowRenderingModal,
    
    showPreview,
    setShowPreview,
    
    autoShareEnabled,
    setAutoShareEnabled,
    
    showShareModal,
    setShowShareModal
  };

  return (
    <RecordingContext.Provider value={value}>
      {children}
    </RecordingContext.Provider>
  );
};