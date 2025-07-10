// src/utils/VideoProcessor.ts - Fixed with binary MP4 manipulation
import fixWebmDuration from 'fix-webm-duration';
import { detectAndroid } from './androidRecorderFix';

export interface ProcessingProgress {
  percent: number;
  message: string;
}

/**
 * Binary MP4 Duration Fixer - Direct header manipulation
 */
class MP4DurationFixer {
  private addLog: (message: string) => void;

  constructor(addLog: (message: string) => void) {
    this.addLog = addLog;
  }

  async fixMP4Duration(blob: Blob, actualDurationSeconds: number): Promise<Blob> {
    try {
      const buffer = await blob.arrayBuffer();
      const view = new DataView(buffer);
      const uint8Array = new Uint8Array(buffer);
      
      this.addLog(`🔧 Fixing MP4 duration: ${actualDurationSeconds}s`);
      
      // Fix movie header (MVHD)
      const mvhdFixed = this.fixMVHDDuration(view, uint8Array, actualDurationSeconds);
      
      // Fix track headers (TKHD)  
      const tkhdFixed = this.fixTKHDDurations(view, uint8Array, actualDurationSeconds);
      
      // Fix media headers (MDHD)
      const mdhdFixed = this.fixMDHDDurations(view, uint8Array, actualDurationSeconds);
      
      if (mvhdFixed || tkhdFixed || mdhdFixed) {
        this.addLog(`✅ MP4 headers fixed (MVHD:${mvhdFixed}, TKHD:${tkhdFixed}, MDHD:${mdhdFixed})`);
        return new Blob([uint8Array], { type: 'video/mp4' });
      } else {
        this.addLog(`⚠️ No MP4 headers found to fix`);
        return blob;
      }
      
    } catch (error) {
      this.addLog(`❌ MP4 fix failed: ${error}`);
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
      
      this.addLog(`🎬 MVHD: ${timescale} timescale, ${newDuration} duration`);
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
  private mp4Fixer: MP4DurationFixer;

  constructor(private addLog: (message: string) => void) {
    this.mp4Fixer = new MP4DurationFixer(addLog);
  }

  async processVideo(
    rawBlob: Blob,
    recordingDuration: number,
    onProgress: (progress: ProcessingProgress) => void
  ): Promise<File> {
    try {
      const isMP4 = rawBlob.type.includes('mp4');
      
      onProgress({ percent: 10, message: "Analyzing video format..." });
      
      let processedBlob = rawBlob;

      if (isMP4) {
        onProgress({ percent: 30, message: "Fixing MP4 duration headers..." });
        processedBlob = await this.mp4Fixer.fixMP4Duration(rawBlob, recordingDuration);
      } else {
        onProgress({ percent: 30, message: "Fixing WebM duration..." });
        const durationMs = recordingDuration * 1000;
        processedBlob = await fixWebmDuration(rawBlob, durationMs);
      }

      onProgress({ percent: 80, message: "Finalizing for Instagram..." });
      
      const finalFile = this.createFinalFile(processedBlob, recordingDuration, isMP4);
      
      onProgress({ percent: 100, message: "Video ready for Instagram!" });
      
      return finalFile;
    } catch (error) {
      this.addLog(`❌ Processing failed: ${error}`);
      throw error;
    }
  }

  private createFinalFile(blob: Blob, duration: number, isMP4: boolean): File {
    const extension = isMP4 ? 'mp4' : 'webm';
    const filename = `ar_video_${Date.now()}.${extension}`;
    
    const file = new File([blob], filename, {
      type: isMP4 ? 'video/mp4' : 'video/webm',
      lastModified: Date.now()
    });

    // Enhanced metadata
    (file as any).recordingDuration = duration;
    (file as any).instagramCompatible = isMP4 && duration >= 3;
    (file as any).fixedMetadata = true;
    (file as any).processingMethod = isMP4 ? 'binary-mp4-fix' : 'webm-fix';
    (file as any).isAndroidOptimized = isMP4 && detectAndroid();

    return file;
  }

  async shareVideo(file: File): Promise<boolean> {
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'AR Video',
          text: `Check out this ${(file as any).recordingDuration}s AR video! 📱 Instagram ready!`
        });
        return true;
      } else {
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
  }
}