// src/hooks/useMediaRecorder.ts - iPhone MP4 priority fix
import { useState, useRef, useCallback, useEffect } from 'react';
import { detectAndroid, detectiOS } from '../utils/androidRecorderFix';

export type RecordingState = 'idle' | 'recording' | 'processing';

/**
 * Enhanced MediaRecorder with iPhone MP4 priority
 */
class EnhancedMediaRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startTime: number = 0;

  constructor(
    private stream: MediaStream,
    private onComplete: (file: File) => void,
    private addLog: (msg: string) => void
  ) {}

  async start(): Promise<void> {
    const options = this.getRecorderOptions();
    
    this.recorder = new MediaRecorder(this.stream, options);
    this.chunks = [];
    this.startTime = Date.now();
    
    this.recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
    
    this.recorder.onstop = async () => {
      await this.processRecording();
    };
    
    this.recorder.onerror = (event) => {
      this.addLog(`❌ Recording error: ${event}`);
    };
    
    // Smaller time slice for better duration accuracy
    this.recorder.start(100);
    
    this.addLog(`🎬 Enhanced recording started: ${options.mimeType || 'default'}`);
  }

  stop(): void {
    if (this.recorder && this.recorder.state === 'recording') {
      this.recorder.stop();
    }
  }

  private getRecorderOptions() {
    // FIXED: MP4 priority for ALL platforms (Android + iPhone)
    const isAndroid = detectAndroid();
    const isiOS = detectiOS();
    
    const formats = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // H.264 + AAC - Instagram optimal
      'video/mp4;codecs=h264,aac',
      'video/mp4',
      'video/webm;codecs=vp9,opus', // Fallback only
      'video/webm'
    ];

    for (const mimeType of formats) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        this.addLog(`📱 Platform: ${isAndroid ? 'Android' : isiOS ? 'iPhone' : 'Desktop'}, Format: ${mimeType}`);
        return {
          mimeType,
          videoBitsPerSecond: 2500000, // High quality for Instagram
          audioBitsPerSecond: 128000
        };
      }
    }

    this.addLog('⚠️ No supported formats found, using default');
    return { videoBitsPerSecond: 2500000 };
  }

  private async processRecording(): Promise<void> {
    const endTime = Date.now();
    const actualDurationMs = endTime - this.startTime;
    const actualDurationSeconds = Math.max(1, Math.floor(actualDurationMs / 1000));
    
    this.addLog(`📊 Processing: ${this.chunks.length} chunks, ${actualDurationSeconds}s`);
    
    const mimeType = this.recorder?.mimeType || 'video/mp4';
    let blob = new Blob(this.chunks, { type: mimeType });
    
    // Apply binary MP4 duration fix for Instagram compatibility
    if (mimeType.includes('mp4')) {
      blob = await this.fixMP4Duration(blob, actualDurationSeconds);
    }
    
    const filename = `video_${Date.now()}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
    const file = new File([blob], filename, {
      type: blob.type,
      lastModified: Date.now()
    });
    
    // Enhanced metadata
    (file as any).recordingDuration = actualDurationSeconds;
    (file as any).actualDurationMs = actualDurationMs;
    (file as any).fixedMetadata = mimeType.includes('mp4');
    (file as any).instagramCompatible = mimeType.includes('mp4') && actualDurationSeconds >= 3;
    (file as any).isAndroidRecording = detectAndroid();
    (file as any).isiOSRecording = detectiOS(); // NEW: iPhone detection
    (file as any).processingMethod = mimeType.includes('mp4') ? 'binary-mp4-fix' : 'original';
    (file as any).platformOptimized = true; // NEW: All platforms get MP4
    
    this.addLog(`✅ Enhanced recording complete: ${actualDurationSeconds}s, ${this.formatSize(file.size)}`);
    this.onComplete(file);
  }

  /**
   * Binary MP4 duration fix - works for Android + iPhone
   */
  private async fixMP4Duration(blob: Blob, durationSeconds: number): Promise<Blob> {
    try {
      const buffer = await blob.arrayBuffer();
      const view = new DataView(buffer);
      const uint8Array = new Uint8Array(buffer);
      
      this.addLog(`🔧 Applying binary MP4 duration fix: ${durationSeconds}s`);
      
      const mvhdFixed = this.fixMVHDDuration(view, uint8Array, durationSeconds);
      const tkhdFixed = this.fixTKHDDurations(view, uint8Array, durationSeconds);
      const mdhdFixed = this.fixMDHDDurations(view, uint8Array, durationSeconds);
      
      if (mvhdFixed || tkhdFixed || mdhdFixed) {
        this.addLog(`✅ MP4 duration headers fixed for Instagram compatibility`);
        return new Blob([uint8Array], { type: 'video/mp4' });
      } else {
        this.addLog(`⚠️ No MP4 headers found to fix`);
        return blob;
      }
      
    } catch (error) {
      this.addLog(`❌ MP4 fix failed: ${error}`);
      return blob;
    }
  }

  private fixMVHDDuration(view: DataView, data: Uint8Array, durationSeconds: number): boolean {
    const mvhdOffset = this.findBoxOffset(data, 'mvhd');
    if (mvhdOffset === -1) return false;

    try {
      const version = view.getUint8(mvhdOffset + 8);
      const timescaleOffset = mvhdOffset + (version === 1 ? 28 : 20);
      const durationOffset = timescaleOffset + 4;
      
      const timescale = view.getUint32(timescaleOffset);
      const newDuration = durationSeconds * timescale;
      
      if (version === 1) {
        view.setBigUint64(durationOffset, BigInt(newDuration));
      } else {
        view.setUint32(durationOffset, newDuration);
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  private fixTKHDDurations(view: DataView, data: Uint8Array, durationSeconds: number): boolean {
    let fixed = false;
    let offset = 0;
    
    while (true) {
      const tkhdOffset = this.findBoxOffset(data, 'tkhd', offset);
      if (tkhdOffset === -1) break;
      
      try {
        const version = view.getUint8(tkhdOffset + 8);
        const durationOffset = tkhdOffset + (version === 1 ? 36 : 28);
        
        const movieTimescale = 1000;
        const newDuration = durationSeconds * movieTimescale;
        
        if (version === 1) {
          view.setBigUint64(durationOffset, BigInt(newDuration));
        } else {
          view.setUint32(durationOffset, newDuration);
        }
        
        fixed = true;
        offset = tkhdOffset + 1;
      } catch (error) {
        break;
      }
    }
    
    return fixed;
  }

  private fixMDHDDurations(view: DataView, data: Uint8Array, durationSeconds: number): boolean {
    let fixed = false;
    let offset = 0;
    
    while (true) {
      const mdhdOffset = this.findBoxOffset(data, 'mdhd', offset);
      if (mdhdOffset === -1) break;
      
      try {
        const version = view.getUint8(mdhdOffset + 8);
        const timescaleOffset = mdhdOffset + (version === 1 ? 28 : 20);
        const durationOffset = timescaleOffset + 4;
        
        const timescale = view.getUint32(timescaleOffset);
        const newDuration = durationSeconds * timescale;
        
        if (version === 1) {
          view.setBigUint64(durationOffset, BigInt(newDuration));
        } else {
          view.setUint32(durationOffset, newDuration);
        }
        
        fixed = true;
        offset = mdhdOffset + 1;
      } catch (error) {
        break;
      }
    }
    
    return fixed;
  }

  private findBoxOffset(data: Uint8Array, fourCC: string, startOffset: number = 0): number {
    const target = new TextEncoder().encode(fourCC);
    
    for (let i = startOffset; i < data.length - 8; i++) {
      if (i % 4 === 0) {
        const boxSize = new DataView(data.buffer).getUint32(i);
        
        if (boxSize >= 8 && boxSize < data.length && i + boxSize <= data.length) {
          if (data[i + 4] === target[0] && 
              data[i + 5] === target[1] && 
              data[i + 6] === target[2] && 
              data[i + 7] === target[3]) {
            return i;
          }
        }
      }
    }
    
    return -1;
  }

  private formatSize(bytes: number): string {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  getState(): string {
    return this.recorder?.state || 'inactive';
  }
}

export const useMediaRecorder = (addLog: (message: string) => void) => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [recordedVideo, setRecordedVideo] = useState<Blob | File | null>(null);

  const enhancedRecorderRef = useRef<EnhancedMediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  const startRecording = useCallback((canvas: HTMLCanvasElement, audioStream?: MediaStream) => {
    if (!canvas || !canvas.width || !canvas.height) {
      addLog('❌ Canvas not available for recording');
      return false;
    }

    try {
      let canvasStream: MediaStream;
      
      try {
        canvasStream = canvas.captureStream(30);
        addLog(`✅ Canvas stream: ${canvas.width}x${canvas.height}@30fps`);
      } catch (streamError) {
        canvasStream = canvas.captureStream();
        addLog(`⚠️ Using default canvas capture: ${streamError}`);
      }
      
      // Add audio if available
      if (audioStream && audioStream.getAudioTracks().length > 0) {
        const audioTrack = audioStream.getAudioTracks()[0];
        
        if (audioTrack.readyState === 'live') {
          canvasStream.addTrack(audioTrack);
          addLog(`✅ Audio track added: ${audioTrack.label || 'Default'}`);
        }
      }

      const videoTracks = canvasStream.getVideoTracks();
      const audioTracks = canvasStream.getAudioTracks();
      
      addLog(`📊 Stream: ${videoTracks.length} video, ${audioTracks.length} audio tracks`);
      
      if (videoTracks.length === 0) {
        throw new Error('No video tracks in canvas stream');
      }

      recordingStartTimeRef.current = performance.now();

      enhancedRecorderRef.current = new EnhancedMediaRecorder(
        canvasStream,
        (file: File) => {
          const endTime = performance.now();
          const actualDurationMs = endTime - recordingStartTimeRef.current;
          const actualDurationSeconds = Math.floor(actualDurationMs / 1000);
          
          // Platform-specific metadata
          (file as any).recordingStartTime = recordingStartTimeRef.current;
          (file as any).recordingEndTime = endTime;
          (file as any).canvasWidth = canvas.width;
          (file as any).canvasHeight = canvas.height;
          (file as any).hasAudioTrack = audioTracks.length > 0;
          
          const platform = detectAndroid() ? 'Android' : detectiOS() ? 'iPhone' : 'Desktop';
          addLog(`✅ ${platform} recording complete: ${actualDurationSeconds}s with MP4 fix`);
          
          setRecordedVideo(file);
          setRecordingState('idle');
        },
        addLog
      );

      enhancedRecorderRef.current.start();
      setRecordingState('recording');
      
      const platform = detectAndroid() ? 'Android' : detectiOS() ? 'iPhone' : 'Desktop';
      addLog(`🎬 ${platform} MP4 recording started with duration fix`);
      return true;

    } catch (error) {
      addLog(`❌ Recording start failed: ${error}`);
      setRecordingState('idle');
      return false;
    }
  }, [addLog]);

  const stopRecording = useCallback(() => {
    if (enhancedRecorderRef.current && recordingState === 'recording') {
      const recorder = enhancedRecorderRef.current;
      const recorderState = recorder.getState();
      
      if (recorderState === 'recording') {
        recorder.stop();
        setRecordingState('processing');
        addLog('⏹️ Recording stopped, applying MP4 duration fix...');
      } else {
        addLog(`⚠️ Recorder not in recording state: ${recorderState}`);
        setRecordingState('idle');
      }
    }
  }, [recordingState, addLog]);

  const toggleRecording = useCallback((canvas: HTMLCanvasElement, audioStream?: MediaStream) => {
    if (recordingState === 'recording') {
      if (recordingTime >= 3) {
        stopRecording();
      } else {
        addLog(`⚠️ Recording too short (${recordingTime}s) - minimum 3 seconds for Instagram`);
      }
    } else if (recordingState === 'idle') {
      if (!canvas) {
        addLog('❌ Canvas required for recording');
        return;
      }
      
      if (canvas.width < 640 || canvas.height < 480) {
        addLog(`⚠️ Canvas resolution low: ${canvas.width}x${canvas.height}`);
      }
      
      const success = startRecording(canvas, audioStream);
      if (!success) {
        addLog('❌ Failed to start enhanced recording');
      }
    }
  }, [recordingState, recordingTime, startRecording, stopRecording, addLog]);

  const clearRecording = useCallback(() => {
    setRecordedVideo(null);
    setRecordingTime(0);
    setRecordingState('idle');
    recordingStartTimeRef.current = 0;
    addLog('🗑️ Recording cleared');
  }, [addLog]);

  const cleanup = useCallback(() => {
    if (enhancedRecorderRef.current) {
      const recorderState = enhancedRecorderRef.current.getState();
      if (recorderState === 'recording') {
        enhancedRecorderRef.current.stop();
      }
      enhancedRecorderRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    addLog('🧹 Enhanced MediaRecorder cleanup complete');
  }, [addLog]);

  // Recording timer
  useEffect(() => {
    if (recordingState === 'recording') {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          
          if (newTime % 5 === 0 && enhancedRecorderRef.current) {
            const state = enhancedRecorderRef.current.getState();
            addLog(`📊 Recording: ${newTime}s, state: ${state}`);
          }
          
          return newTime;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (recordingState === 'idle') {
        setRecordingTime(0);
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [recordingState, addLog]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    recordingState,
    recordingTime,
    recordedVideo,
    startRecording,
    stopRecording,
    toggleRecording,
    clearRecording,
    cleanup,
    formatTime,
    isRecording: recordingState === 'recording',
    isProcessing: recordingState === 'processing',
    isIdle: recordingState === 'idle'
  };
};