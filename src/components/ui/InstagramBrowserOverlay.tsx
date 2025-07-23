// src/components/ui/InstagramBrowserOverlay.tsx
import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { isInstagramBrowser, isInstagramIOSBrowser, attemptExternalBrowserOpen } from '../../utils/instagramBrowserDetector';

interface InstagramBrowserOverlayProps {
  onContinueAnyway?: () => void;
}

export const InstagramBrowserOverlay: React.FC<InstagramBrowserOverlayProps> = ({
  onContinueAnyway
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [redirectAttempted, setRedirectAttempted] = useState<boolean>(false);
  
  useEffect(() => {
    // Deteksi jika pengguna menggunakan in-app browser Instagram
    const isInInstagram = isInstagramBrowser();
    const isInInstagramIOS = isInstagramIOSBrowser();
    
    if (isInInstagram) {
      // Untuk iOS, langsung redirect tanpa menampilkan overlay
      if (isInInstagramIOS) {
        attemptExternalBrowserOpen();
        setRedirectAttempted(true);
        
        // Tampilkan overlay hanya setelah beberapa detik
        // ini sebagai fallback jika redirect otomatis gagal
        setTimeout(() => {
          setIsVisible(true);
        }, 1500);
      } else {
        // Untuk Android dan platform lain, tampilkan overlay
        setIsVisible(true);
      }
    }
  }, []);
  
  if (!isVisible) return null;
  
  const handleOpenExternal = () => {
    attemptExternalBrowserOpen();
    setRedirectAttempted(true);
  };
  
  const handleContinue = () => {
    setIsVisible(false);
    if (onContinueAnyway) onContinueAnyway();
  };
  
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-50 p-6">
      <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 max-w-sm w-full mx-auto text-center">
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <ExternalLink className="w-8 h-8 text-blue-400" />
        </div>
        
        <h3 className="text-white text-xl font-medium mb-3">
          {redirectAttempted 
            ? "Gagal Membuka Browser Eksternal" 
            : "Untuk Pengalaman Terbaik"}
        </h3>
        
        <p className="text-white/80 text-sm mb-6">
          {redirectAttempted 
            ? "Browser eksternal tidak dapat dibuka secara otomatis. Silakan klik tombol di bawah untuk mencoba lagi."
            : "Web AR Netramaya bekerja lebih baik di browser eksternal. Buka di Safari (iOS) atau Chrome (Android) untuk pengalaman AR terbaik."}
        </p>
        
        <div className="space-y-3">
          <button
            onClick={handleOpenExternal}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
            <span>Buka di Browser Eksternal</span>
          </button>
          
          <button
            onClick={handleContinue}
            className="w-full px-4 py-3 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium transition-colors"
          >
            Lanjutkan di Instagram
          </button>
        </div>
        
        <p className="text-white/50 text-xs mt-4">
          Instagram in-app browser memiliki keterbatasan untuk fitur AR seperti kamera dan media sharing.
        </p>
      </div>
    </div>
  );
};

export default InstagramBrowserOverlay;