// src/App.tsx - Auto-recovery handling
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
  SettingsPanel,
  RenderingModal
} from './components';

const CameraApp: React.FC = () => {
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

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
    isReady,
    restoreCameraFeed // NEW: Manual restore function
  } = useCameraContext();

  const {
    recordingState,
    recordingTime,
    recordedVideo,
    toggleRecording,
    formatTime,
    downloadVideo,
    showPreview,
    setShowPreview,
    processAndShareVideo,
    processingProgress,
    processingMessage,
    processingError,
    showRenderingModal,
    setShowRenderingModal,
    autoShareEnabled,
    setAutoShareEnabled
  } = useRecordingContext();

  // FIXED: Auto-recovery on app focus
  useEffect(() => {
    const handleFocus = () => {
      if (cameraState === 'ready') {
        addLog('🔄 App focused - checking camera feed...');
        setTimeout(() => {
          restoreCameraFeed();
        }, 200);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && cameraState === 'ready') {
        addLog('👁️ App visible - restoring camera...');
        setTimeout(() => {
          restoreCameraFeed();
        }, 100);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cameraState, addLog, restoreCameraFeed]);

  const initializeApp = useCallback(async () => {
    try {
      addLog('🎬 Starting app initialization...');
      
      const hasPermission = await checkCameraPermission();
      if (!hasPermission) return;

      const stream = await requestCameraStream(currentFacingMode, true);
      if (!stream) return;

      const success = await initializeCameraKit(stream, cameraFeedRef);
      if (success) {
        addLog('🎉 App initialization complete');
      }
    } catch (error) {
      addLog(`❌ App initialization failed: ${error}`);
    }
  }, [addLog, checkCameraPermission, requestCameraStream, currentFacingMode, initializeCameraKit, cameraFeedRef]);

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

  const handleToggleRecording = useCallback(() => {
    const canvas = getCanvas();
    const stream = getStream();
    
    if (!canvas) {
      addLog('❌ Canvas not available for recording');
      return;
    }

    toggleRecording(canvas, stream || undefined);
  }, [getCanvas, getStream, toggleRecording, addLog]);

  const handleClosePreview = useCallback(() => {
    setShowPreview(false);
    addLog('📱 Preview closed');
  }, [setShowPreview, addLog]);

  const handleProcessAndShare = useCallback(() => {
    addLog('🎬 Starting video processing...');
    processAndShareVideo();
  }, [processAndShareVideo, addLog]);

  useEffect(() => {
    addLog('🚀 App component mounted');
    initializeApp();
  }, [initializeApp, addLog]);

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

  const handleRetry = useCallback(() => {
    addLog('🔄 Retrying initialization...');
    initializeApp();
  }, [initializeApp, addLog]);

  // Video preview with auto-share option
  if (showPreview && recordedVideo) {
    return (
      <>
        <VideoPreview
          recordedVideo={recordedVideo}
          onClose={handleClosePreview}
          onDownload={downloadVideo}
          onProcessAndShare={handleProcessAndShare}
        />
        
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
      <CameraFeed
        cameraFeedRef={cameraFeedRef}
        cameraState={cameraState}
        recordingState={recordingState}
        isFlipped={isFlipped}
      />

      <CameraControls
        onSettings={() => setShowSettings(true)}
        onFlip={() => setIsFlipped(!isFlipped)}
      />

      <RecordingControls
        recordingState={recordingState}
        recordingTime={recordingTime}
        onToggleRecording={handleToggleRecording}
        onGallery={() => addLog('🔄 Reload effect clicked')}
        onSwitchCamera={handleSwitchCamera}
        formatTime={formatTime}
        disabled={!isReady}
      />

      {cameraState === 'initializing' && (
        <LoadingScreen 
          message="Initializing Web AR Netramaya..."
          subMessage="Setting up camera and AR engine..."
        />
      )}

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

      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        debugLogs={debugLogs}
        onExportLogs={exportLogs}
      />

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

const App: React.FC = () => {
  return (
    <CameraProvider>
      <RecordingProvider addLog={() => {}}>
        <AppWithContext />
      </RecordingProvider>
    </CameraProvider>
  );
};

const AppWithContext: React.FC = () => {
  const { addLog } = useCameraContext();
  
  return (
    <RecordingProvider addLog={addLog}>
      <CameraApp />
    </RecordingProvider>
  );
};

export default App;