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
   * Deteksi apakah ini halaman yang di-reload setelah redirect
   */
  export const isRedirectReturn = (): boolean => {
    try {
      return sessionStorage.getItem('instagramRedirectAttempted') === 'true';
    } catch (e) {
      return false;
    }
  };
  
  /**
   * Fungsi untuk membuka di Safari di iOS - Aggressive version
   */
  export const openInSafari = (url: string): void => {
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
    
    // Gunakan x-safari-https:// URL scheme untuk iOS (yang paling reliable)
    const safariScheme = `x-safari-https://${noCacheUrl.replace(/^https?:\/\//, '')}`;
    
    // Tambahkan visual feedback
    try {
      const redirectMsg = document.createElement('div');
      redirectMsg.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);color:white;display:flex;align-items:center;justify-content:center;z-index:9999;font-family:sans-serif;';
      redirectMsg.innerHTML = '<div style="text-align:center;padding:20px;"><div style="font-size:20px;margin-bottom:10px;">Membuka di Safari...</div><div style="opacity:0.7;font-size:14px;">Jika halaman tidak terbuka otomatis, klik "Buka" saat diminta</div></div>';
      document.body.appendChild(redirectMsg);
    } catch (e) {
      // Ignore DOM errors
    }
    
    // Coba dengan aggressive redirect (langsung tanpa delay)
    setTimeout(() => {
      window.location.href = safariScheme;
    }, 500);
    
    // Fallback #1 - setelah beberapa saat jika metode utama gagal
    setTimeout(() => {
      const legacyScheme = `com-apple-mobilesafari-tab:${noCacheUrl}`;
      window.location.href = legacyScheme;
    }, 1500);
    
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
    }, 2500);
    
    // Fallback #3 - mencoba window.open sebagai metode terakhir
    setTimeout(() => {
      try {
        window.open(safariScheme, '_system');
      } catch (e) {
        console.error('Safari window.open redirect failed', e);
      }
    }, 3500);
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
    
    // Tambahkan parameter untuk menghindari cache
    const noCacheUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
    
    // Method 1: Direct location change
    window.location.href = noCacheUrl;
    
    // Method 2: Try window.open with _system
    setTimeout(() => {
      try {
        window.open(noCacheUrl, '_system');
      } catch (e) {
        console.error('Android external browser redirect failed', e);
      }
    }, 1000);
    
    // Method 3: Try with an intent URL for Chrome
    setTimeout(() => {
      try {
        const chromeIntent = `intent://${noCacheUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
        window.location.href = chromeIntent;
      } catch (e) {
        console.error('Android Chrome intent redirect failed', e);
      }
    }, 2000);
  };
  
  /**
   * Coba membuka URL di browser eksternal berdasarkan platform dengan pendekatan agresif
   */
  export const attemptExternalBrowserOpen = (url: string = window.location.href): void => {
    // Jika ini adalah reload setelah redirect gagal, jangan redirect lagi
    if (isRedirectReturn()) {
      console.log("Halaman sudah pernah di-redirect, menghindari redirect loop");
      return;
    }
    
    const userAgent = navigator.userAgent || "";
    const isIOS = userAgent.includes("iPhone") || userAgent.includes("iPad") || userAgent.includes("iPod");
    
    // Log untuk debugging
    console.log(`Attempting external browser redirect. iOS: ${isIOS}, URL: ${url}`);
    
    if (isIOS) {
      openInSafari(url);
    } else {
      openInExternalBrowser(url);
    }
  };
  
  /**
   * Reset redirect flags untuk mencoba redirect lagi
   */
  export const resetRedirectFlags = (): void => {
    try {
      sessionStorage.removeItem('instagramRedirectAttempted');
      sessionStorage.removeItem('redirectTimestamp');
    } catch (e) {
      // Ignore storage errors
    }
  };
  
  export default {
    isInstagramIOSBrowser,
    isInstagramBrowser,
    isRedirectReturn,
    openInSafari,
    openInExternalBrowser,
    attemptExternalBrowserOpen,
    resetRedirectFlags
  };