// src/utils/VideoProcessor.ts - MAX QUALITY video processing untuk 1440x2560
import fixWebmDuration from 'fix-webm-duration';
import { detectAndroid } from './androidRecorderFix';

export interface ProcessingProgress {
  percent: number;
  message: string;
}

/**
 * Binary MP4 Duration Fixer - Enhanced untuk MAX quality
 */
class MaxQualityMP4DurationFixer {
  private addLog: (message: string) => void;

  constructor(addLog: (message: string) => void) {
    this.addLog = addLog;
  }

  async fixMP4Duration(blob: Blob, actualDurationSeconds: number): Promise<Blob> {
    try {
      const buffer = await blob.arrayBuffer();
      const view = new DataView(buffer);
      const uint8Array = new Uint8Array(buffer);
      
      this.addLog(`🔧 Fixing MAX quality MP4 duration: ${actualDurationSeconds}s`);
      
      // Fix movie header (MVHD)
      const mvhdFixed = this.fixMVHDDuration(view, uint8Array, actualDurationSeconds);
      
      // Fix track headers (TKHD)  
      const tkhdFixed = this.fixTKHDDurations(view, uint8Array, actualDurationSeconds);
      
      // Fix media headers (MDHD)
      const mdhdFixed = this.fixMDHDDurations(view, uint8Array, actualDurationSeconds);
      
      if (mvhdFixed || tkhdFixed || mdhdFixed) {
        this.addLog(`✅ MAX quality MP4 headers fixed (MVHD:${mvhdFixed}, TKHD:${tkhdFixed}, MDHD:${mdhdFixed})`);
        return new Blob([uint8Array], { type: 'video/mp4' });
      } else {
        this.addLog(`⚠️ No MP4 headers found to fix`);
        return blob;
      }
      
    } catch (error) {
      this.addLog(`❌ MAX quality MP4 fix failed: ${error}`);
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
      
      this.addLog(`🎬 MVHD fixed: ${timescale} timescale, ${newDuration} duration`);
      return true;
    } catch (error) {
      this.addLog(`❌ MVHD fix failed: ${error}`);
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
        
        const movieTimescale = 1000; // Standard movie timescale
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
      if (i % 4 === 0) { // 4-byte boundary alignment
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
}

export class VideoProcessor {
  private mp4Fixer: MaxQualityMP4DurationFixer;

  constructor(private addLog: (message: string) => void) {
    this.mp4Fixer = new MaxQualityMP4DurationFixer(addLog);
  }

  async processVideo(
    rawBlob: Blob,
    recordingDuration: number,
    onProgress: (progress: ProcessingProgress) => void
  ): Promise<File> {
    try {
      const isMP4 = rawBlob.type.includes('mp4');
      const isMaxQuality = (rawBlob as any).isMaxQuality || rawBlob.size > 10 * 1024 * 1024; // >10MB likely max quality
      
      onProgress({ percent: 10, message: `Analyzing ${isMaxQuality ? 'MAX quality' : 'standard'} video format...` });
      
      let processedBlob = rawBlob;

      if (isMP4) {
        onProgress({ percent: 30, message: `Fixing ${isMaxQuality ? 'MAX quality' : 'standard'} MP4 duration headers...` });
        processedBlob = await this.mp4Fixer.fixMP4Duration(rawBlob, recordingDuration);
      } else {
        onProgress({ percent: 30, message: `Fixing ${isMaxQuality ? 'MAX quality' : 'standard'} WebM duration...` });
        const durationMs = recordingDuration * 1000;
        processedBlob = await fixWebmDuration(rawBlob, durationMs);
      }

      onProgress({ percent: 80, message: `Finalizing ${isMaxQuality ? 'MAX quality' : 'standard'} video for Instagram...` });
      
      const finalFile = this.createMaxQualityFinalFile(processedBlob, recordingDuration, isMP4, isMaxQuality);
      
      const qualityIndicator = isMaxQuality ? 'MAX QUALITY' : 'standard';
      onProgress({ percent: 100, message: `${qualityIndicator} video ready for Instagram!` });
      
      return finalFile;
    } catch (error) {
      this.addLog(`❌ MAX quality processing failed: ${error}`);
      throw error;
    }
  }

  private createMaxQualityFinalFile(blob: Blob, duration: number, isMP4: boolean, isMaxQuality: boolean): File {
    const extension = isMP4 ? 'mp4' : 'webm';
    const qualityPrefix = isMaxQuality ? 'max_quality_' : '';
    const filename = `${qualityPrefix}ar_video_${Date.now()}.${extension}`;
    
    const file = new File([blob], filename, {
      type: isMP4 ? 'video/mp4' : 'video/webm',
      lastModified: Date.now()
    });

    // Enhanced metadata dengan max quality info
    (file as any).recordingDuration = duration;
    (file as any).instagramCompatible = isMP4 && duration >= 3;
    (file as any).fixedMetadata = true;
    (file as any).processingMethod = isMP4 ? 'binary-mp4-fix' : 'webm-fix';
    (file as any).isAndroidOptimized = isMP4 && detectAndroid();
    (file as any).isMaxQuality = isMaxQuality;
    (file as any).qualityProfile = isMaxQuality ? 'MAX_PORTRAIT_1440x2560' : 'STANDARD_1080x1920';
    (file as any).expectedResolution = isMaxQuality ? '1440x2560' : '1080x1920';
    (file as any).processingTimestamp = Date.now();
    (file as any).socialMediaOptimized = true;
    
    // File size analysis
    const fileSizeMB = blob.size / (1024 * 1024);
    (file as any).fileSizeMB = Math.round(fileSizeMB * 10) / 10;
    (file as any).compressionEfficient = fileSizeMB < (isMaxQuality ? 50 : 25); // Expected thresholds

    return file;
  }

  async shareVideo(file: File): Promise<boolean> {
    try {
      const isMaxQuality = (file as any).isMaxQuality;
      const qualityIndicator = isMaxQuality ? 'MAX QUALITY' : 'standard';
      const duration = (file as any).recordingDuration;
      const fileSizeMB = (file as any).fileSizeMB || (file.size / (1024 * 1024)).toFixed(1);
      
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${qualityIndicator} AR Video`,
          text: `Check out this ${duration}s ${qualityIndicator} AR video! 📱 ${fileSizeMB}MB Instagram ready!`
        });
        this.addLog(`✅ ${qualityIndicator} video shared successfully`);
        return true;
      } else {
        this.addLog(`📱 ${qualityIndicator} video downloading...`);
        this.downloadFile(file);
        return false;
      }
    } catch (error) {
      this.addLog(`❌ Share failed: ${error}`);
      this.downloadFile(file);
      return false;
    }
  }

  private downloadFile(file: File): void {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    const isMaxQuality = (file as any).isMaxQuality;
    const qualityIndicator = isMaxQuality ? 'MAX QUALITY' : 'standard';
    this.addLog(`💾 ${qualityIndicator} video downloaded: ${file.name}`);
  }
}