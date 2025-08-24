// src/App.tsx - Complete with OAuth routing
import React, { useState, useEffect, useCallback } from 'react';
import { 
  CameraProvider, 
  RecordingProvider, 
  useCameraContext, 
  useRecordingContext 
} from './context';
import { LoginKit } from './components/LoginKit';
import { OAuthCallback } from './components/OAuthCallback';
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
import { checkAndRedirect, isInstagramBrowser, retryRedirect } from './utils/instagramBrowserDetector';
import { Maximize, X } from 'lucide-react';

const CameraApp: React.FC = () => {
  // Check if this is OAuth callback URL
  if (window.location.pathname === '/oauth-callback' || window.location.hash.includes('access_token')) {
    return <OAuthCallback />;
  }

  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [appReady, setAppReady] = useState<boolean>(false);
  
  // Push2Web state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState<boolean>(false);
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showExitButton, setShowExitButton] = useState<boolean>(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [exitButtonTimer, setExitButtonTimer] = useState<NodeJS.Timeout | null>(null);
  const [tapCount, setTapCount] = useState<number>(0);

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

  // Handle Login success
  const handleLogin = useCallback(async (token: string) => {
    try {
      setAccessToken(token);
      setIsLoggedIn(true);
      setShowLogin(false);
      addLog(`✅ Snapchat login successful: ${token.substring(0, 10)}...`);
      
      // Subscribe to Push2Web dengan access token
      const success = await subscribePush2Web(token);
      if (success) {
        addLog('🎭 Push2Web subscription successful - ready to receive lenses!');
      } else {
        addLog('⚠️ Push2Web subscription failed');
      }
    } catch (error) {
      addLog(`❌ Login handler error: ${error}`);
    }
  }, [addLog, subscribePush2Web]);

  // Handle Login error
  const handleLoginError = useCallback((error: string) => {
    addLog(`❌ Login error: ${error}`);
  }, [addLog]);

  // Show Push2Web status in settings
  const handleShowPush2WebStatus = useCallback(() => {
    const status = getPush2WebStatus();
    addLog(`📊 Push2Web Status: Available: ${status.available}, Subscribed: ${status.subscribed}, Session: ${status.session}, Repository: ${status.repository}`);
  }, [addLog, getPush2WebStatus]);

  // Fullscreen functions
  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      
      if ('orientation' in screen && 'lock' in screen.orientation) {
        try {
          await (screen.orientation as any).lock('portrait');
          addLog('🔒 Portrait orientation locked');
        } catch (orientationError) {
          addLog(`⚠️ Orientation lock failed: ${orientationError}`);
        }
      }
      
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
      
      document.body.classList.remove('fullscreen-locked');
      
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

  // Long press handlers
  const handleLongPress = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isFullscreen) return;
    
    e.preventDefault();
    
    const timer = setTimeout(() => {
      setShowExitButton(true);
      addLog('📱 Long press detected - showing exit button');
      
      const hideTimer = setTimeout(() => {
        setShowExitButton(false);
        addLog('⏰ Exit button auto-hidden');
      }, 5000);
      
      setExitButtonTimer(hideTimer);
    }, 1500);
    
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
        setTimeout(() => setTapCount(0), 500);
        return 1;
      } else if (prev === 1) {
        setShowExitButton(true);
        addLog('👆 Double tap detected - showing exit button');
        
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

  // Fullscreen event handlers
  useEffect(() => {
    if (!isFullscreen) return;

    const preventGestures = (e: TouchEvent) => {
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

  // Initialize app when ready
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
        
        // Show Push2Web login after camera is ready
        if (!isLoggedIn && !showLogin) {
          setShowLogin(true);
          addLog('🔒 Camera ready - showing Snapchat login for Push2Web');
        }
      }
    } catch (error) {
      addLog(`❌ Initialization failed: ${error}`);
    }
  }, [cameraState, addLog, checkCameraPermission, requestCameraStream, currentFacingMode, initializeCameraKit, cameraFeedRef, isLoggedIn, showLogin]);

  useEffect(() => {
    if (appReady) {
      addLog('🚀 App initialization starting...');
      initializeApp();
    }
  }, [appReady, initializeApp, addLog]);

  // Other handlers
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
    
    if (!canvas || !stream) {
      addLog('❌ Canvas or stream not available');
      return;
    }

    const audioTracks = stream.getAudioTracks();
    addLog(`📊 Recording with ${audioTracks.length} audio tracks`);

    toggleRecording(canvas, stream);
  }, [getCanvas, getStream, toggleRecording, addLog]);

  const handleReloadEffect = useCallback(async () => {
    if (!isReady) {
      addLog('❌ Cannot reload - camera not ready');
      return;
    }
    
    const success = await reloadLens();
    addLog(success ? '✅ AR effect reloaded' : '❌ Failed to reload AR effect');
  }, [isReady, reloadLens, addLog]);

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
              onClick={() => retryRedirect()}
              className="bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-lg text-white font-medium"
            >
              Try Again
            </button>
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

  // Show Push2Web Login
  if (showLogin && !isLoggedIn) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-6">
        <div className="bg-black/50 backdrop-blur-md rounded-xl p-8 max-w-sm w-full">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🎭</div>
            <h2 className="text-2xl font-bold text-white mb-2">Push2Web Ready</h2>
            <p className="text-white/70 text-sm">Connect to Lens Studio for live lens testing</p>
          </div>
          
          <LoginKit 
            onLogin={handleLogin}
            onError={handleLoginError}
          />
          
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setShowLogin(false);
                addLog('⏭️ Skipping Push2Web login - camera only mode');
              }}
              className="text-white/60 hover:text-white text-sm transition-colors"
            >
              Skip and use Camera only
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Video preview
  if (showPreview && recordedVideo) {
    return (
      <>
        <VideoPreview
          recordedVideo={recordedVideo}
          onClose={() => {
            setShowPreview(false);
            setTimeout(() => restoreCameraFeed(), 100);
          }}
          onDownload={() => {
            downloadVideo();
            setTimeout(() => {
              setShowPreview(false);
              restoreCameraFeed();
            }, 500);
          }}
          onProcessAndShare={processAndShareVideo}
        />
        
        <RenderingModal
          isOpen={showRenderingModal}
          progress={processingProgress}
          message={processingMessage}
          isComplete={processingProgress === 100 && !processingError}
          hasError={!!processingError}
          onCancel={() => {
            setShowRenderingModal(false);
            setTimeout(() => restoreCameraFeed(), 100);
          }}
        />
      </>
    );
  }

  // Main app UI
  return (
    <div 
      className="fixed inset-0 bg-black flex flex-col"
      onTouchStart={handleLongPress}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleLongPress}
      onMouseUp={handleTouchEnd}
      onClick={handleDoubleTap}
    >
      <CameraFeed
        cameraFeedRef={cameraFeedRef}
        cameraState={cameraState}
        recordingState={recordingState}
        isFlipped={isFlipped}
      />

      <CameraControls
        onSettings={() => {
          setShowSettings(true);
          handleShowPush2WebStatus();
        }}
        onFlip={() => setIsFlipped(!isFlipped)}
        isFullscreen={isFullscreen}
      />

      <RecordingControls
        recordingState={recordingState}
        recordingTime={recordingTime}
        onToggleRecording={handleToggleRecording}
        onGallery={handleReloadEffect}
        onSwitchCamera={handleSwitchCamera}
        formatTime={formatTime}
        disabled={!isReady}
      />

      {/* Push2Web Status Indicator */}
      {isLoggedIn && (
        <div className="absolute top-16 left-4 z-20">
          <div className="bg-green-500/20 backdrop-blur-sm border border-green-500/30 rounded-lg px-3 py-1">
            <div className="text-green-300 text-xs font-medium flex items-center space-x-1">
              <span>🎭</span>
              <span>Push2Web Ready</span>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen buttons */}
      {!isFullscreen && isReady && (
        <button
          onClick={enterFullscreen}
          className="fullscreen-button"
        >
          <Maximize className="w-6 h-6" />
        </button>
      )}

      {isFullscreen && showExitButton && (
        <button
          onClick={exitFullscreen}
          className="exit-fullscreen-button"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Loading and error screens */}
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
          onRequestPermission={async () => {
            const stream = await requestPermission();
            if (stream) {
              stream.getTracks().forEach(track => track.stop());
              initializeApp();
            }
          }}
          onRetry={initializeApp}
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
        subscribePush2Web={subscribePush2Web}
        getPush2WebStatus={getPush2WebStatus}
        addLog={addLog}
      />

      <RenderingModal
        isOpen={showRenderingModal && !showPreview}
        progress={processingProgress}
        message={processingMessage}
        isComplete={processingProgress === 100 && !processingError}
        hasError={!!processingError}
        onCancel={() => {
          setShowRenderingModal(false);
          setTimeout(() => restoreCameraFeed(), 100);
        }}
      />
    </div>
  );
};

// Main App component wrapper
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
  const { addLog, restoreCameraFeed } = useCameraContext();
  
  return (
    <RecordingProvider addLog={addLog} restoreCameraFeed={restoreCameraFeed}>
      <CameraApp />
    </RecordingProvider>
  );
};

export default App;