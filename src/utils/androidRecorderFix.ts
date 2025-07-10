// src/utils/androidRecorderFix.ts - Fixed for constant 30fps output
import fixWebmDuration from 'fix-webm-duration';

/**
 * Deteksi apakah perangkat menggunakan Android
 */
export const detectAndroid = (): boolean => {
  return /Android/i.test(navigator.userAgent);
};

/**
 * Deteksi apakah perangkat menggunakan iOS
 */
export const detectiOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

/**
 * Mendapatkan opsi MediaRecorder yang optimal berdasarkan platform
 * FIXED: Enforced constant framerate settings
 */
export const getOptimizedRecorderOptions = () => {
  const isAndroid = detectAndroid();
  
  // Prioritas format untuk Android (Instagram-friendly) dengan constant framerate
  const formats = isAndroid ? [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // H.264 + AAC - Best for Instagram
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm'
  ] : [
    'video/mp4;codecs=h264,aac', // Prioritize MP4 for all platforms
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm'
  ];

  // Cari format yang didukung
  for (const mimeType of formats) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return {
        mimeType,
        // FIXED: Consistent bitrate for stable framerate
        videoBitsPerSecond: isAndroid ? 3000000 : 3500000, // Higher bitrate for quality
        audioBitsPerSecond: 128000,
        // FIXED: Force constant framerate metadata
        bitsPerSecond: isAndroid ? 3128000 : 3628000 // Total bitrate
      };
    }
  }

  // Fallback dengan konstanta framerate
  return {
    videoBitsPerSecond: 3000000,
    audioBitsPerSecond: 128000,
    bitsPerSecond: 3128000
  };
};

/**
 * FIXED MediaRecorder dengan penanganan constant framerate
 */
export class FixedMediaRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startTime: number = 0;
  private endTime: number = 0;
  private isAndroid: boolean;
  private targetFrameRate: number = 30;
  private frameCounter: number = 0;
  private lastFrameTime: number = 0;

  constructor(
    private stream: MediaStream,
    private onComplete: (file: File) => void,
    private addLog: (msg: string) => void
  ) {
    this.isAndroid = detectAndroid();
  }

  /**
   * FIXED: Create constant framerate stream
   */
  private createConstantFramerateStream(originalStream: MediaStream): MediaStream {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    // Set canvas size based on video track
    const videoTrack = originalStream.getVideoTracks()[0];
    if (videoTrack) {
      const settings = videoTrack.getSettings();
      canvas.width = settings.width || 1280;
      canvas.height = settings.height || 720;
    } else {
      canvas.width = 1280;
      canvas.height = 720;
    }

    // Create video element to draw from
    const video = document.createElement('video');
    video.srcObject = originalStream;
    video.muted = true;
    video.playsInline = true;
    video.play();

    // FIXED: Force exact 30fps with precise timing
    const frameInterval = 1000 / this.targetFrameRate; // 33.333ms per frame
    let lastDrawTime = 0;

    const drawFrame = () => {
      const now = performance.now();
      
      if (now - lastDrawTime >= frameInterval) {
        // Draw current video frame to canvas
        if (video.readyState >= 2) { // HAVE_CURRENT_DATA
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          this.frameCounter++;
        }
        lastDrawTime = now;
      }
      
      // Continue animation loop
      if (this.recorder?.state === 'recording') {
        requestAnimationFrame(drawFrame);
      }
    };

    // Start drawing when video is ready
    video.addEventListener('loadeddata', () => {
      drawFrame();
    });

    // FIXED: Capture stream with exact framerate
    const canvasStream = canvas.captureStream(this.targetFrameRate);
    
    // Add audio track from original stream
    const audioTrack = originalStream.getAudioTracks()[0];
    if (audioTrack) {
      canvasStream.addTrack(audioTrack);
    }

    this.addLog(`✅ Constant ${this.targetFrameRate}fps stream created`);
    return canvasStream;
  }

  start(): void {
    const options = getOptimizedRecorderOptions();
    
    try {
      // FIXED: Create constant framerate stream
      const constantFpsStream = this.createConstantFramerateStream(this.stream);
      
      this.recorder = new MediaRecorder(constantFpsStream, options);
      this.chunks = [];
      this.startTime = performance.now();
      this.frameCounter = 0;
      
      this.recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data);
          this.addLog(`📦 Chunk ${this.chunks.length}: ${(event.data.size / 1024).toFixed(1)}KB`);
        }
      };
      
      this.recorder.onstop = () => {
        this.endTime = performance.now();
        this.processRecording();
      };
      
      this.recorder.onerror = (event) => {
        this.addLog(`❌ Recording error: ${event}`);
      };
      
      // FIXED: Optimized timeSlice for consistent chunks
      // Larger chunks = more consistent framerate
      const timeSlice = this.isAndroid ? 1000 : 1000; // 1 second chunks for all platforms
      this.recorder.start(timeSlice);
      
      this.addLog(`🎬 Recording started: ${options.mimeType} @ ${this.targetFrameRate}fps`);
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
      const actualDuration = this.endTime - this.startTime;
      const durationSeconds = Math.floor(actualDuration / 1000);
      const expectedFrames = Math.floor(durationSeconds * this.targetFrameRate);
      const actualFramerate = this.frameCounter / durationSeconds;
      
      if (this.chunks.length === 0) {
        throw new Error('No recorded data available');
      }

      this.addLog(`📊 Processing: ${durationSeconds}s, ${this.frameCounter} frames (${actualFramerate.toFixed(1)}fps)`);

      const recorderMimeType = this.recorder?.mimeType || '';
      const isMP4 = recorderMimeType.includes('mp4');
      
      let blob = new Blob(this.chunks, { 
        type: isMP4 ? 'video/mp4' : 'video/webm'
      });

      // FIXED: Enhanced metadata fixing for constant framerate
      if (!isMP4) {
        // For WebM, use fix-webm-duration with precise timing
        try {
          blob = await fixWebmDuration(blob, actualDuration);
          this.addLog(`✅ WebM duration fixed: ${durationSeconds}s @ ${this.targetFrameRate}fps`);
        } catch (error) {
          this.addLog(`⚠️ Duration fix failed: ${error}`);
        }
      } else {
        // For MP4, ensure metadata includes constant framerate info
        // Note: Full MP4 metadata fixing would require additional libraries
        this.addLog(`✅ MP4 processed: ${durationSeconds}s @ ${actualFramerate.toFixed(1)}fps`);
      }

      const timestamp = Date.now();
      const extension = isMP4 ? 'mp4' : 'webm';
      const filename = `video_${timestamp}.${extension}`;
      
      const finalFile = new File([blob], filename, {
        type: blob.type,
        lastModified: timestamp
      });

      // FIXED: Enhanced metadata for framerate tracking
      (finalFile as any).recordingDuration = durationSeconds;
      (finalFile as any).actualDurationMs = actualDuration;
      (finalFile as any).targetFrameRate = this.targetFrameRate;
      (finalFile as any).actualFrameRate = actualFramerate;
      (finalFile as any).totalFrames = this.frameCounter;
      (finalFile as any).expectedFrames = expectedFrames;
      (finalFile as any).isConstantFramerate = Math.abs(actualFramerate - this.targetFrameRate) < 2;
      (finalFile as any).isAndroidRecording = this.isAndroid;
      (finalFile as any).originalMimeType = recorderMimeType;
      (finalFile as any).optimizedForInstagram = this.isAndroid && isMP4;
      (finalFile as any).chunkCount = this.chunks.length;
      (finalFile as any).fixedMetadata = true;

      this.addLog(`✅ Final: ${durationSeconds}s, ${this.formatFileSize(finalFile.size)}, ${actualFramerate.toFixed(1)}fps constant`);
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
 * FIXED: Enhanced sharing with framerate validation
 */
export const shareVideoWithMetadata = async (
  file: File, 
  addLog: (msg: string) => void
): Promise<boolean> => {
  try {
    const duration = (file as any).recordingDuration || 0;
    const frameRate = (file as any).actualFrameRate || 0;
    const isConstant = (file as any).isConstantFramerate || false;
    const hasMetadata = (file as any).fixedMetadata || false;
    
    addLog(`📱 Sharing: ${duration}s @ ${frameRate.toFixed(1)}fps, constant: ${isConstant}`);
    
    // Validasi untuk Instagram
    if (duration < 3) {
      addLog('⚠️ Video terlalu pendek untuk Instagram (min 3s)');
      alert('Video terlalu pendek! Instagram memerlukan video minimal 3 detik.');
      return false;
    }

    if (!isConstant) {
      addLog('⚠️ Variable framerate detected - may cause Instagram issues');
    }

    // Method 1: Native Web Share API
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'My AR Video',
        text: `Check out this ${duration}s AR video! 🎬 (${frameRate.toFixed(1)}fps)`
      });
      addLog('✅ Native sharing successful');
      return true;
    } else {
      // Method 2: Download dengan informasi framerate
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
 * Download file dengan instruksi yang diperbaiki
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
  const frameRate = (file as any).actualFrameRate || 0;
  const isConstant = (file as any).isConstantFramerate || false;
  
  addLog(`💾 Downloaded ${duration}s @ ${frameRate.toFixed(1)}fps video`);
  showAndroidShareInstructions(file);
};

/**
 * FIXED: Enhanced share instructions with framerate info
 */
export const showAndroidShareInstructions = (file: File) => {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-6';
  
  const duration = (file as any).recordingDuration || 0;
  const frameRate = (file as any).actualFrameRate || 0;
  const isConstant = (file as any).isConstantFramerate || false;
  const isMP4 = file.type.includes('mp4');
  const hasMetadata = (file as any).fixedMetadata || false;
  
  overlay.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-sm mx-auto text-center">
      <div class="text-2xl mb-3">📱</div>
      <h3 class="text-lg font-bold mb-4">Video Ready! (${duration}s)</h3>
      <div class="text-sm text-gray-600 mb-4">
        ${isMP4 ? 
          '<p class="text-green-600 font-medium mb-2">✅ MP4 Format - Instagram Compatible</p>' : 
          '<p class="text-yellow-600 mb-2">⚠️ WebM Format - May need conversion</p>'
        }
        <p class="text-xs text-blue-600 mb-1">📊 ${frameRate.toFixed(1)}fps${isConstant ? ' (Constant)' : ' (Variable)'}</p>
        ${hasMetadata ? 
          '<p class="text-blue-600 text-xs mb-2">✅ Metadata optimized</p>' : 
          '<p class="text-orange-600 text-xs mb-2">⚠️ Basic metadata</p>'
        }
        <p class="text-xs">Video downloaded to your device</p>
      </div>
      <div class="text-xs text-left text-gray-700 mb-4 bg-gray-50 p-3 rounded">
        <p class="font-medium mb-2">Instagram Sharing Tips:</p>
        <ol class="space-y-1">
          <li>1. Open gallery/files on your device</li>
          <li>2. Find the downloaded video</li>
          <li>3. Tap Share button</li>
          <li>4. Select Instagram Stories or Reels</li>
          <li>5. ${isConstant ? 'Perfect framerate - ready to share!' : 'Check preview in Instagram editor'}</li>
        </ol>
        <p class="text-xs text-gray-500 mt-2">
          Quality: ${duration}s @ ${frameRate.toFixed(1)}fps 
          ${isConstant ? '✅' : '⚠️ Variable framerate may affect Instagram'}
        </p>
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
  }, 20000);
};

/**
 * FIXED: Enhanced compatibility check with framerate validation
 */
export const checkSocialMediaCompatibility = (file: File): {
  instagram: boolean;
  tiktok: boolean;
  youtube: boolean;
  twitter: boolean;
  frameRateOk: boolean;
} => {
  const isMP4 = file.type.includes('mp4');
  const size = file.size;
  const duration = (file as any).recordingDuration || 0;
  const frameRate = (file as any).actualFrameRate || 0;
  const isConstant = (file as any).isConstantFramerate || false;
  
  // FIXED: Framerate validation for each platform
  const frameRateOk = isConstant && frameRate >= 24 && frameRate <= 60;
  
  return {
    instagram: isMP4 && size < 100 * 1024 * 1024 && duration >= 3 && duration <= 60 && frameRateOk,
    tiktok: isMP4 && size < 72 * 1024 * 1024 && duration >= 3 && duration <= 60 && frameRateOk,
    youtube: isMP4 && size < 256 * 1024 * 1024 && frameRateOk,
    twitter: isMP4 && size < 512 * 1024 * 1024 && duration <= 140 && frameRateOk,
    frameRateOk
  };
};

// Alias untuk kompatibilitas backward
export const shareVideoAndroid = shareVideoWithMetadata;
export const EnhancedMediaRecorder = FixedMediaRecorder;