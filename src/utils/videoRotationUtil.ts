// src/utils/videoRotationUtil.ts - Rotasi camera stream sebelum Camera Kit

export class VideoRotationUtil {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private video: HTMLVideoElement;
    private rotatedStream: MediaStream | null = null;
    private animationId: number | null = null;
  
    constructor() {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d')!;
      this.video = document.createElement('video');
      this.video.autoplay = true;
      this.video.muted = true;
      this.video.playsInline = true;
    }
  
    /**
     * Rotasi MediaStream -90 derajat
     */
    async rotateStream(inputStream: MediaStream, rotation: number = -90): Promise<MediaStream> {
      return new Promise((resolve, reject) => {
        try {
          // Setup video element
          this.video.srcObject = inputStream;
          
          this.video.onloadedmetadata = () => {
            // Untuk rotasi -90°, tukar width/height
            if (Math.abs(rotation) === 90) {
              this.canvas.width = this.video.videoHeight;
              this.canvas.height = this.video.videoWidth;
            } else {
              this.canvas.width = this.video.videoWidth;
              this.canvas.height = this.video.videoHeight;
            }
  
            // Mulai render loop
            this.startRenderLoop(rotation);
  
            // Ambil stream dari canvas yang sudah dirotasi
            this.rotatedStream = this.canvas.captureStream(30);
  
            // Preserve audio tracks dari stream asli
            const audioTracks = inputStream.getAudioTracks();
            audioTracks.forEach(track => {
              this.rotatedStream!.addTrack(track.clone());
            });
  
            console.log(`✅ Stream rotated ${rotation}°: ${this.canvas.width}x${this.canvas.height}`);
            resolve(this.rotatedStream);
          };
  
          this.video.onerror = () => reject(new Error('Video load failed'));
        } catch (error) {
          reject(error);
        }
      });
    }
  
    private startRenderLoop(rotation: number): void {
      const render = () => {
        if (!this.video || this.video.readyState < 2) {
          this.animationId = requestAnimationFrame(render);
          return;
        }
  
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  
        // Apply rotation transform
        this.ctx.save();
        
        if (rotation === -90) {
          // Rotasi -90° (counterclockwise)
          this.ctx.translate(0, this.canvas.height);
          this.ctx.rotate(-Math.PI / 2);
          this.ctx.drawImage(this.video, 0, 0, this.video.videoWidth, this.video.videoHeight);
        } else if (rotation === 90) {
          // Rotasi 90° (clockwise)
          this.ctx.translate(this.canvas.width, 0);
          this.ctx.rotate(Math.PI / 2);
          this.ctx.drawImage(this.video, 0, 0, this.video.videoWidth, this.video.videoHeight);
        } else if (rotation === 180) {
          // Rotasi 180°
          this.ctx.translate(this.canvas.width, this.canvas.height);
          this.ctx.rotate(Math.PI);
          this.ctx.drawImage(this.video, 0, 0, this.video.videoWidth, this.video.videoHeight);
        } else {
          // No rotation
          this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        }
  
        this.ctx.restore();
        this.animationId = requestAnimationFrame(render);
      };
  
      render();
    }
  
    /**
     * Stop rotasi dan cleanup
     */
    stop(): void {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
  
      if (this.rotatedStream) {
        this.rotatedStream.getTracks().forEach(track => track.stop());
        this.rotatedStream = null;
      }
  
      if (this.video.srcObject) {
        const stream = this.video.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        this.video.srcObject = null;
      }
    }
  
    /**
     * Get canvas untuk debugging
     */
    getCanvas(): HTMLCanvasElement {
      return this.canvas;
    }
  }
  
  /**
   * Helper function untuk rotasi cepat
   */
  export const rotateMediaStream = async (
    inputStream: MediaStream, 
    rotation: number = -90
  ): Promise<MediaStream> => {
    const rotator = new VideoRotationUtil();
    return await rotator.rotateStream(inputStream, rotation);
  };
  
  /**
   * Deteksi apakah perlu rotasi berdasarkan device.
   */
  export const shouldRotateCamera = (): boolean => {
    // Deteksi device yang perlu rotasi
    const needsRotation = /brio|logitech|aver|gopro/i.test(navigator.userAgent) ||
                          window.location.search.includes('rotate=true');
    
    return needsRotation;
  };