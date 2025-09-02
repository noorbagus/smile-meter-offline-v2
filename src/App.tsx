// src/App.tsx - Fullscreen implementation with floating buttons
import React, { useState, useEffect, useCallback } from 'react';
import { 
  CameraProvider, 
  RecordingProvider, 
  useCameraContext, 
  useRecordingContext 
} from './context';
import { RemoteApiProvider, useRemoteApi } from './context/RemoteApiContext';
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
import { LoginKit } from './components/LoginKit';
import { checkAndRedirect, isInstagramBrowser, retryRedirect } from './utils/instagramBrowserDetector';
import { Maximize, X } from 'lucide-react';

const CameraApp: React.FC = () => {
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [appReady, setAppReady] = useState<boolean>(false);
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showExitButton, setShowExitButton] = useState<boolean>(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [tapCount, setTapCount] = useState<number>(0);
  const [exitButtonTimer, setExitButtonTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Remote API state access
  const { hadiahAvailable, currentScore } = useRemoteApi();
  
  // Push2Web login state - HIDDEN UI
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [showLogin, setShowLogin] = useState<boolean>(false);

  const {
    cameraState,
    currentFacingMode,
    permissionState,
    errorInfo,
    initializeCameraKit,
    switchCamera,
    reloadLens,
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
    restoreCameraFeed,
    subscribePush2Web,
    getPush2WebStatus
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
    setShowRenderingModal
  } = useRecordingContext();

  // Fullscreen functions
  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      
      // Lock orientation to portrait
      if ('orientation' in screen && 'lock' in screen.orientation) {
        try {
          await (screen.orientation as any).lock('portrait');
          addLog('🔒 Portrait orientation locked');
        } catch (orientationError) {
          addLog(`⚠️ Orientation lock failed: ${orientationError}`);
        }
      }
      
      // Apply fullscreen lock class
      document.body.classList.add('fullscreen-locked');
      
      setIsFullscreen(true);
      addLog('🖥️ Fullscreen mode activated');
      
    } catch (error) {
      addLog(`❌ Fullscreen failed: ${error}`);
    }
  }, [addLog]);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      
      // Remove fullscreen lock class
      document.body.classList.remove('fullscreen-locked');
      
      // Unlock orientation
      if ('orientation' in screen && 'unlock' in screen.orientation) {
        try {
          (screen.orientation as any).unlock();
          addLog('🔓 Orientation unlocked');
        } catch (orientationError) {
          addLog(`⚠️ Orientation unlock failed: ${orientationError}`);
        }
      }
      
      setIsFullscreen(false);
      setShowExitButton(false);
      addLog('🖥️ Fullscreen mode exited');
      
    } catch (error) {
      addLog(`❌ Exit fullscreen failed: ${error}`);
    }
  }, [addLog]);

  const handleLongPress = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isFullscreen) return;
    
    e.preventDefault();
    
    const timer = setTimeout(() => {
      setShowExitButton(true);
      addLog('📱 Long press detected - showing exit button');
      
      // Auto-hide exit button after 5 seconds
      const hideTimer = setTimeout(() => {
        setShowExitButton(false);
        addLog('⏰ Exit button auto-hidden');
      }, 5000);
      
      setExitButtonTimer(hideTimer);
    }, 1500); // 1.5 second long press
    
    setLongPressTimer(timer);
  }, [isFullscreen, addLog]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }, [longPressTimer]);

  const handleDoubleTap = useCallback(() => {
    if (!isFullscreen) return;
    
    setTapCount(prev => {
      if (prev === 0) {
        // First tap
        setTimeout(() => setTapCount(0), 500); // Reset after 500ms
        return 1;
      } else if (prev === 1) {
        // Second tap - show exit button
        setShowExitButton(true);
        addLog('👆 Double tap detected - showing exit button');
        
        // Auto-hide exit button after 5 seconds
        const hideTimer = setTimeout(() => {
          setShowExitButton(false);
          addLog('⏰ Exit button auto-hidden');
        }, 5000);
        
        setExitButtonTimer(hideTimer);
        return 0;
      }
      return 0;
    });
  }, [isFullscreen, addLog]);

  // Prevent all gestures in fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const preventGestures = (e: TouchEvent) => {
      // Allow single touch for AR interaction
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const preventScroll = (e: TouchEvent) => {
      e.preventDefault();
    };

    const preventWheel = (e: WheelEvent) => {
      e.preventDefault();
    };

    const preventKeyboard = (e: KeyboardEvent) => {
      // Prevent F11, Escape, etc.
      if (e.key === 'F11' || e.key === 'Escape') {
        e.preventDefault();
      }
    };

    document.addEventListener('touchstart', preventGestures, { passive: false });
    document.addEventListener('touchmove', preventScroll, { passive: false });
    document.addEventListener('wheel', preventWheel, { passive: false });
    document.addEventListener('keydown', preventKeyboard);

    return () => {
      document.removeEventListener('touchstart', preventGestures);
      document.removeEventListener('touchmove', preventScroll);
      document.removeEventListener('wheel', preventWheel);
      document.removeEventListener('keydown', preventKeyboard);
    };
  }, [isFullscreen]);

  // Monitor fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      
      if (isCurrentlyFullscreen !== isFullscreen) {
        setIsFullscreen(isCurrentlyFullscreen);
        
        if (isCurrentlyFullscreen) {
          document.body.classList.add('fullscreen-locked');
          addLog('🖥️ Fullscreen activated by system');
        } else {
          document.body.classList.remove('fullscreen-locked');
          setShowExitButton(false);
          addLog('🖥️ Fullscreen deactivated by system');
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isFullscreen, addLog]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
      if (exitButtonTimer) {
        clearTimeout(exitButtonTimer);
      }
    };
  }, [longPressTimer, exitButtonTimer]);

  // Handle Snapchat login - functionality preserved but UI hidden
  const handleSnapchatLogin = useCallback(async (accessToken: string) => {
    try {
      addLog('🔗 Snapchat login successful, subscribing to Push2Web...');
      const success = await subscribePush2Web(accessToken);
      
      if (success) {
        setIsLoggedIn(true);
        setShowLogin(false);
        addLog('✅ Push2Web ready - can receive lenses from Lens Studio');
      } else {
        addLog('❌ Push2Web subscription failed');
      }
    } catch (error) {
      addLog(`❌ Login error: ${error}`);
    }
  }, [subscribePush2Web, addLog]);

  // Instagram redirect check
  useEffect(() => {
    const shouldRedirect = checkAndRedirect();
    
    if (shouldRedirect) {
      addLog('📱 Instagram redirect in progress...');
      setTimeout(() => {
        addLog('⏰ Redirect timeout - continuing with app');
        setAppReady(true);
      }, 3000);
    } else {
      addLog('✅ Browser check complete - initializing app');
      setAppReady(true);
    }
  }, [addLog]);

  // Auto-recovery on app focus/visibility
  useEffect(() => {
    const handleFocus = () => {
      if (cameraState === 'ready') {
        addLog('🔄 App focused - checking camera feed...');
        setTimeout(() => restoreCameraFeed(), 200);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && cameraState === 'ready') {
        addLog('👁️ App visible - restoring camera...');
        setTimeout(() => restoreCameraFeed(), 100);
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
    if (cameraState === 'ready') {
      addLog('📱 Camera already ready');
      return;
    }

    try {
      addLog('🎬 Starting app initialization...');
      
      const hasPermission = await checkCameraPermission();
      if (!hasPermission) return;

      const stream = await requestCameraStream(currentFacingMode, true);
      if (!stream) return;

      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      addLog(`📊 Camera stream: ${videoTracks.length} video, ${audioTracks.length} audio tracks`);
      
      if (audioTracks.length === 0) {
        addLog('🔇 WARNING: No audio tracks in camera stream - recordings will be silent!');
      }

      const success = await initializeCameraKit(stream, cameraFeedRef);
      if (success) {
        addLog('🎉 App initialization complete');
      }
    } catch (error) {
      addLog(`❌ Initialization failed: ${error}`);
    }
  }, [cameraState, addLog, checkCameraPermission, requestCameraStream, currentFacingMode, initializeCameraKit, cameraFeedRef]);

  const handleSwitchCamera = useCallback(async () => {
    if (!isReady) return;
    
    try {
      addLog('🔄 Switching camera...');
      const newStream = await switchCamera();
      if (newStream) {
        const audioTracks = newStream.getAudioTracks();
        addLog(`✅ Camera switched - Audio tracks: ${audioTracks.length}`);
      }
    } catch (error) {
      addLog(`❌ Camera switch failed: ${error}`);
    }
  }, [isReady, switchCamera, addLog]);

  const handleToggleRecording = useCallback(() => {
    const canvas = getCanvas();
    const stream = getStream();
    
    if (!canvas) {
      addLog('❌ Canvas not available');
      return;
    }

    if (stream) {
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      
      addLog(`📊 Pre-recording stream check: ${videoTracks.length} video, ${audioTracks.length} audio tracks`);
      
      if (audioTracks.length === 0) {
        addLog('🔇 CRITICAL WARNING: No audio tracks in camera stream!');
        addLog('📱 Recordings will be SILENT - check microphone permissions');
      } else {
        audioTracks.forEach((track, index) => {
          addLog(`🎤 Audio track ${index}: ${track.label || 'Unknown'}, state: ${track.readyState}, enabled: ${track.enabled}`);
          
          if (track.readyState !== 'live') {
            addLog(`⚠️ Audio track ${index} not live: ${track.readyState}`);
          }
          if (!track.enabled) {
            addLog(`⚠️ Audio track ${index} disabled`);
          }
        });
      }
    } else {
      addLog('❌ No camera stream available for recording');
      return;
    }

    toggleRecording(canvas, stream || undefined);
  }, [getCanvas, getStream, toggleRecording, addLog]);

  const handleReloadEffect = useCallback(async () => {
    if (!isReady) {
      addLog('❌ Cannot reload - camera not ready');
      return;
    }
    
    try {
      addLog('🔄 Reloading AR effect...');
      const success = await reloadLens();
      
      if (success) {
        addLog('✅ AR effect reloaded successfully');
      } else {
        addLog('❌ Failed to reload AR effect');
      }
    } catch (error) {
      addLog(`❌ Reload error: ${error}`);
    }
  }, [isReady, reloadLens, addLog]);

  const handleClosePreview = useCallback(() => {
    setShowPreview(false);
    addLog('📱 Preview closed');
    setTimeout(() => restoreCameraFeed(), 100);
  }, [setShowPreview, addLog, restoreCameraFeed]);

  const handleProcessAndShare = useCallback(() => {
    addLog('🎬 Starting video processing...');
    processAndShareVideo();
  }, [processAndShareVideo, addLog]);

  const handleDownload = useCallback(() => {
    downloadVideo();
    setTimeout(() => {
      setShowPreview(false);
      restoreCameraFeed();
    }, 500);
  }, [downloadVideo, setShowPreview, restoreCameraFeed]);

  // Initialize app when ready
  useEffect(() => {
    if (appReady) {
      addLog('🚀 App initialization starting...');
      initializeApp();
    }
  }, [appReady, initializeApp, addLog]);

  const handleRequestPermission = useCallback(async () => {
    try {
      addLog('🔒 Requesting camera + microphone permission...');
      const stream = await requestPermission();
      if (stream) {
        const audioTracks = stream.getAudioTracks();
        addLog(`✅ Permission granted with ${audioTracks.length} audio tracks`);
        stream.getTracks().forEach(track => track.stop());
        initializeApp();
      }
    } catch (error) {
      addLog(`❌ Permission failed: ${error}`);
    }
  }, [requestPermission, initializeApp, addLog]);

  const handleRetry = useCallback(() => {
    addLog('🔄 Retrying app initialization...');
    initializeApp();
  }, [initializeApp, addLog]);

  const handleRetryRedirect = useCallback(() => {
    addLog('📱 Manual Instagram redirect retry...');
    retryRedirect();
  }, [addLog]);

  // Show loading while checking/redirecting
  if (!appReady) {
    const isInInstagram = isInstagramBrowser();
    
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        {isInInstagram ? (
          <div className="text-center text-white p-6">
            <div className="text-6xl mb-6">🚀</div>
            <h2 className="text-2xl font-bold mb-4">Opening in Safari..</h2>
            <p className="text-white/70 mb-6">For the best AR experience</p>
            <button
              onClick={handleRetryRedirect}
              className="bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-lg text-white font-medium"
            >
              Try Again
            </button>
            <p className="text-xs text-white/50 mt-4">
              If redirect fails, manually copy URL to Safari
            </p>
          </div>
        ) : (
          <LoadingScreen 
            message="Web AR Netramaya"
            subMessage="Checking browser compatibility..."
          />
        )}
      </div>
    );
  }

  // Video preview
  if (showPreview && recordedVideo) {
    return (
      <>
        <VideoPreview
          recordedVideo={recordedVideo}
          onClose={handleClosePreview}
          onDownload={handleDownload}
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
            setTimeout(() => restoreCameraFeed(), 100);
          }}
        />
      </>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black flex flex-col"
      onTouchStart={handleLongPress}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleLongPress}
      onMouseUp={handleTouchEnd}
      onClick={handleDoubleTap}
    >
      {/* Camera Feed */}
      <CameraFeed
        cameraFeedRef={cameraFeedRef}
        cameraState={cameraState}
        recordingState={recordingState}
        isFlipped={isFlipped}
      />

      {/* Camera Controls - Already hidden via updated component */}
      <CameraControls
        onSettings={() => setShowSettings(true)}
        onFlip={() => setIsFlipped(!isFlipped)}
      />

      {/* Recording Controls - Already hidden via updated component */}
      <RecordingControls
        recordingState={recordingState}
        recordingTime={recordingTime}
        onToggleRecording={handleToggleRecording}
        onGallery={handleReloadEffect}
        onSwitchCamera={handleSwitchCamera}
        formatTime={formatTime}
        disabled={!isReady}
      />

      {/* Remote API Status - For debugging only (can be removed or hidden in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-20 right-4 bg-black/50 p-2 rounded text-xs text-white/70">
          <div>Hadiah: {hadiahAvailable ? '✅' : '❌'}</div>
          <div>Score: {currentScore}</div>
        </div>
      )}

      {/* Fullscreen Entry Button - Show only when NOT in fullscreen */}
      {!isFullscreen && isReady && (
        <button
          onClick={enterFullscreen}
          className="fullscreen-button"
          aria-label="Enter Fullscreen"
        >
          <Maximize className="w-6 h-6" />
        </button>
      )}

      {/* Exit Fullscreen Button - Show only when in fullscreen and exit button is visible */}
      {isFullscreen && showExitButton && (
        <button
          onClick={() => {
            setShowExitButton(false);
            exitFullscreen();
          }}
          className="exit-fullscreen-button"
          aria-label="Exit Fullscreen"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Essential modals */}
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
        currentStream={getStream()}
        canvas={getCanvas()}
        containerRef={cameraFeedRef}
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
          setTimeout(() => restoreCameraFeed(), 100);
        }}
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <CameraProvider>
      <RemoteApiProvider>
        <RecordingProvider addLog={() => {}}>
          <AppWithContext />
        </RecordingProvider>
      </RemoteApiProvider>
    </CameraProvider>
  );
};

const AppWithContext: React.FC = () => {
  const { addLog, restoreCameraFeed } = useCameraContext();
  
  return (
    <RecordingProvider addLog={addLog} restoreCameraFeed={restoreCameraFeed}>
      <CameraApp />
    </RecordingProvider>
  );
};

export default App;