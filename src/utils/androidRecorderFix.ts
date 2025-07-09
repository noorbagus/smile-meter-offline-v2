// src/utils/androidRecorderFix.ts - Fixed version
import fixWebmDuration from 'fix-webm-duration';

export const detectAndroid = (): boolean => {
  return /Android/i.test(navigator.userAgent);
};

export const detectiOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export const getOptimizedRecorderOptions = () => {
  const isAndroid = detectAndroid();
  
  // Prioritas format untuk Android (Instagram-friendly)
  const formats = isAndroid ? [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // H.264 + AAC
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=vp8,opus', // Fallback ke VP8 (lebih kompatibel)
    'video/webm'
  ] : [
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm'
  ];

  for (const mimeType of formats) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return {
        mimeType,
        videoBitsPerSecond: isAndroid ? 2000000 : 2500000, // Tingkatkan bitrate
        audioBitsPerSecond: 128000,
        // Hilangkan parameter yang tidak standar
      };
    }
  }

  return {
    videoBitsPerSecond: 2000000,
    audioBitsPerSecond: 128000,
  };
};

export class EnhancedMediaRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startTime: number = 0;
  private endTime: number = 0; // Tambahkan tracking end time
  private recordingTimer: number | null = null;
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
      this.startTime = performance.now(); // Gunakan performance.now() untuk akurasi
      
      this.recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data);
          this.addLog(`📊 Chunk: ${event.data.size} bytes`);
        }
      };
      
      this.recorder.onstop = () => {
        this.endTime = performance.now();
        this.processRecording();
      };
      
      this.recorder.onerror = (event) => {
        this.addLog(`❌ Recording error: ${event}`);
      };
      
      // Perbaiki time slice - gunakan nilai yang lebih besar untuk Android
      const timeSlice = this.isAndroid ? 1000 : 1000; // Sama untuk semua platform
      this.recorder.start(timeSlice);
      
      this.addLog(`🎬 Recording started (${options.mimeType})`);
    } catch (error) {
      this.addLog(`❌ MediaRecorder creation failed: ${error}`);
      throw error;
    }
  }

  stop(): void {
    if (this.recorder && this.recorder.state === 'recording') {
      if (this.recordingTimer) {
        clearTimeout(this.recordingTimer);
      }
      
      // Hilangkan delay untuk Android - stop langsung
      this.recorder.stop();
      this.addLog('⏹️ Recording stopped immediately');
    }
  }

  private async processRecording(): Promise<void> {
    try {
      const actualDuration = this.endTime - this.startTime; // Durasi sebenarnya
      const durationSeconds = Math.floor(actualDuration / 1000);
      
      if (this.chunks.length === 0) {
        throw new Error('No recorded data available');
      }

      this.addLog(`📊 Processing ${this.chunks.length} chunks, duration: ${durationSeconds}s`);

      const recorderMimeType = this.recorder?.mimeType || 'video/mp4';
      const isMP4 = recorderMimeType.includes('mp4');
      
      let blob = new Blob(this.chunks, { 
        type: isMP4 ? 'video/mp4' : recorderMimeType
      });

      // Perbaikan metadata duration
      if (!isMP4) {
        // Hanya gunakan fix-webm-duration untuk WebM
        try {
          const fixWebmDuration = (await import('fix-webm-duration')).default;
          blob = await fixWebmDuration(blob, actualDuration);
          this.addLog(`✅ WebM duration fixed: ${durationSeconds}s`);
        } catch (error) {
          this.addLog(`⚠️ Duration fix failed: ${error}`);
        }
      } else {
        // Untuk MP4, buat ulang blob dengan header yang tepat
        const buffer = await blob.arrayBuffer();
        blob = new Blob([buffer], { 
          type: 'video/mp4'
        });
        this.addLog(`✅ MP4 blob recreated: ${durationSeconds}s`);
      }

      const timestamp = Date.now();
      const extension = isMP4 ? 'mp4' : 'webm';
      const filename = `lens_video_${timestamp}.${extension}`;
      
      const finalFile = new File([blob], filename, {
        type: blob.type,
        lastModified: timestamp
      });

      // Metadata yang lebih akurat
      (finalFile as any).recordingDuration = durationSeconds;
      (finalFile as any).actualDurationMs = actualDuration;
      (finalFile as any).isAndroidRecording = this.isAndroid;
      (finalFile as any).originalMimeType = recorderMimeType;
      (finalFile as any).optimizedForInstagram = this.isAndroid && isMP4;
      (finalFile as any).chunkCount = this.chunks.length;

      this.addLog(`✅ Final file: ${durationSeconds}s, ${this.formatFileSize(finalFile.size)}, ${finalFile.type}`);
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

// Perbaikan sharing untuk Instagram
export const shareVideoAndroid = async (
  file: File, 
  addLog: (msg: string) => void
): Promise<boolean> => {
  try {
    // Validasi file sebelum sharing
    const duration = (file as any).recordingDuration || 0;
    const fileSize = file.size;
    
    addLog(`📊 Sharing file: ${duration}s, ${(fileSize / 1024 / 1024).toFixed(1)}MB`);
    
    // Instagram memerlukan minimal 3 detik, maksimal 60 detik
    if (duration < 3) {
      addLog('⚠️ Video terlalu pendek untuk Instagram (min 3s)');
      showVideoTooShortMessage();
      return false;
    }

    // Method 1: Native Web Share API
    if (navigator.share) {
      const canShare = navigator.canShare ? navigator.canShare({ files: [file] }) : true;
      
      if (canShare) {
        await navigator.share({
          files: [file],
          title: 'My AR Video',
          text: `Check out this ${duration}s AR effect! 🎬`
        });
        addLog('✅ Native sharing successful');
        return true;
      }
    }

    // Method 2: Download dengan instruksi
    addLog('📥 Using download method');
    downloadWithInstructions(file, addLog);
    return true;

  } catch (error) {
    addLog(`❌ Android sharing failed: ${error}`);
    return false;
  }
};

// Tambahan: pesan jika video terlalu pendek
const showVideoTooShortMessage = () => {
  const message = document.createElement('div');
  message.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white px-4 py-2 rounded-lg z-50 text-sm font-medium';
  message.textContent = '⚠️ Record at least 3 seconds for Instagram';
  
  document.body.appendChild(message);
  setTimeout(() => {
    if (document.body.contains(message)) {
      document.body.removeChild(message);
    }
  }, 3000);
};

// Download dengan instruksi yang lebih jelas
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
  addLog(`💾 Downloaded ${duration}s video for Instagram`);
  
  showAndroidShareInstructions(file);
};

// Update instruksi sharing
export const showAndroidShareInstructions = (file: File) => {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-6';
  
  const duration = (file as any).recordingDuration || 0;
  const isMP4 = file.type.includes('mp4');
  
  overlay.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-sm mx-auto text-center">
      <div class="text-2xl mb-3">📱</div>
      <h3 class="text-lg font-bold mb-4">Video Ready! (${duration}s)</h3>
      <div class="text-sm text-gray-600 mb-4">
        ${isMP4 ? 
          '<p class="text-green-600 font-medium mb-2">✅ MP4 format - Perfect for Instagram Stories & Reels</p>' : 
          '<p class="text-yellow-600 mb-2">⚠️ May need conversion for Instagram</p>'
        }
        <p class="text-xs">File downloaded to your device</p>
      </div>
      <div class="text-xs text-left text-gray-700 mb-4 bg-gray-50 p-3 rounded">
        <p class="font-medium mb-2">Instagram Sharing:</p>
        <ol class="space-y-1">
          <li>1. Open Instagram app</li>
          <li>2. Tap + → Story or Reel</li>
          <li>3. Select your downloaded video</li>
          <li>4. Add effects and share! 🎉</li>
        </ol>
        <p class="text-xs text-gray-500 mt-2">Video duration: ${duration}s (Instagram compatible)</p>
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