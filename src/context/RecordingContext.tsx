// src/context/RecordingContext.tsx
import React, { createContext, useContext, useState } from 'react';
import { useMediaRecorder } from '../hooks';
import type { RecordingState } from '../hooks';
import { 
  shareVideoAndroid, 
  showAndroidShareInstructions,
  detectAndroid 
} from '../utils/androidRecorderFix';

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
  
  // Video Sharing
  shareVideo: () => Promise<void>;
  downloadVideo: () => void;
  
  // Preview State
  showPreview: boolean;
  setShowPreview: (show: boolean) => void;
  
  // Share Modal State
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

  const shareVideo = async () => {
    if (!recordedVideo) return;
    
    try {
      const file = recordedVideo instanceof File ? 
        recordedVideo : 
        new File([recordedVideo], `lens-video-${Date.now()}.mp4`, {
          type: 'video/mp4',
          lastModified: Date.now()
        });

      const isAndroid = detectAndroid();
      const duration = (file as any).recordingDuration;
      
      addLog(`📱 Sharing ${isAndroid ? 'Android' : 'standard'} video (${duration}s)`);

      if (isAndroid) {
        const success = await shareVideoAndroid(file, addLog);
        if (!success) {
          showAndroidShareInstructions(file);
          downloadVideo();
        }
      } else {
        // Check if native sharing is available
        const canUseNativeShare = typeof navigator !== 'undefined' && 
          'share' in navigator && 
          typeof navigator.share === 'function';
          
        if (canUseNativeShare) {
          const canShareFile = navigator.canShare ? navigator.canShare({ files: [file] }) : true;
          
          if (canShareFile) {
            await navigator.share({
              files: [file],
              title: 'My AR Video',
              text: `Check out this cool AR effect! 🎬 ${duration ? `(${duration}s)` : ''}`
            });
            addLog('✅ Video shared successfully');
          } else {
            downloadVideo();
          }
        } else {
          downloadVideo();
        }
      }
    } catch (error) {
      addLog(`❌ Sharing failed: ${error}`);
      downloadVideo();
    }
  };

  const downloadVideo = () => {
    if (!recordedVideo) return;
    
    const url = URL.createObjectURL(recordedVideo);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lens-video' + (recordedVideo.type.includes('mp4') ? '.mp4' : '.webm');
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
    
    // Video Sharing
    shareVideo,
    downloadVideo,
    
    // Preview State
    showPreview,
    setShowPreview,
    
    // Share Modal State
    showShareModal,
    setShowShareModal
  };

  return (
    <RecordingContext.Provider value={value}>
      {children}
    </RecordingContext.Provider>
  );
};