// src/App.tsx
import React, { useState, useRef, useEffect } from 'react';
import { X, Share, Circle, Square } from 'lucide-react';
import { bootstrapCameraKit, Transform2D, createMediaStreamSource } from '@snap/camera-kit';
import { CAMERA_KIT_CONFIG, validateConfig } from './config/cameraKit';
import type { CameraState, RecordingState } from './types/camera';

const CameraLensApp: React.FC = () => {
  const [cameraState, setCameraState] = useState<CameraState>('initializing');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordedVideo, setRecordedVideo] = useState<Blob | null>(null);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraKitSessionRef = useRef<any>(null);

  useEffect(() => {
    initializeCameraKit();
    return () => cleanup();
  }, []);

  const initializeCameraKit = async (): Promise<void> => {
    try {
      console.log('📷 Starting camera initialization...');
      console.log('Config:', {
        apiToken: CAMERA_KIT_CONFIG.apiToken?.substring(0, 10) + '...',
        lensId: CAMERA_KIT_CONFIG.lensId,
        lensGroupId: CAMERA_KIT_CONFIG.lensGroupId
      });
      
      validateConfig();
      console.log('✅ Config validation passed');
      
      console.log('🔧 Bootstrapping Camera Kit...');
      const cameraKit = await bootstrapCameraKit({ 
        apiToken: CAMERA_KIT_CONFIG.apiToken 
      });
      console.log('✅ Camera Kit bootstrapped');

      console.log('🎯 Creating Camera Kit session...');
      const session = await cameraKit.createSession();
      cameraKitSessionRef.current = session;

      session.events.addEventListener("error", (event) => {
        console.error('❌ Camera Kit session error:', event.detail);
      });
      console.log('✅ Camera Kit session created');

      console.log('🎥 Requesting camera stream...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: CAMERA_KIT_CONFIG.camera.facingMode },
        audio: CAMERA_KIT_CONFIG.camera.audio
      });
      console.log('✅ Camera stream acquired');

      streamRef.current = stream;
      
      console.log('🔗 Setting camera source...');
      const source = cameraKit.createSource(stream);
      source.setTransform(Transform2D.MirrorX);
      await session.setSource(source);
      console.log('✅ Camera source set');

      console.log('🎨 Loading lens...');
      const { lenses } = await cameraKit.lensRepository.loadLensGroups([CAMERA_KIT_CONFIG.lensGroupId]);
      if (lenses.length > 0) {
        const targetLens = lenses.find(lens => lens.id === CAMERA_KIT_CONFIG.lensId) || lenses[0];
        await session.applyLens(targetLens);
        console.log('✅ Lens applied:', targetLens.name);
      }

      console.log('▶️ Starting playback...');
      session.play('live');
      
      // Replace canvas placeholder with Camera Kit output
      if (canvasRef.current) {
        canvasRef.current.replaceWith(session.output.live);
      }

      setCameraState('ready');
      console.log('🎉 Camera initialization complete');
    } catch (error) {
      console.error('❌ Camera initialization failed:', error);
      setCameraState('error');
    }
  };

  const startRecording = (): void => {
    if (!streamRef.current || cameraState !== 'ready') return;

    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: CAMERA_KIT_CONFIG.recording.mimeType
    });

    const chunks: Blob[] = [];
    
    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: CAMERA_KIT_CONFIG.recording.mimeType });
      setRecordedVideo(blob);
      setShowPreview(true);
      setRecordingState('idle');
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setRecordingState('recording');
  };

  const stopRecording = (): void => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
      setRecordingState('processing');
    }
  };

  const shareVideo = async (): Promise<void> => {
    if (!recordedVideo) return;

    try {
      const file = new File([recordedVideo], 'lens-video.webm', {
        type: recordedVideo.type
      });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My Lens Video',
          text: 'Check out this cool lens effect!'
        });
      } else {
        // Fallback download
        const url = URL.createObjectURL(recordedVideo);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lens-video.webm';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Sharing failed:', error);
    }
  };

  const closePreview = (): void => {
    setShowPreview(false);
    setRecordedVideo(null);
  };

  const cleanup = (): void => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (cameraKitSessionRef.current) {
      cameraKitSessionRef.current.pause();
    }
  };

  const RecordButton: React.FC = () => (
    <button
      onClick={recordingState === 'recording' ? stopRecording : startRecording}
      disabled={cameraState !== 'ready' || recordingState === 'processing'}
      className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
    >
      {recordingState === 'recording' ? (
        <Square className="w-8 h-8 text-white fill-white" />
      ) : (
        <Circle className="w-12 h-12 text-white fill-red-500" />
      )}
    </button>
  );

  const ShareButton: React.FC = () => (
    <button
      onClick={shareVideo}
      className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-blue-500 hover:bg-blue-600 transition-colors"
    >
      <Share className="w-8 h-8 text-white" />
    </button>
  );

  if (showPreview && recordedVideo) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        <button
          onClick={closePreview}
          className="absolute top-4 right-4 z-10 w-12 h-12 rounded-full bg-black/50 flex items-center justify-center"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        <div className="flex-1 flex items-center justify-center">
          <video
            src={URL.createObjectURL(recordedVideo)}
            controls
            autoPlay
            className="max-w-full max-h-full"
          />
        </div>

        <div className="flex justify-center pb-8">
          <ShareButton />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: cameraState === 'ready' ? 'block' : 'none' }}
        />
        
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ display: cameraState === 'ready' ? 'none' : 'block' }}
        />

        {cameraState === 'initializing' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white text-lg">Initializing camera...</div>
          </div>
        )}

        {cameraState === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-red-400 text-lg">Camera access denied</div>
          </div>
        )}

        {recordingState === 'recording' && (
          <div className="absolute top-4 left-4 flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-white text-sm font-medium">REC</span>
          </div>
        )}
      </div>

      <div className="flex justify-center pb-8">
        <RecordButton />
      </div>
    </div>
  );
};

export default CameraLensApp;