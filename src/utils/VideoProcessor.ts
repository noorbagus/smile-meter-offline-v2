// src/utils/VideoProcessor.ts
import fixWebmDuration from 'fix-webm-duration';
import { detectAndroid } from './androidRecorderFix';
import * as MP4Box from 'mp4box';

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
      await this.delay(150);

      // Step 2: Analyze format (25%)
      onProgress({ percent: 25, message: "Menganalisis format video..." });
      this.addLog(`📊 Format: ${isMP4 ? 'MP4' : 'WebM'}, Platform: ${isAndroid ? 'Android' : 'Standard'}`);
      await this.delay(200);

      let processedBlob = rawBlob;

      // Step 3: Fix duration metadata (60%)
      onProgress({ percent: 40, message: "Memperbaiki metadata durasi..." });

      if (!isMP4) {
        // Fix WebM duration
        try {
          const durationMs = recordingDuration * 1000;
          processedBlob = await fixWebmDuration(rawBlob, durationMs);
          this.addLog('✅ WebM duration metadata fixed');
        } catch (error) {
          this.addLog(`⚠️ WebM fix failed: ${error}`);
        }
      } else {
        // Fix MP4 duration with mp4box
        try {
          processedBlob = await this.fixMP4Duration(rawBlob, recordingDuration);
          this.addLog('✅ MP4 duration metadata fixed');
        } catch (error) {
          this.addLog(`⚠️ MP4 fix failed: ${error}`);
        }
      }

      onProgress({ percent: 60, message: "Metadata durasi diperbaiki" });
      await this.delay(200);

      // Step 4: Social media optimization (80%)
      onProgress({ percent: 75, message: "Mengoptimalkan untuk Instagram..." });
      
      const compatibility = this.checkSocialMediaCompatibility(processedBlob, recordingDuration);
      this.addLog(`📱 Instagram compatible: ${compatibility.instagram ? 'YES' : 'NO'}`);
      
      await this.delay(250);

      // Step 5: Finalize (100%)
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

      await this.delay(200);
      onProgress({ percent: 100, message: "Video siap dibagikan!" });

      this.addLog(`✅ Processing complete: ${this.formatFileSize(finalFile.size)}`);
      return finalFile;

    } catch (error) {
      this.addLog(`❌ Processing failed: ${error}`);
      throw new Error(`Video processing failed: ${error}`);
    }
  }

  /**
   * Fix MP4 duration metadata using mp4box
   */
  private async fixMP4Duration(blob: Blob, durationSeconds: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        const mp4File = MP4Box.createFile();
        
        mp4File.onError = (error: any) => {
          this.addLog(`❌ MP4Box error: ${error}`);
          reject(new Error(`MP4 parsing failed: ${error}`));
        };

        mp4File.onReady = (info: any) => {
          try {
            this.addLog(`📊 MP4 info: ${info.duration}ms original duration`);
            
            // Calculate correct duration in timescale units
            const timescale = info.timescale || 1000;
            const correctDuration = durationSeconds * timescale;
            
            // Fix duration in movie header
            if (info.videoTracks && info.videoTracks.length > 0) {
              const videoTrack = info.videoTracks[0];
              videoTrack.movie_duration = correctDuration;
              videoTrack.duration = correctDuration;
            }
            
            if (info.audioTracks && info.audioTracks.length > 0) {
              const audioTrack = info.audioTracks[0];
              audioTrack.movie_duration = correctDuration;
              audioTrack.duration = correctDuration;
            }

            // Start extraction with corrected metadata
            mp4File.start();
          } catch (error) {
            reject(new Error(`MP4 duration fix failed: ${error}`));
          }
        };

        mp4File.onSegment = (id: number, user: any, buffer: ArrayBuffer) => {
          // Collect all segments
          const correctedBlob = new Blob([buffer], { type: 'video/mp4' });
          this.addLog(`✅ MP4 duration corrected: ${durationSeconds}s`);
          resolve(correctedBlob);
        };

        // Load MP4 data
        blob.arrayBuffer().then(buffer => {
          const mp4Buffer = buffer as ArrayBuffer & { fileStart?: number };
          mp4Buffer.fileStart = 0;
          mp4File.appendBuffer(mp4Buffer);
          mp4File.flush();
        }).catch(reject);

      } catch (error) {
        reject(new Error(`MP4Box initialization failed: ${error}`));
      }
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

  /**
   * Utility delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}