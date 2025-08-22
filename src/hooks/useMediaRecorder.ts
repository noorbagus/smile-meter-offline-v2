// src/hooks/useMediaRecorder.ts - MAX QUALITY recording untuk portrait 1440x2560
import { useState, useRef, useCallback, useEffect } from 'react';
import { detectAndroid, detectiOS } from '../utils/androidRecorderFix';

export type RecordingState = 'idle' | 'recording' | 'processing';

/**
 * Enhanced MediaRecorder dengan MAX QUALITY support
 */
class MaxQualityMediaRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startTime: number = 0;

  constructor(
    private stream: MediaStream,
    private onComplete: (file: File) => void,
    private addLog: (msg: string) => void
  ) {}

  async start(): Promise<void> {
    const options = this.getMaxQualityRecorderOptions();
    
    // Verify stream untuk max quality recording
    const videoTracks = this.stream.getVideoTracks();
    const audioTracks = this.stream.getAudioTracks();
    
    this.addLog(`📊 MAX quality recording stream: ${videoTracks.length} video, ${audioTracks.length} audio tracks`);
    
    if (audioTracks.length === 0) {
      this.addLog(`🔇 WARNING: No audio tracks - recording will be SILENT!`);
    } else {
      audioTracks.forEach((track, index) => {
        this.addLog(`🎤 Audio track ${index}: ${track.label || 'Microphone'}, state: ${track.readyState}, enabled: ${track.enabled}`);
      });
    }
    
    this.recorder = new MediaRecorder(this.stream, options);
    this.chunks = [];
    this.startTime = Date.now();
    
    this.recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
    
    this.recorder.onstop = async () => {
      await this.processMaxQualityRecording();
    };
    
    this.recorder.onerror = (event) => {
      this.addLog(`❌ Recording error: ${event}`);
    };
    
    // Small time slice for better audio sync
    this.recorder.start(100);
    
    const platform = detectAndroid() ? 'Android' : detectiOS() ? 'iPhone' : 'Desktop';
    this.addLog(`🎬 ${platform} MAX quality recording started: ${options.mimeType || 'default'} with ${audioTracks.length} audio tracks`);
  }

  stop(): void {
    if (this.recorder && this.recorder.state === 'recording') {
      this.recorder.stop();
    }
  }

  private getMaxQualityRecorderOptions() {
    const isAndroid = detectAndroid();
    const isiOS = detectiOS();
    
    const formats = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // H.264 + AAC - best for Instagram
      'video/mp4;codecs=h264,aac',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm'
    ];

    for (const mimeType of formats) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        // MAX QUALITY bitrates untuk 1440x2560
        const isMaxQuality = mimeType.includes('mp4');
        const videoBitrate = isMaxQuality ? 15000000 : 8000000; // 15Mbps vs 8Mbps
        const audioBitrate = 256000; // High quality audio
        
        this.addLog(`📱 Platform: ${isAndroid ? 'Android' : isiOS ? 'iPhone' : 'Desktop'}, Format: ${mimeType}`);
        this.addLog(`🚀 MAX quality bitrates: ${videoBitrate/1000000}Mbps video, ${audioBitrate/1000}kbps audio`);
        
        return {
          mimeType,
          videoBitsPerSecond: videoBitrate,
          audioBitsPerSecond: audioBitrate
        };
      }
    }

    this.addLog('⚠️ No supported formats found, using default with MAX audio');
    return { 
      videoBitsPerSecond: 15000000, // Default to max
      audioBitsPerSecond: 256000
    };
  }

  private async processMaxQualityRecording(): Promise<void> {
    const endTime = Date.now();
    const actualDurationMs = endTime - this.startTime;
    const actualDurationSeconds = Math.max(1, Math.floor(actualDurationMs / 1000));
    
    this.addLog(`📊 Processing MAX quality: ${this.chunks.length} chunks, ${actualDurationSeconds}s`);
    
    const mimeType = this.recorder?.mimeType || 'video/mp4';
    let blob = new Blob(this.chunks, { type: mimeType });
    
    // Apply binary MP4 duration fix untuk Instagram compatibility
    if (mimeType.includes('mp4')) {
      blob = await this.fixMP4Duration(blob, actualDurationSeconds);
    }
    
    const filename = `max_quality_video_${Date.now()}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
    const file = new File([blob], filename, {
      type: blob.type,
      lastModified: Date.now()
    });
    
    // Enhanced metadata dengan max quality info
    (file as any).recordingDuration = actualDurationSeconds;
    (file as any).actualDurationMs = actualDurationMs;
    (file as any).fixedMetadata = mimeType.includes('mp4');
    (file as any).instagramCompatible = mimeType.includes('mp4') && actualDurationSeconds >= 3;
    (file as any).isAndroidRecording = detectAndroid();
    (file as any).isiOSRecording = detectiOS();
    (file as any).processingMethod = mimeType.includes('mp4') ? 'binary-mp4-fix' : 'original';
    (file as any).platformOptimized = true;
    (file as any).hasAudioTrack = this.stream.getAudioTracks().length > 0;
    (file as any).isMaxQuality = true;
    (file as any).expectedResolution = '1440x2560'; // Portrait dari rotated landscape
    (file as any).qualityProfile = 'MAX_PORTRAIT';
    
    const platform = detectAndroid() ? 'Android' : detectiOS() ? 'iPhone' : 'Desktop';
    this.addLog(`✅ ${platform} MAX quality complete: ${actualDurationSeconds}s, ${this.formatSize(file.size)}, audio: ${(file as any).hasAudioTrack}`);
    this.onComplete(file);
  }

  /**
   * Binary MP4 duration fix untuk Instagram compatibility
   */
  private async fixMP4Duration(blob: Blob, durationSeconds: number): Promise<Blob> {
    try {
      const buffer = await blob.arrayBuffer();
      const view = new DataView(buffer);
      const uint8Array = new Uint8Array(buffer);
      
      this.addLog(`🔧 Applying MP4 duration fix: ${durationSeconds}s`);
      
      const mvhdFixed = this.fixMVHDDuration(view, uint8Array, durationSeconds);
      const tkhdFixed = this.fixTKHDDurations(view, uint8Array, durationSeconds);
      const mdhdFixed = this.fixMDHDDurations(view, uint8Array, durationSeconds);
      
      if (mvhdFixed || tkhdFixed || mdhdFixed) {
        this.addLog(`✅ MP4 duration headers fixed for MAX quality`);
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

  const maxQualityRecorderRef = useRef<MaxQualityMediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  const startRecording = useCallback((canvas: HTMLCanvasElement, audioStream?: MediaStream) => {
    if (!canvas || !canvas.width || !canvas.height) {
      addLog('❌ Canvas not available for recording');
      return false;
    }

    try {
      // Get canvas stream (video only)
      let canvasStream: MediaStream;
      
      try {
        canvasStream = canvas.captureStream(30);
        addLog(`✅ MAX quality canvas stream: ${canvas.width}x${canvas.height}@30fps`);
      } catch (streamError) {
        canvasStream = canvas.captureStream();
        addLog(`⚠️ Using default canvas capture: ${streamError}`);
      }
      
      // CRITICAL FIX: Add audio tracks to canvas stream
      if (audioStream && audioStream.getAudioTracks().length > 0) {
        const audioTrack = audioStream.getAudioTracks()[0];
        
        if (audioTrack.readyState === 'live' && audioTrack.enabled) {
          // Clone the audio track to avoid conflicts
          const clonedAudioTrack = audioTrack.clone();
          canvasStream.addTrack(clonedAudioTrack);
          addLog(`✅ MAX quality audio track added: ${audioTrack.label || 'Microphone'}`);
          
          // Apply audio constraints for better quality
          if (clonedAudioTrack.applyConstraints) {
            clonedAudioTrack.applyConstraints({
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 48000,
              channelCount: 2
            }).catch(e => addLog(`⚠️ Audio constraints failed: ${e}`));
          }
        } else {
          addLog(`❌ Audio track not usable: readyState=${audioTrack.readyState}, enabled=${audioTrack.enabled}`);
        }
      } else {
        addLog(`🔇 WARNING: No audio stream provided - MAX quality recording will be SILENT!`);
      }

      // Final verification of combined stream
      const finalVideoTracks = canvasStream.getVideoTracks();
      const finalAudioTracks = canvasStream.getAudioTracks();
      
      addLog(`📊 Final MAX quality recording stream: ${finalVideoTracks.length} video, ${finalAudioTracks.length} audio tracks`);
      
      if (finalAudioTracks.length === 0) {
        addLog(`🔇 FINAL WARNING: MAX quality recording will be SILENT - no audio tracks in final stream!`);
      }

      if (finalVideoTracks.length === 0) {
        throw new Error('No video tracks in canvas stream');
      }

      recordingStartTimeRef.current = performance.now();

      maxQualityRecorderRef.current = new MaxQualityMediaRecorder(
        canvasStream,
        (file: File) => {
          const endTime = performance.now();
          const actualDurationMs = endTime - recordingStartTimeRef.current;
          const actualDurationSeconds = Math.floor(actualDurationMs / 1000);
          
          // Enhanced metadata with MAX quality info
          (file as any).recordingStartTime = recordingStartTimeRef.current;
          (file as any).recordingEndTime = endTime;
          (file as any).canvasWidth = canvas.width;
          (file as any).canvasHeight = canvas.height;
          (file as any).hasAudioTrack = finalAudioTracks.length > 0;
          (file as any).audioTrackCount = finalAudioTracks.length;
          (file as any).isMaxQualityRecording = true;
          (file as any).canvasResolution = `${canvas.width}x${canvas.height}`;
          
          const platform = detectAndroid() ? 'Android' : detectiOS() ? 'iPhone' : 'Desktop';
          const qualityIndicator = canvas.width >= 1440 ? 'MAX QUALITY' : 'SCALED';
          addLog(`✅ ${platform} ${qualityIndicator} recording complete: ${actualDurationSeconds}s with ${finalAudioTracks.length > 0 ? 'AUDIO' : 'NO AUDIO'}`);
          
          setRecordedVideo(file);
          setRecordingState('idle');
        },
        addLog
      );

      maxQualityRecorderRef.current.start();
      setRecordingState('recording');
      
      const platform = detectAndroid() ? 'Android' : detectiOS() ? 'iPhone' : 'Desktop';
      const qualityMode = canvas.width >= 1440 ? 'MAX QUALITY' : 'SCALED';
      addLog(`🎬 ${platform} ${qualityMode} recording started - Audio tracks: ${finalAudioTracks.length}`);
      return true;

    } catch (error) {
      addLog(`❌ MAX quality recording start failed: ${error}`);
      setRecordingState('idle');
      return false;
    }
  }, [addLog]);

  const stopRecording = useCallback(() => {
    if (maxQualityRecorderRef.current && recordingState === 'recording') {
      const recorder = maxQualityRecorderRef.current;
      const recorderState = recorder.getState();
      
      if (recorderState === 'recording') {
        recorder.stop();
        setRecordingState('processing');
        addLog('⏹️ MAX quality recording stopped, processing...');
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
        addLog(`⚠️ Recording too short (${recordingTime}s) - minimum 3 seconds required`);
      }
    } else if (recordingState === 'idle') {
      if (!canvas) {
        addLog('❌ Canvas required for MAX quality recording');
        return;
      }
      
      if (canvas.width < 1080 || canvas.height < 1920) {
        addLog(`⚠️ Canvas resolution: ${canvas.width}x${canvas.height} (expected ≥1080x1920)`);
      } else {
        const qualityMode = canvas.width >= 1440 ? 'MAX QUALITY' : 'SCALED';
        addLog(`📐 Canvas ready for ${qualityMode}: ${canvas.width}x${canvas.height}`);
      }
      
      // Debug audio stream before recording
      if (audioStream) {
        const audioTracks = audioStream.getAudioTracks();
        addLog(`🎤 Audio stream has ${audioTracks.length} tracks`);
        audioTracks.forEach((track, i) => {
          addLog(`   Track ${i}: ${track.label || 'Unknown'}, state: ${track.readyState}, enabled: ${track.enabled}`);
        });
      } else {
        addLog('🔇 No audio stream provided to MAX quality recording!');
      }
      
      const success = startRecording(canvas, audioStream);
      if (!success) {
        addLog('❌ Failed to start MAX quality recording');
      }
    }
  }, [recordingState, recordingTime, startRecording, stopRecording, addLog]);

  const clearRecording = useCallback(() => {
    setRecordedVideo(null);
    setRecordingTime(0);
    setRecordingState('idle');
    recordingStartTimeRef.current = 0;
    addLog('🗑️ MAX quality recording cleared');
  }, [addLog]);

  const cleanup = useCallback(() => {
    if (maxQualityRecorderRef.current) {
      const recorderState = maxQualityRecorderRef.current.getState();
      if (recorderState === 'recording') {
        maxQualityRecorderRef.current.stop();
      }
      maxQualityRecorderRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    addLog('🧹 MAX quality MediaRecorder cleanup complete');
  }, [addLog]);

  // Recording timer
  useEffect(() => {
    if (recordingState === 'recording') {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          
          if (newTime % 5 === 0 && maxQualityRecorderRef.current) {
            const state = maxQualityRecorderRef.current.getState();
            addLog(`📊 MAX quality recording: ${newTime}s, state: ${state}`);
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