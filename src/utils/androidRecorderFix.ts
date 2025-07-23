// src/utils/androidRecorderFix.ts - Enhanced Instagram sharing
import fixWebmDuration from 'fix-webm-duration';

/**
 * Platform detection
 */
export const detectAndroid = (): boolean => {
  return /Android/i.test(navigator.userAgent);
};

export const detectiOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

/**
 * MP4 priority for ALL platforms (Android + iPhone + Desktop)
 */
export const getOptimizedRecorderOptions = () => {
  const formats = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // H.264 + AAC - Instagram optimal
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=vp9,opus', // Fallback only
    'video/webm'
  ];

  for (const mimeType of formats) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return {
        mimeType,
        videoBitsPerSecond: 2500000, // High quality
        audioBitsPerSecond: 128000,
      };
    }
  }

  return {
    videoBitsPerSecond: 2500000,
    audioBitsPerSecond: 128000,
  };
};

/**
 * Enhanced video metadata interface
 */
export interface VideoMetadata {
  recordingDuration: number;
  actualDurationMs: number;
  isAndroidRecording: boolean;
  isiOSRecording: boolean;
  originalMimeType: string;
  processedFormat: 'mp4' | 'webm';
  fixedMetadata: boolean;
  instagramCompatible: boolean;
  chunkCount: number;
  recordingStartTime: number;
  recordingEndTime: number;
  processingMethod: 'binary-mp4-fix' | 'webm-fix' | 'none';
  platformOptimized: boolean;
}

/**
 * Legacy FixedMediaRecorder - kept for compatibility
 */
export class FixedMediaRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startTime: number = 0;
  private endTime: number = 0;
  private isAndroid: boolean;
  private isiOS: boolean;

  constructor(
    private stream: MediaStream,
    private onComplete: (file: File) => void,
    private addLog: (msg: string) => void
  ) {
    this.isAndroid = detectAndroid();
    this.isiOS = detectiOS();
  }

  start(): void {
    const options = getOptimizedRecorderOptions();
    
    try {
      this.recorder = new MediaRecorder(this.stream, options);
      this.chunks = [];
      this.startTime = performance.now();
      
      this.recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };
      
      this.recorder.onstop = () => {
        this.endTime = performance.now();
        this.processRecording();
      };
      
      this.recorder.onerror = (event) => {
        this.addLog(`❌ Recording error: ${event}`);
      };
      
      const timeSlice = 100; // Consistent for all platforms
      this.recorder.start(timeSlice);
      
      const platform = this.isAndroid ? 'Android' : this.isiOS ? 'iPhone' : 'Desktop';
      this.addLog(`🎬 ${platform} recording started (${options.mimeType || 'default format'})`);
    } catch (error) {
      this.addLog(`❌ MediaRecorder creation failed: ${error}`);
      throw error;
    }
  }

  stop(): void {
    if (this.recorder && this.recorder.state === 'recording') {
      this.recorder.stop();
      this.addLog('⏹️ Recording stopped');
    }
  }

  private async processRecording(): Promise<void> {
    try {
      const actualDurationMs = this.endTime - this.startTime;
      const durationSeconds = Math.floor(actualDurationMs / 1000);
      
      if (this.chunks.length === 0) {
        throw new Error('No recorded data available');
      }

      this.addLog(`📊 Processing ${this.chunks.length} chunks, duration: ${durationSeconds}s`);

      const recorderMimeType = this.recorder?.mimeType || '';
      const isMP4 = recorderMimeType.includes('mp4');
      
      let blob = new Blob(this.chunks, { 
        type: isMP4 ? 'video/mp4' : 'video/webm'
      });

      const timestamp = Date.now();
      const extension = isMP4 ? 'mp4' : 'webm';
      const filename = `video_${timestamp}.${extension}`;
      
      const finalFile = new File([blob], filename, {
        type: blob.type,
        lastModified: timestamp
      });

      // Enhanced metadata with platform detection
      const metadata: VideoMetadata = {
        recordingDuration: durationSeconds,
        actualDurationMs,
        isAndroidRecording: this.isAndroid,
        isiOSRecording: this.isiOS,
        originalMimeType: recorderMimeType,
        processedFormat: isMP4 ? 'mp4' : 'webm',
        fixedMetadata: false,
        instagramCompatible: isMP4 && durationSeconds >= 3,
        chunkCount: this.chunks.length,
        recordingStartTime: this.startTime,
        recordingEndTime: this.endTime,
        processingMethod: 'none',
        platformOptimized: isMP4
      };

      Object.keys(metadata).forEach(key => {
        (finalFile as any)[key] = metadata[key as keyof VideoMetadata];
      });

      const platform = this.isAndroid ? 'Android' : this.isiOS ? 'iPhone' : 'Desktop';
      this.addLog(`✅ ${platform} file: ${durationSeconds}s, ${this.formatFileSize(finalFile.size)}, ${finalFile.type}`);
      this.onComplete(finalFile);

    } catch (error) {
      this.addLog(`❌ Processing failed: ${error}`);
      throw error;
    }
  }

  private formatFileSize(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)}MB`;
  }

  getState(): string {
    return this.recorder?.state || 'inactive';
  }
}

/**
 * Enhanced Instagram sharing with multiple methods
 */
export const shareVideoWithMetadata = async (
  file: File, 
  addLog: (msg: string) => void
): Promise<boolean> => {
  try {
    const duration = (file as any).recordingDuration || 0;
    const platform = (file as any).isAndroidRecording ? 'Android' : (file as any).isiOSRecording ? 'iPhone' : 'Desktop';
    
    addLog(`🚀 ${platform} enhanced Instagram sharing: ${duration}s`);
    
    if (duration < 3) {
      addLog('⚠️ Video too short for Instagram (min 3s)');
      return false;
    }

    // Method 1: Try native share
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'AR Video',
          text: `Check out this ${duration}s AR effect! 🎬`
        });
        addLog(`✅ Native share completed`);
        return true;
      } catch (shareError) {
        addLog(`⚠️ Native share cancelled, trying alternatives...`);
      }
    }

    // Method 2: Try Instagram deep links
    const instagramSchemes = ['instagram://camera', 'instagram://share', 'instagram://'];
    for (const scheme of instagramSchemes) {
      try {
        window.open(scheme, '_system');
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (e) {
        // Continue to next
      }
    }

    // Method 3: Always download with smart guide
    downloadWithSmartInstructions(file, addLog);
    return true;

  } catch (error) {
    addLog(`❌ Sharing failed: ${error}`);
    downloadWithSmartInstructions(file, addLog);
    return false;
  }
};

/**
 * Download with smart Instagram instructions
 */
const downloadWithSmartInstructions = (file: File, addLog: (msg: string) => void) => {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  const duration = (file as any).recordingDuration || 0;
  const platform = (file as any).isAndroidRecording ? 'Android' : (file as any).isiOSRecording ? 'iPhone' : 'Desktop';
  
  addLog(`💾 ${platform} downloaded ${duration}s video for Instagram`);
  showQuickInstagramGuide(file);
};

/**
 * Quick Instagram sharing guide (minimal steps)
 */
export const showQuickInstagramGuide = (file: File) => {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4';
  
  const duration = (file as any).recordingDuration || 0;
  const isMP4 = file.type.includes('mp4');
  const platform = (file as any).isAndroidRecording ? 'Android' : (file as any).isiOSRecording ? 'iPhone' : 'Desktop';
  
  overlay.innerHTML = `
    <div class="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-6 max-w-sm mx-auto text-center text-white shadow-2xl">
      <div class="text-4xl mb-4">📱✨</div>
      <h3 class="text-xl font-bold mb-4">Ready for Instagram!</h3>
      
      <div class="bg-white/20 rounded-xl p-4 mb-4">
        <p class="text-sm font-medium mb-2">${platform} • ${duration}s ${isMP4 ? 'MP4' : 'WebM'}</p>
        <div class="text-xs space-y-1 text-left">
          <p><strong>Quick Share:</strong></p>
          <p>1. Open Instagram app</p>
          <p>2. Tap <strong>+</strong> → <strong>Reels</strong></p>
          <p>3. Select your video</p>
          <p>4. Share! 🚀</p>
        </div>
      </div>
      
      <button onclick="this.parentElement.parentElement.remove()" 
              class="bg-white text-purple-600 px-6 py-2 rounded-full font-bold hover:bg-gray-100 transition-colors">
        Got it!
      </button>
      
      <p class="text-xs text-white/70 mt-3">Video saved to gallery</p>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Auto close after 10 seconds
  setTimeout(() => {
    if (document.body.contains(overlay)) {
      overlay.remove();
    }
  }, 10000);
};

/**
 * Check social media compatibility
 */
export const checkSocialMediaCompatibility = (file: File): {
  instagram: boolean;
  tiktok: boolean;
  youtube: boolean;
  twitter: boolean;
} => {
  const isMP4 = file.type.includes('mp4');
  const size = file.size;
  const duration = (file as any).recordingDuration || 0;
  
  return {
    instagram: isMP4 && size < 100 * 1024 * 1024 && duration >= 3 && duration <= 60,
    tiktok: isMP4 && size < 72 * 1024 * 1024 && duration >= 3 && duration <= 60,
    youtube: isMP4 && size < 256 * 1024 * 1024,
    twitter: isMP4 && size < 512 * 1024 * 1024 && duration <= 140
  };
};

// Aliases for backward compatibility
export const shareVideoAndroid = shareVideoWithMetadata;
export const showAndroidShareInstructions = showQuickInstagramGuide;
export const EnhancedMediaRecorder = FixedMediaRecorder;