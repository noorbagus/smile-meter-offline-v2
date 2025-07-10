// src/App.tsx - Updated with RenderingModal integration
import React, { useState, useEffect, useCallback } from 'react';
import { 
  CameraProvider, 
  RecordingProvider, 
  useCameraContext, 
  useRecordingContext 
} from './context';
import {
  LoadingScreen,
  ErrorScreen,
  CameraFeed,
  CameraControls,
  RecordingControls,
  VideoPreview,
  ShareModal,
  SettingsPanel,
  RenderingModal
} from './components';

/**
 * Main Camera Application Component
 */
const CameraApp: React.FC = () => {
  // UI State
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Get camera context
  const {
    cameraState,
    currentFacingMode,
    permissionState,
    errorInfo,
    initializeCameraKit,
    switchCamera,
    requestCameraStream,
    requestPermission,
    checkCameraPermission,
    cameraFeedRef,
    getCanvas,
    getStream,
    addLog,
    debugLogs,
    exportLogs,
    isReady
  } = useCameraContext();

  // Get recording context
  const {
    recordingState,
    recordingTime,
    recordedVideo,
    toggleRecording,
    formatTime,
    downloadVideo,
    showPreview,
    setShowPreview,
    showShareModal,
    setShowShareModal,
    // New processing state
    processAndShareVideo,
    isVideoProcessing,
    processingProgress,
    processingMessage,
    processingError,
    showRenderingModal,
    setShowRenderingModal
  } = useRecordingContext();

  // Initialize app
  const initializeApp = useCallback(async () => {
    try {
      addLog('🎬 Starting app initialization...');
      
      const hasPermission = await checkCameraPermission();
      if (!hasPermission) {
        addLog('❌ Permission check failed');
        return;
      }

      const stream = await requestCameraStream(currentFacingMode, true);
      if (!stream) {
        addLog('❌ Failed to get camera stream');
        return;
      }

      const success = await initializeCameraKit(stream, cameraFeedRef);
      if (success) {
        addLog('🎉 App initialization complete');
      }

    } catch (error) {
      addLog(`❌ App initialization failed: ${error}`);
    }
  }, [
    addLog,
    checkCameraPermission,
    requestCameraStream,
    currentFacingMode,
    initializeCameraKit,
    cameraFeedRef
  ]);

  // Handle camera switch
  const handleSwitchCamera = useCallback(async () => {
    if (!isReady) return;
    
    try {
      addLog('🔄 Switching camera...');
      const newStream = await switchCamera();
      if (newStream) {
        addLog('✅ Camera switched successfully');
      }
    } catch (error) {
      addLog(`❌ Camera switch failed: ${error}`);
    }
  }, [isReady, switchCamera, addLog]);

  // Handle recording toggle
  const handleToggleRecording = useCallback(() => {
    const canvas = getCanvas();
    const stream = getStream();
    
    if (!canvas) {
      addLog('❌ Canvas not available for recording');
      return;
    }

    toggleRecording(canvas, stream || undefined);
  }, [getCanvas, getStream, toggleRecording, addLog]);

  // Handle video preview close
  const handleClosePreview = useCallback(() => {
    setShowPreview(false);
    addLog('📱 Preview closed');
  }, [setShowPreview, addLog]);

  // Handle process and share
  const handleProcessAndShare = useCallback(() => {
    addLog('🎬 Starting video processing...');
    processAndShareVideo();
  }, [processAndShareVideo, addLog]);

  // Initialize on mount
  useEffect(() => {
    addLog('🚀 App component mounted');
    initializeApp();
  }, [initializeApp, addLog]);

  // Handle manual permission request
  const handleRequestPermission = useCallback(async () => {
    try {
      addLog('🔒 Requesting camera permission...');
      const stream = await requestPermission();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        initializeApp();
      }
    } catch (error) {
      addLog(`❌ Permission request failed: ${error}`);
    }
  }, [requestPermission, initializeApp, addLog]);

  // Handle retry initialization
  const handleRetry = useCallback(() => {
    addLog('🔄 Retrying initialization...');
    initializeApp();
  }, [initializeApp, addLog]);

  // Render video preview screen
  if (showPreview && recordedVideo) {
    return (
      <>
        <VideoPreview
          recordedVideo={recordedVideo}
          onClose={handleClosePreview}
          onDownload={downloadVideo}
          onProcessAndShare={handleProcessAndShare}
        />
        
        {/* RenderingModal */}
        <RenderingModal
          isOpen={showRenderingModal}
          progress={processingProgress}
          message={processingMessage}
          isComplete={processingProgress === 100 && !processingError}
          hasError={!!processingError}
          onCancel={() => {
            setShowRenderingModal(false);
            addLog('❌ Processing cancelled');
          }}
        />
      </>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Camera Feed */}
      <CameraFeed
        cameraFeedRef={cameraFeedRef}
        cameraState={cameraState}
        recordingState={recordingState}
        isFlipped={isFlipped}
      />

      {/* Top Controls */}
      <CameraControls
        onSettings={() => setShowSettings(true)}
        onFlip={() => setIsFlipped(!isFlipped)}
      />

      {/* Bottom Recording Controls */}
      <RecordingControls
        recordingState={recordingState}
        recordingTime={recordingTime}
        onToggleRecording={handleToggleRecording}
        onGallery={() => addLog('📱 Gallery clicked')}
        onSwitchCamera={handleSwitchCamera}
        formatTime={formatTime}
        disabled={!isReady}
      />

      {/* Loading Screen */}
      {cameraState === 'initializing' && (
        <LoadingScreen 
          message="Initializing Web AR Netramaya..."
          subMessage="Setting up camera and AR engine..."
        />
      )}

      {/* Error Screen */}
      {(cameraState === 'error' || cameraState === 'permission_denied' || cameraState === 'https_required') && errorInfo && (
        <ErrorScreen
          errorInfo={errorInfo}
          permissionState={permissionState}
          onRequestPermission={handleRequestPermission}
          onRetry={handleRetry}
          debugInfo={{
            protocol: location.protocol,
            hostname: location.hostname,
            userAgent: navigator.userAgent
          }}
        />
      )}

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        debugLogs={debugLogs}
        onExportLogs={exportLogs}
      />

      {/* RenderingModal for main app processing */}
      <RenderingModal
        isOpen={showRenderingModal && !showPreview}
        progress={processingProgress}
        message={processingMessage}
        isComplete={processingProgress === 100 && !processingError}
        hasError={!!processingError}
        onCancel={() => {
          setShowRenderingModal(false);
          addLog('❌ Processing cancelled');
        }}
      />
    </div>
  );
};

/**
 * App with Context Providers
 */
const App: React.FC = () => {
  return (
    <CameraProvider>
      <RecordingProvider addLog={() => {}}>
        <AppWithContext />
      </RecordingProvider>
    </CameraProvider>
  );
};

/**
 * App component that uses contexts
 */
const AppWithContext: React.FC = () => {
  const { addLog } = useCameraContext();
  
  return (
    <RecordingProvider addLog={addLog}>
      <CameraApp />
    </RecordingProvider>
  );
};

export default App;