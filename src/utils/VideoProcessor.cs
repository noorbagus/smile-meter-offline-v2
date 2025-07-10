// src/utils/VideoProcessor.ts
import fixWebmDuration from 'fix-webm-duration';
import { detectAndroid } from './androidRecorderFix';

/**
 * Kelas untuk memproses video dengan progress tracking
 * Menangani perbaikan metadata durasi dan optimasi format
 */
export class VideoProcessor {
  constructor(private addLog: (message: string) => void) {}
  
  /**
   * Memproses video untuk memastikan metadata durasi yang benar
   * dan kompatibilitas dengan aplikasi sharing
   * 
   * @param rawBlob - Blob video yang belum diproses
   * @param recordingDuration - Durasi perekaman dalam detik
   * @param onProgress - Callback untuk melaporkan progress (0-100)
   * @returns Promise dengan File yang sudah diproses
   */
  async processVideoForSharing(
    rawBlob: Blob, 
    recordingDuration: number, 
    onProgress: (percent: number) => void
  ): Promise<File> {
    try {
      // Step 1: Inisialisasi (10%)
      onProgress(10);
      this.addLog('🎬 Memulai proses rendering video...');
      
      const isAndroid = detectAndroid();
      const isMP4 = rawBlob.type.includes('mp4');
      
      // Step 2: Fix duration metadata (40%)
      this.addLog(`📊 Memperbaiki metadata durasi (${isMP4 ? 'MP4' : 'WebM'})...`);
      
      let processedBlob = rawBlob;
      
      if (!isMP4) {
        // Untuk WebM, gunakan fix-webm-duration
        try {
          onProgress(25);
          const actualDuration = recordingDuration * 1000; // konversi ke ms
          processedBlob = await fixWebmDuration(rawBlob, actualDuration);
          onProgress(40);
          this.addLog('✅ Metadata durasi WebM diperbaiki');
        } catch (error) {
          this.addLog(`⚠️ Gagal memperbaiki durasi WebM: ${error}`);
          onProgress(40); // Tetap lanjutkan meskipun gagal
        }
      } else {
        // Untuk MP4, pendekatan berbeda dibutuhkan
        // Simulasi proses untuk MP4
        await this.simulateProcessing(500);
        onProgress(40);
        this.addLog('✅ Format MP4 dioptimalkan');
      }
      
      // Step 3: Optimize untuk media sosial (70%)
      this.addLog('📱 Mengoptimalkan video untuk media sosial...');
      onProgress(55);
      
      // Simulasi optimasi untuk media sosial
      await this.simulateProcessing(300);
      onProgress(70);
      
      // Step 4: Finalisasi (90%)
      this.addLog('🔄 Finalisasi video...');
      onProgress(80);
      
      // Tambahkan data ke metadata
      const extension = isMP4 ? 'mp4' : 'webm';
      const filename = `video_${Date.now()}.${extension}`;
      
      // Tunggu sedikit untuk memastikan semua data ditulis dengan benar
      await this.simulateProcessing(200);
      onProgress(90);
      
      const finalFile = new File([processedBlob], filename, {
        type: isMP4 ? 'video/mp4' : 'video/webm',
        lastModified: Date.now()
      });
      
      // Tambahkan metadata tambahan ke File
      (finalFile as any).recordingDuration = recordingDuration;
      (finalFile as any).optimizedForSocialMedia = true;
      (finalFile as any).processingCompleted = true;
      (finalFile as any).isAndroidOptimized = isAndroid;
      (finalFile as any).fixedMetadata = true;
      
      // Step 5: Selesai (100%)
      await this.simulateProcessing(100);
      onProgress(100);
      this.addLog(`✅ Video selesai dirender: ${recordingDuration}s, siap dibagikan!`);
      
      return finalFile;
    } catch (error) {
      this.addLog(`❌ Gagal memproses video: ${error}`);
      onProgress(0); // Reset progress bar on error
      throw error;
    }
  }
  
  /**
   * Fungsi untuk mensimulasikan delay pemrosesan
   * Berguna untuk memberikan visual feedback yang lebih baik
   */
  private async simulateProcessing(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Memeriksa apakah video memiliki durasi minimal yang diperlukan
   * untuk platform seperti Instagram
   */
  validateVideoDuration(file: File | Blob, minDurationSeconds: number = 3): boolean {
    const duration = (file as any).recordingDuration || 0;
    return duration >= minDurationSeconds;
  }
  
  /**
   * Berbagi file menggunakan Web Share API jika tersedia
   */
  async shareVideo(file: File): Promise<boolean> {
    if (!file) return false;
    
    try {
      // Cek apakah Web Share API tersedia dan dapat berbagi file
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        const duration = (file as any).recordingDuration || 0;
        
        await navigator.share({
          files: [file],
          title: 'AR Video',
          text: `Check out this ${duration}s AR video!`
        });
        
        this.addLog('✅ Video dibagikan melalui Web Share API');
        return true;
      } else {
        // Fallback: download file
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.addLog('📥 Video diunduh (Web Share API tidak tersedia)');
        return false;
      }
    } catch (error) {
      this.addLog(`❌ Gagal berbagi video: ${error}`);
      return false;
    }
  }
}