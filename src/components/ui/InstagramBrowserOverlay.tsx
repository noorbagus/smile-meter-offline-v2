// src/components/ui/InstagramBrowserOverlay.tsx
import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';

interface InstagramBrowserOverlayProps {
  onContinueAnyway?: () => void;
}

// Helper functions for Instagram browser detection
const isInstagramBrowser = (): boolean => {
  const userAgent = navigator.userAgent || "";
  return userAgent.includes("Instagram");
};

const isInstagramIOSBrowser = (): boolean => {
  const userAgent = navigator.userAgent || "";
  return userAgent.includes("Instagram") && 
         (userAgent.includes("iPhone") || userAgent.includes("iPad") || userAgent.includes("iPod"));
};

const isRedirectReturn = (): boolean => {
  try {
    return sessionStorage.getItem('instagramRedirectAttempted') === 'true';
  } catch (e) {
    return false;
  }
};

const resetRedirectFlags = (): void => {
  try {
    sessionStorage.removeItem('instagramRedirectAttempted');
    sessionStorage.removeItem('redirectTimestamp');
  } catch (e) {
    // Ignore storage errors
  }
};

const attemptExternalBrowserOpen = (url: string = window.location.href): void => {
  // Jika ini adalah reload setelah redirect gagal, jangan redirect lagi
  if (isRedirectReturn()) {
    console.log("Halaman sudah pernah di-redirect, menghindari redirect loop");
    return;
  }
  
  // Set redirection attempt flag
  try {
    sessionStorage.setItem('instagramRedirectAttempted', 'true');
    sessionStorage.setItem('redirectTimestamp', Date.now().toString());
  } catch (e) {
    // Ignore storage errors
  }

  // Tambahkan parameter untuk menghindari cache
  const noCacheUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
  
  const userAgent = navigator.userAgent || "";
  const isIOS = userAgent.includes("iPhone") || userAgent.includes("iPad") || userAgent.includes("iPod");
  
  if (isIOS) {
    // iOS: Coba dengan URL scheme Safari
    const safariScheme = `x-safari-https://${noCacheUrl.replace(/^https?:\/\//, '')}`;
    
    // Visual feedback
    const redirectMsg = document.createElement('div');
    redirectMsg.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);color:white;display:flex;align-items:center;justify-content:center;z-index:9999;font-family:sans-serif;';
    redirectMsg.innerHTML = '<div style="text-align:center;padding:20px;"><div style="font-size:20px;margin-bottom:10px;">Membuka di Safari...</div><div style="opacity:0.7;font-size:14px;">Jika halaman tidak terbuka otomatis, klik "Buka" saat diminta</div></div>';
    document.body.appendChild(redirectMsg);
    
    // Sequence of redirect attempts with delays
    setTimeout(() => window.location.href = safariScheme, 500);
    
    setTimeout(() => {
      const legacyScheme = `com-apple-mobilesafari-tab:${noCacheUrl}`;
      window.location.href = legacyScheme;
    }, 1500);
  } else {
    // Android: Try opening in external browser
    window.location.href = noCacheUrl;
    
    setTimeout(() => {
      try {
        window.open(noCacheUrl, '_system');
      } catch (e) {}
    }, 1000);
    
    setTimeout(() => {
      try {
        const chromeIntent = `intent://${noCacheUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
        window.location.href = chromeIntent;
      } catch (e) {}
    }, 2000);
  }
};

export const InstagramBrowserOverlay: React.FC<InstagramBrowserOverlayProps> = ({
  onContinueAnyway
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [redirectFailed, setRedirectFailed] = useState<boolean>(false);
  
  useEffect(() => {
    const isInInstagram = isInstagramBrowser();
    const isInInstagramIOS = isInstagramIOSBrowser();
    const isReturning = isRedirectReturn();
    
    if (isInInstagram) {
      if (isReturning) {
        // Return from failed redirect attempt
        console.log("Kembali setelah redirect gagal, menampilkan overlay");
        setRedirectFailed(true);
        setIsVisible(true);
      } 
      else if (isInInstagramIOS) {
        // iOS: Immediate redirect with delay
        console.log("Mendeteksi Instagram iOS, redirect dalam 1 detik");
        setTimeout(() => {
          attemptExternalBrowserOpen();
          
          // Show overlay after delay if redirect fails
          setTimeout(() => {
            setRedirectFailed(true);
            setIsVisible(true);
          }, 2500);
        }, 1000);
      }
      else {
        // Android: Show overlay immediately
        console.log("Mendeteksi Instagram non-iOS, menampilkan overlay");
        setIsVisible(true);
      }
    }
  }, []);
  
  if (!isVisible) return null;
  
  const handleOpenExternal = () => {
    // Reset flags and try again
    resetRedirectFlags();
    attemptExternalBrowserOpen();
    setRedirectFailed(false);
    
    // Show overlay again if redirect fails again
    setTimeout(() => {
      setRedirectFailed(true);
    }, 2500);
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
          {redirectFailed 
            ? "Gagal Membuka Browser Eksternal" 
            : "Untuk Pengalaman Terbaik"}
        </h3>
        
        <p className="text-white/80 text-sm mb-6">
          {redirectFailed 
            ? "Browser eksternal tidak dapat dibuka secara otomatis. Silakan klik tombol di bawah untuk mencoba lagi atau lanjutkan di Instagram."
            : "Web AR Netramaya bekerja lebih baik di browser eksternal. Buka di Safari (iOS) atau Chrome (Android) untuk pengalaman AR terbaik."}
        </p>
        
        <div className="space-y-3">
          <button
            onClick={handleOpenExternal}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
            <span>{redirectFailed ? "Coba Lagi" : "Buka di Browser Eksternal"}</span>
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