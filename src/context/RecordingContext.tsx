// src/context/RecordingContext.tsx
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
  
  // Video Processing & Sharing
  processAndShareVideo: () => Promise<void>;
  downloadVideo: () => void;
  
  // Processing State
  isVideoProcessing: boolean;
  processingProgress: number;
  processingMessage: string;
  processingError: string | null;
  showRenderingModal: boolean;
  setShowRenderingModal: (show: boolean) => void;
  
  // Preview State
  showPreview: boolean;
  setShowPreview: (show: boolean) => void;
  
  // Share Modal State (legacy)
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
  // Existing state
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  
  // Video processing state
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

  // Auto-show preview when recording completes
  useEffect(() => {
    if (recordedVideo && recordingState === 'idle') {
      addLog('🎬 Recording completed - showing preview');
      setShowPreview(true);
    }
  }, [recordedVideo, recordingState, addLog]);

  const processAndShareVideo = async () => {
    if (!recordedVideo) {
      addLog('❌ No video to process');
      return;
    }
    
    try {
      setIsVideoProcessing(true);
      setShowRenderingModal(true);
      setProcessingProgress(0);
      setProcessingError(null);
      
      // Get recording duration
      const recordingDuration = (recordedVideo as any).recordingDuration || 
                               recordingTime || 
                               5; // Fallback duration
      
      addLog(`🎬 Starting video processing: ${recordingDuration}s`);
      
      // Process video with progress tracking
      const processedFile = await videoProcessor.processVideo(
        recordedVideo,
        recordingDuration,
        (progress: ProcessingProgress) => {
          setProcessingProgress(progress.percent);
          setProcessingMessage(progress.message);
        }
      );
      
      // Try to share processed video
      addLog('📱 Attempting to share processed video...');
      const shareSuccess = await videoProcessor.shareVideo(processedFile);
      
      if (!shareSuccess) {
        // Show instructions for manual sharing
        showShareInstructions(processedFile);
      }
      
      // Close modal after short delay
      setTimeout(() => {
        setShowRenderingModal(false);
        setShowPreview(false);
      }, 1500);
      
    } catch (error) {
      addLog(`❌ Processing failed: ${error}`);
      setProcessingError(error instanceof Error ? error.message : 'Processing failed');
      
      // Fallback to original video download
      setTimeout(() => {
        downloadVideo();
        setShowRenderingModal(false);
      }, 2000);
      
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

  const showShareInstructions = (file: File) => {
    const duration = (file as any).recordingDuration || 0;
    const isOptimized = (file as any).instagramCompatible || false;
    
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-6';
    
    overlay.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-sm mx-auto text-center">
        <div class="text-2xl mb-3">📱</div>
        <h3 class="text-lg font-bold mb-4">Video Ready! (${duration}s)</h3>
        <div class="text-sm text-gray-600 mb-4">
          ${isOptimized ? 
            '<p class="text-green-600 font-medium mb-2">✅ Optimized for Instagram/TikTok</p>' : 
            '<p class="text-yellow-600 mb-2">⚠️ May need conversion for some apps</p>'
          }
          <p class="text-xs">Video has been downloaded to your device</p>
        </div>
        <div class="text-xs text-left text-gray-700 mb-4 bg-gray-50 p-3 rounded">
          <p class="font-medium mb-2">How to share to Instagram:</p>
          <ol class="space-y-1">
            <li>1. Open your device's gallery/files</li>
            <li>2. Find the downloaded video</li>
            <li>3. Tap Share button</li>
            <li>4. Select Instagram Stories or Reels</li>
            <li>5. Add effects and share! 🎉</li>
          </ol>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" 
                class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium">
          Got it!
        </button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        overlay.remove();
      }
    }, 15000);
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
    
    // Share Modal State (legacy)
    showShareModal,
    setShowShareModal
  };

  return (
    <RecordingContext.Provider value={value}>
      {children}
    </RecordingContext.Provider>
  );
};