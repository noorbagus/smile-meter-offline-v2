// src/utils/instagramBrowserDetector.ts

/**
 * Deteksi apakah di in-app browser Instagram dan apakah di iOS
 */
export const isInstagramIOSBrowser = (): boolean => {
    const userAgent = navigator.userAgent || "";
    return userAgent.includes("Instagram") && 
           (userAgent.includes("iPhone") || userAgent.includes("iPad") || userAgent.includes("iPod"));
  };
  
  /**
   * Deteksi apakah di in-app browser Instagram pada platform apapun
   */
  export const isInstagramBrowser = (): boolean => {
    const userAgent = navigator.userAgent || "";
    return userAgent.includes("Instagram");
  };
  
  /**
   * Fungsi untuk membuka di Safari di iOS - Aggressive version
   */
  export const openInSafari = (url: string): void => {
    // Gunakan x-safari-https:// URL scheme untuk iOS (yang paling reliable)
    const safariScheme = `x-safari-https://${url.replace(/^https?:\/\//, '')}`;
    
    // Set redirection attempt flag
    try {
      sessionStorage.setItem('instagramRedirectAttempted', 'true');
      sessionStorage.setItem('redirectTimestamp', Date.now().toString());
    } catch (e) {
      // Ignore storage errors
    }
    
    // Coba dengan aggressive redirect (langsung tanpa delay)
    window.location.href = safariScheme;
    
    // Fallback #1 - setelah beberapa saat jika metode utama gagal
    setTimeout(() => {
      const legacyScheme = `com-apple-mobilesafari-tab:${url}`;
      window.location.href = legacyScheme;
    }, 300);
    
    // Fallback #2 - gunakan iframe technique (dapat menghindari beberapa rintangan)
    setTimeout(() => {
      try {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = safariScheme;
        document.body.appendChild(iframe);
        setTimeout(() => document.body.removeChild(iframe), 500);
      } catch (e) {
        console.error('Safari iframe redirect failed', e);
      }
    }, 600);
    
    // Fallback #3 - mencoba window.open sebagai metode terakhir
    setTimeout(() => {
      try {
        window.open(safariScheme, '_system');
      } catch (e) {
        console.error('Safari window.open redirect failed', e);
      }
    }, 900);
  };
  
  /**
   * Fungsi untuk membuka di browser eksternal pada Android
   */
  export const openInExternalBrowser = (url: string): void => {
    // Untuk Android, kita dapat mencoba beberapa metode
    
    // Set redirection attempt flag
    try {
      sessionStorage.setItem('instagramRedirectAttempted', 'true');
      sessionStorage.setItem('redirectTimestamp', Date.now().toString());
    } catch (e) {
      // Ignore storage errors
    }
    
    // Method 1: Direct location change
    window.location.href = url;
    
    // Method 2: Try window.open with _system
    setTimeout(() => {
      try {
        window.open(url, '_system');
      } catch (e) {
        console.error('Android external browser redirect failed', e);
      }
    }, 500);
    
    // Method 3: Try with an intent URL for Chrome
    setTimeout(() => {
      try {
        const chromeIntent = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
        window.location.href = chromeIntent;
      } catch (e) {
        console.error('Android Chrome intent redirect failed', e);
      }
    }, 800);
  };
  
  /**
   * Coba membuka URL di browser eksternal berdasarkan platform dengan pendekatan agresif
   */
  export const attemptExternalBrowserOpen = (url: string = window.location.href): void => {
    const userAgent = navigator.userAgent || "";
    const isIOS = userAgent.includes("iPhone") || userAgent.includes("iPad") || userAgent.includes("iPod");
    
    // Log untuk debugging
    console.log(`Attempting external browser redirect. iOS: ${isIOS}, URL: ${url}`);
    
    if (isIOS) {
      openInSafari(url);
    } else {
      openInExternalBrowser(url);
    }
    
    // Tambahkan notifikasi visual bahwa redirect sedang dicoba
    try {
      const redirectMsg = document.createElement('div');
      redirectMsg.style.cssText = 'position:fixed;top:10px;left:0;right:0;background:rgba(0,0,0,0.7);color:white;text-align:center;padding:10px;z-index:9999;font-family:sans-serif;';
      redirectMsg.textContent = `Membuka di browser eksternal...`;
      document.body.appendChild(redirectMsg);
      setTimeout(() => {
        if (document.body.contains(redirectMsg)) {
          document.body.removeChild(redirectMsg);
        }
      }, 3000);
    } catch (e) {
      // Ignore DOM errors
    }
  };
  
  /**
   * Periksa apakah redirect sudah dicoba sebelumnya 
   * (untuk mencegah loop redirect)
   */
  export const hasRedirectBeenAttempted = (): boolean => {
    try {
      return sessionStorage.getItem('instagramRedirectAttempted') === 'true';
    } catch (e) {
      return false;
    }
  };
  
  export default {
    isInstagramIOSBrowser,
    isInstagramBrowser,
    openInSafari,
    openInExternalBrowser,
    attemptExternalBrowserOpen,
    hasRedirectBeenAttempted
  };