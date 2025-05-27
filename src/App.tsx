// src/App.tsx - Optimized Camera Kit Initialization
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Share, Share2, Send, Circle, Square, RotateCcw, Settings, Download,
  Play, Camera, Video, Sparkles, Zap, Stars, FlipHorizontal
} from 'lucide-react';
import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from '@snap/camera-kit';
import { CAMERA_KIT_CONFIG, validateConfig } from './config/cameraKit';
import fixWebmDuration from 'fix-webm-duration';
// Preload Camera Kit instance (singleton pattern)
let cameraKitInstance: any = null;
let isBootstrapping = false;
let preloadPromise: Promise<any> | null = null;

const preloadCameraKit = async () => {
  // Return existing instance if available
  if (cameraKitInstance) return cameraKitInstance;
  
  // Return existing promise if already bootstrapping
  if (preloadPromise) return preloadPromise;
  
  preloadPromise = (async () => {
    try {
      isBootstrapping = true;
      console.log('🚀 Preloading Camera Kit...');
      
      validateConfig();
      cameraKitInstance = await bootstrapCameraKit({ 
        apiToken: CAMERA_KIT_CONFIG.apiToken 
      });
      
      console.log('✅ Camera Kit preloaded');
      return cameraKitInstance;
    } catch (error) {
      console.error('❌ Failed to preload Camera Kit:', error);
      cameraKitInstance = null;
      preloadPromise = null; // Reset promise so it can be retried
      throw error;
    } finally {
      isBootstrapping = false;
    }
  })();
  
  return preloadPromise;
};

// Start preloading immediately when module loads
preloadCameraKit().catch(console.error);

type CameraState = 'initializing' | 'ready' | 'error';
type RecordingState = 'idle' | 'recording' | 'processing';

const CameraKitApp: React.FC = () => {
  const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraState, setCameraState] = useState<CameraState>('initializing');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordedVideo, setRecordedVideo] = useState<Blob | File | null>(null);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const cameraFeedRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isAttachedRef = useRef<boolean>(false);
  const lensRepositoryRef = useRef<any>(null);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry);
    setDebugLogs(prev => [...prev.slice(-10), logEntry]);
  }, []);

  // Optimized initialization with parallel operations
  const initializeCameraKit = useCallback(async () => {
    try {
      addLog('🚀 Starting optimized Camera Kit initialization...');
      setCameraState('initializing');

      // Step 1: Get camera stream in parallel with Camera Kit
      const streamPromise = navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: currentFacingMode,
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        },
        audio: CAMERA_KIT_CONFIG.camera.audio
      });

      // Step 2: Ensure Camera Kit is properly loaded
      let cameraKit = cameraKitInstance;
      if (!cameraKit) {
        addLog('Camera Kit not preloaded, bootstrapping now...');
        cameraKit = await preloadCameraKit();
      }
      
      if (!cameraKit) {
        throw new Error('Failed to initialize Camera Kit instance');
      }
      
      // Step 3: Create session and get stream in parallel
      const [session, stream] = await Promise.all([
        cameraKit.createSession(),
        streamPromise
      ]);

      sessionRef.current = session;
      streamRef.current = stream;
      addLog('✅ Session and stream ready');

      // Step 4: Setup error handling early
      session.events.addEventListener("error", (event: any) => {
        addLog(`❌ Session error: ${event.detail}`);
        setCameraState('error');
      });

      // Step 5: Create and configure source
      const source = createMediaStreamSource(stream);
      await session.setSource(source);
      
      if (currentFacingMode === 'user') {
        source.setTransform(Transform2D.MirrorX);
      }
      addLog('✅ Camera source configured');

      // Step 6: Load lens repository (cache it for future use)
      if (!lensRepositoryRef.current) {
        const { lenses } = await cameraKit.lensRepository.loadLensGroups([
          CAMERA_KIT_CONFIG.lensGroupId
        ]);
        lensRepositoryRef.current = lenses;
        addLog('✅ Lens repository cached');
      }

      // Step 7: Apply lens
      const lenses = lensRepositoryRef.current;
      if (lenses && lenses.length > 0) {
        const targetLens = lenses.find((lens: any) => lens.id === CAMERA_KIT_CONFIG.lensId) || lenses[0];
        await session.applyLens(targetLens);
        addLog(`✅ Lens applied: ${targetLens.name}`);
      }

      // Step 8: Start playback
      session.play('live');

      // Step 9: Attach output to DOM
      if (cameraFeedRef.current && session.output.live && !isAttachedRef.current) {
        attachCameraOutput(session.output.live);
      }

      setCameraState('ready');
      addLog('🎉 Camera Kit initialization complete');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`❌ Camera Kit error: ${errorMessage}`);
      console.error('Camera Kit initialization failed:', error);
      setCameraState('error');
    }
  }, [currentFacingMode, addLog]);

  // Optimized DOM attachment
  const attachCameraOutput = useCallback((canvas: HTMLCanvasElement) => {
    if (!cameraFeedRef.current) return;

    // Use requestAnimationFrame for smooth DOM updates
    requestAnimationFrame(() => {
      if (cameraFeedRef.current) {
        cameraFeedRef.current.innerHTML = '';
        
        outputCanvasRef.current = canvas;
        canvas.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          inset: 0;
        `;
        canvas.className = 'absolute inset-0 w-full h-full object-cover';
        
        cameraFeedRef.current.appendChild(canvas);
        isAttachedRef.current = true;
        addLog('✅ Camera output attached');
      }
    });
  }, [addLog]);

  // Optimized camera switching
  const switchCamera = useCallback(async () => {
    if (!sessionRef.current || cameraState !== 'ready') return;

    try {
      setCameraState('initializing');
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      
      addLog(`🔄 Switching to ${newFacingMode} camera`);

      // Pause session first
      sessionRef.current.pause();
      
      // Stop current stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Get new stream with optimized constraints
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: newFacingMode,
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        },
        audio: true
      });
      
      streamRef.current = newStream;
      
      // Create and configure new source
      const source = createMediaStreamSource(newStream);
      await sessionRef.current.setSource(source);
      
      if (newFacingMode === 'user') {
        source.setTransform(Transform2D.MirrorX);
      }
      
      // Restart session
      sessionRef.current.play('live');
      setCurrentFacingMode(newFacingMode);
      setCameraState('ready');
      
      addLog(`✅ Switched to ${newFacingMode} camera`);
    } catch (error) {
      addLog(`❌ Camera switch failed: ${error}`);
      setCameraState('error');
    }
  }, [currentFacingMode, cameraState, addLog]);

  const getBestMimeType = useCallback((): string => {
    const codecs = [
      'video/mp4;codecs=h264,aac',    // Prioritas utama
      'video/mp4',                    // Fallback MP4
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    
    const supported = codecs.find(codec => 
      MediaRecorder.isTypeSupported(codec)
    );
    
    addLog(`🎥 Using codec: ${supported || 'video/webm'}`);
    return supported || 'video/webm';
  }, [addLog]);

const startRecording = useCallback(() => {
  if (!streamRef.current || cameraState !== 'ready') {
    addLog('❌ Cannot start recording - stream not ready');
    return;
  }

  try {
    // Use original camera stream instead of canvas
    const recordStream = streamRef.current.clone();
    
    const mediaRecorder = new MediaRecorder(recordStream, {
      mimeType: 'video/mp4',
      videoBitsPerSecond: 1000000
    });

    const chunks: Blob[] = [];
    
    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const file = new File([blob], `lens-video-${Date.now()}.mp4`, {
        type: 'video/mp4',
        lastModified: Date.now()
      });
      
      setRecordedVideo(file);
      setShowPreview(true);
      setRecordingState('idle');
      addLog('✅ Recording completed');
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(100);
    setRecordingState('recording');
    addLog('🎬 Recording started');
  } catch (error) {
    addLog(`❌ Failed to start recording: ${error}`);
    setRecordingState('idle');
  }
}, [cameraState, addLog]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      // Add 500ms delay for Android
      setTimeout(() => {
        mediaRecorderRef.current?.stop();
      }, 500);
      setRecordingState('processing');
      addLog('⏹️ Recording stopped');
    }
  }, [recordingState, addLog]);

  const toggleRecording = useCallback(() => {
    if (recordingState === 'recording') {
      // Only stop if recorded > 2 seconds
      if (recordingTime >= 2) {
        stopRecording();
      }
    } else {
      startRecording();
    }
  }, [recordingState, recordingTime, startRecording, stopRecording]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      addLog('🔄 Camera stream stopped');
    }
    if (sessionRef.current) {
      sessionRef.current.pause();
      addLog('⏸️ Camera Kit session paused');
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [addLog]);

  // Initialize on mount
  useEffect(() => {
    addLog('🎬 Component mounted - starting initialization');
    initializeCameraKit();
    
    return cleanup;
  }, [initializeCameraKit, cleanup, addLog]);

  // Recording timer
  useEffect(() => {
    if (recordingState === 'recording') {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setRecordingTime(0);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recordingState]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Share and download functions
  const shareVideo = async () => {
    if (!recordedVideo) return;
    
    try {
      // Use existing file directly if it's already a File
      const file = recordedVideo instanceof File ? 
        recordedVideo : 
        new File([recordedVideo], `lens-video-${Date.now()}.mp4`, {
          type: recordedVideo.type,
          lastModified: Date.now()
        });
  
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My Lens Video',
          text: 'Check out this cool lens effect!'
        });
        addLog('✅ Video shared successfully');
      } else {
        downloadVideo();
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

  const closePreview = () => {
    setShowPreview(false);
    setRecordedVideo(null);
    
    if (sessionRef.current) {
      sessionRef.current.play('live');
    }
    
    setTimeout(() => {
      if (outputCanvasRef.current && cameraFeedRef.current) {
        attachCameraOutput(outputCanvasRef.current);
      }
    }, 100);
  };

  // UI Components remain the same...
  const ControlButton: React.FC<{
    icon: React.ElementType;
    onClick: () => void;
    label: string;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
  }> = ({ icon: Icon, onClick, label, className = '', size = 'md', disabled = false }) => {
    const sizeClasses = {
      sm: 'w-10 h-10',
      md: 'w-12 h-12',
      lg: 'w-16 h-16'
    };

    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          ${sizeClasses[size]} 
          rounded-full 
          backdrop-blur-md 
          bg-white/20 
          border 
          border-white/30 
          flex 
          items-center 
          justify-center 
          text-white 
          hover:bg-white/30 
          transition-all 
          duration-200 
          active:scale-95
          disabled:opacity-50
          disabled:cursor-not-allowed
          ${className}
        `}
      >
        <Icon className="w-5 h-5" />
      </button>
    );
  };

  const RecordButton: React.FC = () => (
    <div className="relative">
      <button
        onClick={toggleRecording}
        disabled={cameraState !== 'ready'}
        className={`
          w-20 h-20 
          rounded-full 
          border-4 
          border-white 
          flex 
          items-center 
          justify-center 
          transition-all 
          duration-200 
          active:scale-95
          disabled:opacity-50
          ${recordingState === 'recording' 
            ? 'bg-red-500 hover:bg-red-600' 
            : 'bg-white/20 hover:bg-white/30 backdrop-blur-md'
          }
        `}
      >
        {recordingState === 'recording' ? (
          <Square className="w-8 h-8 text-white fill-white" />
        ) : recordingState === 'processing' ? (
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Circle className="w-12 h-12 text-red-500 fill-red-500" />
        )}
      </button>
      
      {recordingState === 'recording' && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
          <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
            {formatTime(recordingTime)}
          </div>
        </div>
      )}
    </div>
  );

  // Preview screen
  if (showPreview && recordedVideo) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/50 to-transparent z-20">
          <div className="flex justify-between items-center">
            <button
              onClick={closePreview}
              className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-white font-semibold">Preview</h2>
            <div className="w-10" />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <video
            src={URL.createObjectURL(recordedVideo)}
            controls
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        </div>

        <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/50 to-transparent z-20">
          <div className="flex items-center justify-center space-x-8">
            <ControlButton 
              icon={Download} 
              onClick={downloadVideo} 
              label="Download"
              size="lg"
            />
            <ControlButton 
              icon={Send} 
              onClick={shareVideo} 
              label="Share"
              size="lg"
            />
          </div>
        </div>
      </div>
    );
  }

  // Main camera interface
  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900"></div>
        
        <div 
          ref={cameraFeedRef}
          className={`absolute inset-0 transition-transform duration-300 ${isFlipped ? 'scale-x-[-1]' : ''}`}
        >
          <div className="w-full h-full bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-blue-500/20 flex items-center justify-center">
            <div className="text-white/50 text-center">
              <Camera className="w-16 h-16 mx-auto mb-4" />
              <p>Camera Feed {cameraState === 'ready' ? '(Live)' : '(Loading...)'}</p>
              <p className="text-sm mt-2">State: {cameraState}</p>
            </div>
          </div>
        </div>

        {/* Top controls */}
        <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/50 to-transparent z-10">
          <div className="flex justify-between items-center">
            <ControlButton 
              icon={Settings} 
              onClick={() => setShowSettings(!showSettings)} 
              label="Settings"
            />
            <div className="text-white text-center">
              <img 
                src="images/attribution.png" 
                alt="Attribution" 
                className="h-4 mx-auto"
              />
            </div>
            <ControlButton 
              icon={FlipHorizontal} 
              onClick={() => setIsFlipped(!isFlipped)} 
              label="Flip"
            />
          </div>
        </div>

        {/* Recording indicator */}
        {recordingState === 'recording' && (
          <div className="absolute top-20 left-4 flex items-center space-x-2 bg-red-500/80 backdrop-blur-md rounded-full px-3 py-2 z-10">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-white text-sm font-medium">REC</span>
          </div>
        )}

        {/* Bottom controls */}
        <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/50 to-transparent z-10">
          <div className="flex items-center justify-between">
            <ControlButton 
              icon={Video} 
              onClick={() => addLog('Gallery clicked')} 
              label="Gallery"
              size="lg"
            />
            
            <RecordButton />
            
            <ControlButton 
              icon={RotateCcw} 
              onClick={switchCamera}
              label="Switch Camera"
              size="lg"
            />
          </div>
        </div>

        {/* Loading state - improved with progress indication */}
        {cameraState === 'initializing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-30">
            <div className="text-center px-6">
              <div className="relative w-16 h-16 mx-auto mb-6">
                <div className="w-16 h-16 border-4 border-white/20 rounded-full"></div>
                <div className="absolute inset-0 w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="text-white text-lg font-medium mb-2">Initializing Web AR Netramaya...</div>
              <div className="text-white/60 text-sm">Optimized loading in progress</div>
            </div>
          </div>
        )}

        {/* Error state */}
        {cameraState === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-30">
            <div className="text-center px-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-400" />
              </div>
              <div className="text-white text-lg font-medium mb-2">Camera Kit Error</div>
              <div className="text-white/60 text-sm mb-4">Please check your configuration</div>
              <button
                onClick={initializeCameraKit}
                className="px-4 py-2 bg-white/20 rounded-lg text-white hover:bg-white/30 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraKitApp;