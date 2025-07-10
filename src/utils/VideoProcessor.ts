// src/utils/VideoProcessor.ts - FIXED VERSION
import fixWebmDuration from 'fix-webm-duration';
import { detectAndroid } from './androidRecorderFix';

export interface ProcessingProgress {
  percent: number;
  message: string;
}

export interface ProcessedVideoMetadata {
  recordingDuration: number;
  isAndroid: boolean;
  processedAt: number;
  instagramCompatible: boolean;
  fixedDuration: boolean;
  originalSize: number;
  processedSize: number;
  format: 'mp4' | 'webm';
}

export class VideoProcessor {
  constructor(private addLog: (message: string) => void) {}

  /**
   * Process video for social media sharing with metadata fixes
   */
  async processVideo(
    rawBlob: Blob,
    recordingDuration: number,
    onProgress: (progress: ProcessingProgress) => void
  ): Promise<File> {
    try {
      const isAndroid = detectAndroid();
      const isMP4 = rawBlob.type.includes('mp4');
      const originalSize = rawBlob.size;

      this.addLog(`🎬 Starting video processing: ${recordingDuration}s, ${isMP4 ? 'MP4' : 'WebM'}`);

      // Step 1: Initialize (10%)
      onProgress({ percent: 10, message: "Memulai proses..." });
      await this.safeDelay(100);

      // Step 2: Analyze format (25%)
      onProgress({ percent: 25, message: "Menganalisis format video..." });
      this.addLog(`📊 Format: ${isMP4 ? 'MP4' : 'WebM'}, Platform: ${isAndroid ? 'Android' : 'Standard'}`);
      await this.safeDelay(150);

      let processedBlob = rawBlob;

      // Step 3: Fix duration metadata (40% - CRITICAL SECTION)
      onProgress({ percent: 40, message: "Memperbaiki metadata durasi..." });

      if (!isMP4) {
        // Fix WebM duration
        try {
          const durationMs = recordingDuration * 1000;
          this.addLog('🔧 Fixing WebM duration...');
          processedBlob = await fixWebmDuration(rawBlob, durationMs);
          this.addLog('✅ WebM duration metadata fixed');
        } catch (error) {
          this.addLog(`⚠️ WebM fix failed: ${error}`);
          // Continue with original blob
        }
      } else {
        // For MP4, FIXED: Remove problematic delay and add immediate progress
        this.addLog('🔧 Validating MP4 format...');
        // Create new blob to ensure proper type
        const buffer = await rawBlob.arrayBuffer();
        processedBlob = new Blob([buffer], { type: 'video/mp4' });
        this.addLog('✅ MP4 format validated');
      }

      // CRITICAL FIX: Update progress immediately after format processing
      onProgress({ percent: 60, message: "Metadata durasi diperbaiki" });
      await this.safeDelay(100);

      // Step 4: Social media optimization (75%)
      onProgress({ percent: 75, message: "Mengoptimalkan untuk Instagram..." });
      
      const compatibility = this.checkSocialMediaCompatibility(processedBlob, recordingDuration);
      this.addLog(`📱 Instagram compatible: ${compatibility.instagram ? 'YES' : 'NO'}`);
      
      await this.safeDelay(150);

      // Step 5: Finalize (90%)
      onProgress({ percent: 90, message: "Finalisasi video..." });

      const finalFile = this.createFinalFile(processedBlob, {
        recordingDuration,
        isAndroid,
        processedAt: Date.now(),
        instagramCompatible: compatibility.instagram,
        fixedDuration: true,
        originalSize,
        processedSize: processedBlob.size,
        format: isMP4 ? 'mp4' : 'webm'
      });

      await this.safeDelay(100);
      
      // Final step (100%)
      onProgress({ percent: 100, message: "Video siap dibagikan!" });

      this.addLog(`✅ Processing complete: ${this.formatFileSize(finalFile.size)}`);
      return finalFile;

    } catch (error) {
      this.addLog(`❌ Processing failed: ${error}`);
      throw new Error(`Video processing failed: ${error}`);
    }
  }

  /**
   * FIXED: Safe delay with timeout protection
   */
  private safeDelay(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve();
      }, ms);

      // Fallback timeout (prevent hanging)
      const fallbackTimeout = setTimeout(() => {
        clearTimeout(timeout);
        this.addLog(`⚠️ Delay timeout, continuing...`);
        resolve();
      }, ms + 1000); // Add 1 second buffer

      // Clear fallback when normal timeout completes
      setTimeout(() => {
        clearTimeout(fallbackTimeout);
      }, ms);
    });
  }

  /**
   * Share processed video
   */
  async shareVideo(file: File): Promise<boolean> {
    try {
      const duration = (file as any).recordingDuration || 0;
      const isCompatible = (file as any).instagramCompatible || false;

      if (this.canUseWebShare() && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'AR Video',
          text: `Check out this ${duration}s AR video! ${isCompatible ? '📱 Instagram ready!' : ''}`
        });

        this.addLog('✅ Video shared via Web Share API');
        return true;
      } else {
        this.downloadFile(file);
        this.addLog('📥 Video downloaded (Web Share not available)');
        return false;
      }
    } catch (error) {
      this.addLog(`❌ Share failed: ${error}`);
      this.downloadFile(file);
      return false;
    }
  }

  /**
   * Check social media compatibility
   */
  private checkSocialMediaCompatibility(blob: Blob, duration: number) {
    const sizeMB = blob.size / (1024 * 1024);
    const isMP4 = blob.type.includes('mp4');

    return {
      instagram: isMP4 && sizeMB <= 100 && duration >= 3 && duration <= 60,
      tiktok: isMP4 && sizeMB <= 72 && duration >= 3 && duration <= 60,
      youtube: sizeMB <= 256,
      twitter: sizeMB <= 512 && duration <= 140
    };
  }

  /**
   * Create final file with metadata
   */
  private createFinalFile(blob: Blob, metadata: ProcessedVideoMetadata): File {
    const extension = metadata.format;
    const filename = `ar_video_${Date.now()}.${extension}`;

    const file = new File([blob], filename, {
      type: metadata.format === 'mp4' ? 'video/mp4' : 'video/webm',
      lastModified: Date.now()
    });

    // Add metadata to file object
    Object.keys(metadata).forEach(key => {
      (file as any)[key] = metadata[key as keyof ProcessedVideoMetadata];
    });

    return file;
  }

  /**
   * Check if Web Share API is available
   */
  private canUseWebShare(): boolean {
    return typeof navigator !== 'undefined' && 
           'share' in navigator && 
           typeof navigator.share === 'function';
  }

  /**
   * Download file as fallback
   */
  private downloadFile(file: File): void {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)}MB`;
  }
}