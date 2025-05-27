// src/utils/androidRecorderFix.ts
export const detectAndroid = (): boolean => {
    return /Android/i.test(navigator.userAgent);
  };
  
  export const getOptimizedRecorderOptions = () => {
    const isAndroid = detectAndroid();
    
    if (isAndroid) {
      return {
        mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // H.264 + AAC
        videoBitsPerSecond: 2000000,
        audioBitsPerSecond: 128000,
      };
    }
    
    return {
      mimeType: 'video/mp4;codecs=h264,aac',
      videoBitsPerSecond: 2500000,
      audioBitsPerSecond: 128000,
    };
  };
  
  // Enhanced MediaRecorder with Android fixes
  export class EnhancedMediaRecorder {
    private recorder: MediaRecorder | null = null;
    private chunks: Blob[] = [];
    private startTime: number = 0;
    private recordingTimer: number | null = null;
    
    constructor(
      private stream: MediaStream,
      private onComplete: (file: File) => void,
      private addLog: (msg: string) => void
    ) {}
  
    start(): void {
      const options = getOptimizedRecorderOptions();
      this.recorder = new MediaRecorder(this.stream, options);
      this.chunks = [];
      this.startTime = Date.now();
      
      this.recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
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
      const timeSlice = detectAndroid() ? 33 : 1000;
      this.recorder.start(timeSlice);
      
      this.addLog(`🎬 Enhanced recording started (${detectAndroid() ? 'Android' : 'Standard'} mode)`);
    }
    
    stop(): void {
      if (this.recorder && this.recorder.state === 'recording') {
        // Clear any existing timer
        if (this.recordingTimer) {
          clearTimeout(this.recordingTimer);
        }
        
        // Android: Add delay before stopping to ensure proper file closure
        if (detectAndroid()) {
          this.recordingTimer = setTimeout(() => {
            this.recorder?.stop();
          }, 300);
        } else {
          this.recorder.stop();
        }
      }
    }
    
    private async processRecording(): Promise<void> {
      const duration = Date.now() - this.startTime;
      const actualDurationSeconds = Math.floor(duration / 1000);
      
      // Create blob with proper mime type
      const blob = new Blob(this.chunks, { 
        type: detectAndroid() ? 'video/mp4' : 'video/mp4' 
      });
      
      const file = new File([blob], `lens-video-${Date.now()}.mp4`, {
        type: 'video/mp4',
        lastModified: Date.now()
      });
      
      // Add metadata properties (simple approach)
      (file as any).recordingDuration = actualDurationSeconds;
      (file as any).isAndroidRecording = detectAndroid();
      
      this.addLog(`✅ Recording processed: ${actualDurationSeconds}s`);
      this.onComplete(file);
    }
    
    private async fixAndroidMetadata(blob: Blob, duration: number): Promise<Blob> {
      return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        
        video.onloadedmetadata = () => {
          // Re-record with proper timing
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          const stream = canvas.captureStream(30); // Fixed 30fps
          const recorder = new MediaRecorder(stream, {
            mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'
          });
          
          const chunks: Blob[] = [];
          recorder.ondataavailable = e => chunks.push(e.data);
          recorder.onstop = () => {
            resolve(new Blob(chunks, { type: 'video/mp4' }));
          };
          
          recorder.start();
          video.play();
          
          setTimeout(() => {
            recorder.stop();
            video.pause();
          }, duration * 1000);
        };
        
        video.src = URL.createObjectURL(blob);
      });
    }
    
    private formatFileSize(bytes: number): string {
      const mb = bytes / (1024 * 1024);
      return `${mb.toFixed(1)}MB`;
    }
  }