// Get best supported video format
const getBestMimeType = (): string => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  if (isIOS) {
    console.log('Using codec: video/mp4 (iOS detected)');
    return 'video/mp4';
  }
  
  const codecs = [
    'video/mp4;codecs=h264',     // Best compatibility (iOS + Android)
    'video/webm;codecs=vp9',     // High quality (modern Android)
    'video/webm;codecs=vp8',     // Good fallback
    'video/webm'                 // Basic fallback
  ];
  
  const supported = codecs.find(codec => 
    MediaRecorder.isTypeSupported(codec)
  );
  
  console.log(`Using codec: ${supported || 'video/webm'}`);
  return supported || 'video/webm';
 };// src/App.tsx - Complete Camera Kit Integration
import React, { useState, useRef, useEffect } from 'react';
import { 
X, 
Share, 
Circle, 
Square, 
RotateCcw, 
Settings, 
Download,
Play,
Camera,
Video,
Sparkles,
Zap,
Stars,
FlipHorizontal
} from 'lucide-react';
import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from '@snap/camera-kit';
import { CAMERA_KIT_CONFIG, validateConfig } from './config/cameraKit';

console.log('🚀 App.tsx loaded');

type CameraState = 'initializing' | 'ready' | 'error';
type RecordingState = 'idle' | 'recording' | 'processing';

const CameraKitApp: React.FC = () => {
console.log('🎯 Component rendering started');
const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>('user');
const [cameraState, setCameraState] = useState<CameraState>('initializing');
const [recordingState, setRecordingState] = useState<RecordingState>('idle');
const [recordedVideo, setRecordedVideo] = useState<Blob | null>(null);
const [showPreview, setShowPreview] = useState<boolean>(false);
const [showSettings, setShowSettings] = useState<boolean>(false);
const [isFlipped, setIsFlipped] = useState<boolean>(false);
const [recordingTime, setRecordingTime] = useState<number>(0);
const [selectedFilter, setSelectedFilter] = useState<string>('none');
const [debugLogs, setDebugLogs] = useState<string[]>([]);

const cameraFeedRef = useRef<HTMLDivElement>(null);
const streamRef = useRef<MediaStream | null>(null);
const sessionRef = useRef<any>(null);
const mediaRecorderRef = useRef<MediaRecorder | null>(null);
const timerRef = useRef<NodeJS.Timeout | null>(null);
const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);
const isAttachedRef = useRef<boolean>(false);

const addLog = (message: string) => {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${message}`;
  console.log(logEntry);
  setDebugLogs(prev => [...prev.slice(-10), logEntry]);
};
const switchCamera = async () => {
  if (!sessionRef.current || cameraState !== 'ready') return;

  try {
    setCameraState('initializing');
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    
    // Stop current stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Pause session
    sessionRef.current.pause();
    
    // Get new stream
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: newFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: true
    });
    
    streamRef.current = newStream;
    
    // Create new source
    const source = createMediaStreamSource(newStream);
    await sessionRef.current.setSource(source);
    
    // Mirror front camera
    if (newFacingMode === 'user') {
      source.setTransform(Transform2D.MirrorX);
    }
    
    // Restart
    sessionRef.current.play('live');
    setCurrentFacingMode(newFacingMode);
    setCameraState('ready');
    
  } catch (error) {
    setCameraState('error');
  }
};

useEffect(() => {
  addLog('Component mounted');
  initializeCameraKit();
  return () => {
    addLog('Component unmounting');
    cleanup();
  };
}, []);

const initializeCameraKit = async () => {
  try {
    addLog('Starting Camera Kit initialization...');
    
    // Validate config
    validateConfig();
    addLog('Config validation passed');
    
    // Bootstrap Camera Kit
    const cameraKit = await bootstrapCameraKit({ 
      apiToken: CAMERA_KIT_CONFIG.apiToken 
    });
    addLog('Camera Kit bootstrapped');

    // Create session
    const session = await cameraKit.createSession();
    sessionRef.current = session;
    addLog('Camera Kit session created');

    // Error handling
    session.events.addEventListener("error", (event: any) => {
      addLog(`Session error: ${event.detail}`);
      setCameraState('error');
    });

    // Get camera stream
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: currentFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: CAMERA_KIT_CONFIG.camera.audio
    });
    streamRef.current = stream;
    addLog('Camera stream acquired');

    // Create media stream source
    const source = createMediaStreamSource(stream);
    await session.setSource(source);
    source.setTransform(Transform2D.MirrorX);
    addLog('Camera source set');

    // Load and apply lens
    const { lenses } = await cameraKit.lensRepository.loadLensGroups([CAMERA_KIT_CONFIG.lensGroupId]);
    if (lenses.length > 0) {
      const targetLens = lenses.find(lens => lens.id === CAMERA_KIT_CONFIG.lensId) || lenses[0];
      await session.applyLens(targetLens);
      addLog(`Lens applied: ${targetLens.name}`);
    }

    // Start playback
    session.play('live');
    
    // Attach output to DOM
    if (cameraFeedRef.current && session.output.live && !isAttachedRef.current) {
      // Clear existing content
      cameraFeedRef.current.innerHTML = '';
      
      // Add camera output
      outputCanvasRef.current = session.output.live;
      session.output.live.style.width = '100%';
      session.output.live.style.height = '100%';
      session.output.live.style.objectFit = 'cover';
      session.output.live.className = 'absolute inset-0 w-full h-full object-cover';
      
      cameraFeedRef.current.appendChild(session.output.live);
      isAttachedRef.current = true;
      addLog('Camera output attached to DOM');
    }
    
    setCameraState('ready');
    addLog('Camera Kit initialization complete');
  } catch (error) {
    addLog(`Camera Kit error: ${error instanceof Error ? error.message : String(error)}`);
    console.error('Camera Kit initialization failed:', error);
    setCameraState('error');
  }
};

const cleanup = () => {
  if (streamRef.current) {
    streamRef.current.getTracks().forEach(track => track.stop());
    addLog('Camera stream stopped');
  }
  if (sessionRef.current) {
    sessionRef.current.pause();
    addLog('Camera Kit session paused');
  }
  if (timerRef.current) {
    clearInterval(timerRef.current);
    addLog('Timer cleaned up');
  }
};

useEffect(() => {
  if (recordingState === 'recording') {
    addLog('Recording started - timer beginning');
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  } else {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      addLog('Recording timer stopped');
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


const startRecording = () => {
  if (!outputCanvasRef.current || cameraState !== 'ready') {
    addLog('Cannot start recording - canvas not ready');
    return;
  }

  try {
    // Create stream from processed canvas output
    const canvasStream = outputCanvasRef.current.captureStream(30);
    
    // Add audio from original stream
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach(track => canvasStream.addTrack(track));
    }

    const mimeType = getBestMimeType();
    const mediaRecorder = new MediaRecorder(canvasStream, {
      mimeType,
      videoBitsPerSecond: CAMERA_KIT_CONFIG.recording.videoBitsPerSecond
    });

    const chunks: Blob[] = [];
    
    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      setRecordedVideo(blob);
      setShowPreview(true);
      setRecordingState('idle');
      addLog('Recording completed');
    };

    mediaRecorder.onerror = (event) => {
      addLog(`Recording error: ${event}`);
      setRecordingState('idle');
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setRecordingState('recording');
    addLog('Recording started');
  } catch (error) {
    addLog(`Failed to start recording: ${error instanceof Error ? error.message : String(error)}`);
    setRecordingState('idle');
  }
};

const stopRecording = () => {
  if (mediaRecorderRef.current && recordingState === 'recording') {
    mediaRecorderRef.current.stop();
    setRecordingState('processing');
    addLog('Recording stopped');
  }
};

const toggleRecording = () => {
  addLog(`Recording toggle clicked - current state: ${recordingState}`);
  
  if (recordingState === 'recording') {
    stopRecording();
  } else {
    startRecording();
  }
};

const shareVideo = async () => {
  if (!recordedVideo) return;
  
  addLog('Share button clicked');
  
  try {
    const fileExtension = recordedVideo.type.includes('mp4') ? '.mp4' : '.webm';
    const file = new File([recordedVideo], `lens-video${fileExtension}`, {
      type: recordedVideo.type
    });

    // Check if native sharing is supported
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'My Lens Video',
        text: 'Check out this cool lens effect!'
      });
      addLog('Video shared successfully');
    } else {
      // Fallback to download
      addLog('Native sharing not supported, downloading instead');
      downloadVideo();
    }
  } catch (error) {
    addLog(`Sharing failed: ${error instanceof Error ? error.message : String(error)}`);
    // Fallback to download on error
    downloadVideo();
  }
};

const downloadVideo = () => {
  if (!recordedVideo) return;
  
  addLog('Download button clicked');
  
  const url = URL.createObjectURL(recordedVideo);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lens-video.webm';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const closePreview = () => {
  setShowPreview(false);
  setRecordedVideo(null);
  
  // Restart camera session
  if (sessionRef.current) {
    addLog('Restarting camera session');
    try {
      sessionRef.current.play('live');
    } catch (error) {
      addLog(`Session restart error: ${error}`);
    }
  }
  
  // Reattach camera canvas with retry logic
  const reattachCanvas = () => {
    if (outputCanvasRef.current && cameraFeedRef.current) {
      const isAttached = cameraFeedRef.current.contains(outputCanvasRef.current);
      
      if (!isAttached) {
        addLog('Reattaching camera canvas');
        cameraFeedRef.current.innerHTML = '';
        outputCanvasRef.current.style.width = '100%';
        outputCanvasRef.current.style.height = '100%';
        outputCanvasRef.current.style.objectFit = 'cover';
        outputCanvasRef.current.className = 'absolute inset-0 w-full h-full object-cover';
        cameraFeedRef.current.appendChild(outputCanvasRef.current);
        addLog('Camera canvas reattached');
      }
    } else {
      // Retry after a short delay if refs aren't ready
      setTimeout(reattachCanvas, 50);
    }
  };
  
  // Small delay to ensure DOM is ready after state change
  setTimeout(reattachCanvas, 10);
};

const toggleFlip = () => {
  addLog(`Flip camera: ${!isFlipped}`);
  setIsFlipped(!isFlipped);
};

const toggleSettings = () => {
  addLog(`Settings panel: ${!showSettings}`);
  setShowSettings(!showSettings);
};

// Control buttons component
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

  const handleClick = () => {
    addLog(`Button clicked: ${label}`);
    onClick();
  };

  return (
    <button
      onClick={handleClick}
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



// Main record button
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



// Settings panel
const SettingsPanel: React.FC = () => (
  <div className="absolute inset-x-4 top-20 bg-black/80 backdrop-blur-xl rounded-3xl p-6 border border-white/10 z-20">
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-white text-lg font-semibold">Settings</h3>
      <button
        onClick={() => {
          addLog('Settings closed');
          setShowSettings(false);
        }}
        className="text-white/60 hover:text-white transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
    
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-white/80">Resolution</span>
        <select 
          className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
          onChange={(e) => addLog(`Resolution changed: ${e.target.value}`)}
        >
          <option value="720p">720p</option>
          <option value="1080p">1080p</option>
          <option value="4k">4K</option>
        </select>
      </div>
      
      <div className="flex items-center justify-between">
        <span className="text-white/80">Frame Rate</span>
        <select 
          className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
          onChange={(e) => addLog(`Frame rate changed: ${e.target.value}`)}
        >
          <option value="30">30 FPS</option>
          <option value="60">60 FPS</option>
        </select>
      </div>
    </div>
  </div>
);

console.log(`🎬 Rendering with state: camera=${cameraState}, recording=${recordingState}`);

// Preview screen
if (showPreview && recordedVideo) {
  return (
  <div className="fixed inset-0 bg-black flex flex-col">
      {/* Top controls */}
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

      {/* Video container with proper mobile handling */}
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

      {/* Bottom overlay controls */}
      <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/50 to-transparent z-20">
      <div className="flex items-center justify-center space-x-8">
          <ControlButton 
            icon={Download} 
            onClick={downloadVideo} 
            label="Download"
            size="lg"
          />
          <ControlButton 
            icon={Share} 
            onClick={shareVideo} 
            label="Share"
            size="lg"
          />
        </div>
      </div>
    </div>
  );
}

return (
  <div className="fixed inset-0 bg-black flex flex-col">
    {/* Camera viewport */}
    <div className="flex-1 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900"></div>
      
      {/* Camera feed */}
      <div 
        ref={cameraFeedRef}
        className={`absolute inset-0 transition-transform duration-300 ${isFlipped ? 'scale-x-[-1]' : ''}`}
      >
        {/* Fallback content while camera loads */}
        <div className="w-full h-full bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-blue-500/20 flex items-center justify-center">
          <div className="text-white/50 text-center">
            <Camera className="w-16 h-16 mx-auto mb-4" />
            <p>Camera Feed {cameraState === 'ready' ? '(Live)' : '(Loading...)'}</p>
            <p className="text-sm mt-2">State: {cameraState}</p>
          </div>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && <SettingsPanel />}

      {/* Top controls */}
      <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/50 to-transparent z-10">
        <div className="flex justify-between items-center">
          <ControlButton 
            icon={Settings} 
            onClick={toggleSettings} 
            label="Settings"
          />
          <div className="text-white text-center">
            <img 
              src="images/attribution.png" 
              alt="Attribution" 
              className="h-4 mx-auto"
            />
            {selectedFilter !== 'none' && (
              <div className="text-xs text-white/60">

              </div>
            )}
          </div>
          <ControlButton 
            icon={FlipHorizontal} 
            onClick={toggleFlip} 
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

      {/* Loading state */}
      {cameraState === 'initializing' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-30">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-white text-lg font-medium">Initializing Camera Kit...</div>
            <div className="text-white/60 text-sm mt-2">Please wait</div>
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
            <div className="text-white/60 text-sm">Check debug logs for details</div>
          </div>
        </div>
      )}
    </div>
  </div>
);
};

console.log('✅ Component defined, exporting default');

export default CameraKitApp;