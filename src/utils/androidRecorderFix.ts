// src/utils/androidRecorderFix.ts - Updated with enhanced metadata handling
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
 * Get optimized recorder options based on platform
 */
export const getOptimizedRecorderOptions = () => {
  const isAndroid = detectAndroid();
  
  const formats = isAndroid ? [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // H.264 + AAC for Instagram
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm'
  ] : [
    'video/webm;codecs=vp9,opus',
    'video/webm',
    'video/mp4;codecs=h264,aac',
    'video/mp4'
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
  originalMimeType: string;
  processedFormat: 'mp4' | 'webm';
  fixedMetadata: boolean;
  instagramCompatible: boolean;
  chunkCount: number;
  recordingStartTime: number;
  recordingEndTime: number;
  processingMethod: 'binary-mp4-fix' | 'webm-fix' | 'none';
}

/**
 * Legacy FixedMediaRecorder - kept for compatibility
 * NOTE: Use EnhancedMediaRecorder from useMediaRecorder.ts instead
 */
export class FixedMediaRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startTime: number = 0;
  private endTime: number = 0;
  private isAndroid: boolean;

  constructor(
    private stream: MediaStream,
    private onComplete: (file: File) => void,
    private addLog: (msg: string) => void
  ) {
    this.isAndroid = detectAndroid();
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
      
      const timeSlice = this.isAndroid ? 100 : 1000;
      this.recorder.start(timeSlice);
      
      this.addLog(`🎬 Recording started (${options.mimeType || 'default format'})`);
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

      // Basic metadata (EnhancedMediaRecorder has better implementation)
      const metadata: VideoMetadata = {
        recordingDuration: durationSeconds,
        actualDurationMs,
        isAndroidRecording: this.isAndroid,
        originalMimeType: recorderMimeType,
        processedFormat: isMP4 ? 'mp4' : 'webm',
        fixedMetadata: false,
        instagramCompatible: false,
        chunkCount: this.chunks.length,
        recordingStartTime: this.startTime,
        recordingEndTime: this.endTime,
        processingMethod: 'none'
      };

      Object.keys(metadata).forEach(key => {
        (finalFile as any)[key] = metadata[key as keyof VideoMetadata];
      });

      this.addLog(`✅ Basic file: ${durationSeconds}s, ${this.formatFileSize(finalFile.size)}, ${finalFile.type}`);
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
 * Share video with metadata
 */
export const shareVideoWithMetadata = async (
  file: File, 
  addLog: (msg: string) => void
): Promise<boolean> => {
  try {
    const duration = (file as any).recordingDuration || 0;
    const hasMetadata = (file as any).fixedMetadata || false;
    const processingMethod = (file as any).processingMethod || 'none';
    
    addLog(`📱 Sharing: ${duration}s, metadata: ${hasMetadata ? 'Fixed' : 'Original'}, method: ${processingMethod}`);
    
    if (duration < 3) {
      addLog('⚠️ Video too short for Instagram (min 3s)');
      alert('Video too short! Instagram requires minimum 3 seconds.');
      return false;
    }

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'My AR Video',
        text: `Check out this ${duration}s AR effect! 🎬 ${hasMetadata ? '(Optimized)' : ''}`
      });
      addLog('✅ Native sharing successful');
      return true;
    } else {
      addLog('📥 Using download method - share API not available');
      downloadWithInstructions(file, addLog);
      return true;
    }

  } catch (error) {
    addLog(`❌ Sharing failed: ${error}`);
    return false;
  }
};

/**
 * Download with user instructions
 */
const downloadWithInstructions = (file: File, addLog: (msg: string) => void) => {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  const duration = (file as any).recordingDuration || 0;
  const processingMethod = (file as any).processingMethod || 'none';
  addLog(`💾 Downloaded ${duration}s video (${processingMethod}) for sharing`);
  
  showAndroidShareInstructions(file);
};

/**
 * Show sharing instructions for Android
 */
export const showAndroidShareInstructions = (file: File) => {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-6';
  
  const duration = (file as any).recordingDuration || 0;
  const isMP4 = file.type.includes('mp4');
  const hasMetadata = (file as any).fixedMetadata || false;
  const processingMethod = (file as any).processingMethod || 'none';
  
  overlay.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-sm mx-auto text-center">
      <div class="text-2xl mb-3">📱</div>
      <h3 class="text-lg font-bold mb-4">Video Ready! (${duration}s)</h3>
      <div class="text-sm text-gray-600 mb-4">
        ${isMP4 ? 
          '<p class="text-green-600 font-medium mb-2">✅ MP4 Format - Instagram Optimized</p>' : 
          '<p class="text-yellow-600 mb-2">⚠️ WebM Format - May need conversion</p>'
        }
        ${hasMetadata ? 
          `<p class="text-blue-600 text-xs mb-2">✅ Duration metadata fixed (${processingMethod})</p>` : 
          '<p class="text-orange-600 text-xs mb-2">⚠️ Original metadata</p>'
        }
        <p class="text-xs">Video downloaded to your device</p>
      </div>
      <div class="text-xs text-left text-gray-700 mb-4 bg-gray-50 p-3 rounded">
        <p class="font-medium mb-2">Share to Instagram:</p>
        <ol class="space-y-1">
          <li>1. Open device gallery/files</li>
          <li>2. Find downloaded video</li>
          <li>3. Tap Share button</li>
          <li>4. Select Instagram Stories or Reels</li>
          <li>5. Add effects and share! 🎉</li>
        </ol>
        <p class="text-xs text-gray-500 mt-2">Duration: ${duration}s (${processingMethod} processed)</p>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" 
              class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium transition-colors">
        Got it!
      </button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  setTimeout(() => {
    if (document.body.contains(overlay)) {
      overlay.remove();
    }
  }, 15000);
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
export const EnhancedMediaRecorder = FixedMediaRecorder; // Legacy alias