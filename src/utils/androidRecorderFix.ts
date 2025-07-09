// src/utils/androidRecorderFix.ts - Complete Android video sharing solution
import fixWebmDuration from 'fix-webm-duration';

export const detectAndroid = (): boolean => {
  return /Android/i.test(navigator.userAgent);
};

export const detectiOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export const getOptimizedRecorderOptions = () => {
  const isAndroid = detectAndroid();
  
  // Test supported formats in order of preference
  const formats = isAndroid ? [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // H.264 + AAC for Android
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
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
        videoBitsPerSecond: isAndroid ? 1500000 : 2500000, // Lower for Android
        audioBitsPerSecond: 128000,
        audioBitrateMode: 'constant', // ADD THIS
        keyFrameInterval: 30 // ADD THIS
      };
    }
  }

  // Fallback
  return {
    videoBitsPerSecond: 2000000,
    audioBitsPerSecond: 128000,
  };
};

// Enhanced MediaRecorder with Android-specific fixes
export class EnhancedMediaRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startTime: number = 0;
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
      this.startTime = Date.now();
      
      this.recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };
      
      this.recorder.onstop = () => {
        this.processRecording();
      };
      
      this.recorder.onerror = (event) => {
        this.addLog(`❌ Recording error: ${event}`);
      };
      
      // Android: Use shorter time slices for better metadata
      const timeSlice = this.isAndroid ? 100 : 1000;
      this.recorder.start(timeSlice);
      
      this.addLog(`🎬 Recording started (${this.isAndroid ? 'Android MP4' : 'Standard'} mode)`);
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
      
      // Android: Add delay to ensure proper file closure
      if (this.isAndroid) {
        this.recordingTimer = setTimeout(() => {
          this.recorder?.stop();
        }, 200);
      } else {
        this.recorder.stop();
      }
    }
  }

  private async processRecording(): Promise<void> {
    try {
      const duration = Date.now() - this.startTime;
      const actualDurationSeconds = Math.floor(duration / 1000);
      
      if (this.chunks.length === 0) {
        throw new Error('No recorded data available');
      }
  
      const recorderMimeType = this.recorder?.mimeType || 'video/mp4';
      const isMP4 = recorderMimeType.includes('mp4');
      
      const blob = new Blob(this.chunks, { 
        type: isMP4 ? 'video/mp4' : recorderMimeType
      });
  
      // Fix duration metadata
      let fixedBlob: Blob;
      try {
        const fixWebmDuration = (await import('fix-webm-duration')).default;
        fixedBlob = await fixWebmDuration(blob, duration);
        this.addLog(`✅ Duration metadata fixed: ${actualDurationSeconds}s`);
      } catch (error) {
        this.addLog(`⚠️ Duration fix failed: ${error}`);
        fixedBlob = blob;
      }
  
      const timestamp = Date.now();
      const extension = isMP4 ? 'mp4' : 'webm';
      const filename = `lens_video_${timestamp}.${extension}`;
      
      const finalFile = new File([fixedBlob], filename, {
        type: fixedBlob.type,
        lastModified: timestamp
      });
  
      (finalFile as any).recordingDuration = actualDurationSeconds;
      (finalFile as any).isAndroidRecording = this.isAndroid;
      (finalFile as any).originalMimeType = recorderMimeType;
      (finalFile as any).optimizedForSharing = this.isAndroid && isMP4;
  
      this.addLog(`✅ Recording processed: ${actualDurationSeconds}s, ${this.formatFileSize(finalFile.size)}, ${finalFile.type}`);
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

// Enhanced sharing function for Android
export const shareVideoAndroid = async (
  file: File, 
  addLog: (msg: string) => void
): Promise<boolean> => {
  try {
    // Method 1: Native Web Share API
    if (navigator.share) {
      const canShare = navigator.canShare ? navigator.canShare({ files: [file] }) : true;
      
      if (canShare) {
        await navigator.share({
          files: [file],
          title: 'My AR Video',
          text: 'Check out this cool AR effect! 🎬'
        });
        addLog('✅ Native sharing successful');
        return true;
      }
    }

    // Method 2: Clipboard API (Android 13+)
    if (navigator.clipboard && 'write' in navigator.clipboard) {
      try {
        const clipboardItem = new ClipboardItem({
          [file.type]: file
        });
        await navigator.clipboard.write([clipboardItem]);
        addLog('✅ Video copied to clipboard - paste in your app');
        
        // Show success message
        showClipboardSuccessMessage();
        return true;
      } catch (clipboardError) {
        addLog(`⚠️ Clipboard failed: ${clipboardError}`);
      }
    }

    // Method 3: Download with instructions
    addLog('📥 Using download method with share instructions');
    return false;

  } catch (error) {
    addLog(`❌ Android sharing failed: ${error}`);
    return false;
  }
};

// Show clipboard success message
const showClipboardSuccessMessage = () => {
  const message = document.createElement('div');
  message.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg z-50 text-sm font-medium';
  message.textContent = '📋 Video copied! Paste in Instagram/TikTok';
  
  document.body.appendChild(message);
  
  const cleanup = () => {
    try {
      if (document.body.contains(message)) {
        message.style.opacity = '0';
        message.style.transition = 'opacity 0.3s';
        setTimeout(() => {
          try {
            if (document.body.contains(message)) {
              document.body.removeChild(message);
            }
          } catch (e) {
            // Element already removed
          }
        }, 300);
      }
    } catch (e) {
      // Element already removed
    }
  };
  
  setTimeout(cleanup, 3000);
};

// Show Android-specific sharing instructions
export const showAndroidShareInstructions = (file: File) => {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-6';
  
  const isMP4 = file.type.includes('mp4');
  const duration = (file as any).recordingDuration;
  
  overlay.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-sm mx-auto text-center">
      <div class="text-2xl mb-3">📱</div>
      <h3 class="text-lg font-bold mb-4">Video Ready for Sharing!</h3>
      <div class="text-sm text-gray-600 mb-4">
        <p class="mb-2">Your ${duration}s AR video is downloaded as ${isMP4 ? 'MP4' : 'WebM'} format.</p>
        ${isMP4 ? 
          '<p class="text-green-600 font-medium">✅ Optimized for Instagram/TikTok</p>' : 
          '<p class="text-yellow-600">⚠️ May need conversion for some apps</p>'
        }
      </div>
      <div class="text-xs text-left text-gray-700 mb-4 bg-gray-50 p-3 rounded">
        <p class="font-medium mb-2">To share:</p>
        <ol class="space-y-1">
          <li>1. Open Gallery/Photos app</li>
          <li>2. Find your downloaded video</li>
          <li>3. Tap Share → Choose your app</li>
          <li>4. Post your AR creation! 🎉</li>
        </ol>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" 
              class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium transition-colors">
        Got it!
      </button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  const cleanup = () => {
    try {
      if (document.body.contains(overlay)) {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s';
        setTimeout(() => {
          try {
            if (document.body.contains(overlay)) {
              document.body.removeChild(overlay);
            }
          } catch (e) {
            // Element already removed
          }
        }, 300);
      }
    } catch (e) {
      // Element already removed
    }
  };
  
  setTimeout(cleanup, 10000);
};

// Check if video format is compatible with major social platforms
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
    instagram: isMP4 && size < 100 * 1024 * 1024 && duration <= 60, // 100MB, 60s
    tiktok: isMP4 && size < 72 * 1024 * 1024 && duration <= 60,     // 72MB, 60s  
    youtube: isMP4 && size < 256 * 1024 * 1024,                     // 256MB
    twitter: isMP4 && size < 512 * 1024 * 1024 && duration <= 140   // 512MB, 140s
  };
};