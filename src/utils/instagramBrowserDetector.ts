// src/utils/instagramBrowserDetector.ts - AGGRESSIVE REDIRECT VERSION

/**
 * Deteksi Instagram browser dengan metode yang lebih agresif
 */
export const isInstagramBrowser = (): boolean => {
    const userAgent = navigator.userAgent || "";
    // Deteksi berbagai variasi Instagram browser
    return userAgent.includes("Instagram") || 
           userAgent.includes("FBAN") || 
           userAgent.includes("FBAV") ||
           userAgent.includes("com.burbn.instagram");
  };
  
  /**
   * Deteksi iOS dengan lebih akurat
   */
  export const isIOSDevice = (): boolean => {
    const userAgent = navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  };
  
  /**
   * Cek apakah sudah pernah redirect untuk avoid loop
   */
  export const hasRedirectAttempted = (): boolean => {
    try {
      const attempted = sessionStorage.getItem('instagram_redirect_attempted');
      const timestamp = sessionStorage.getItem('instagram_redirect_time');
      
      if (!attempted || !timestamp) return false;
      
      // Reset after 30 seconds
      const timeDiff = Date.now() - parseInt(timestamp);
      if (timeDiff > 30000) {
        sessionStorage.removeItem('instagram_redirect_attempted');
        sessionStorage.removeItem('instagram_redirect_time');
        return false;
      }
      
      return true;
    } catch (e) {
      return false;
    }
  };
  
  /**
   * AGGRESSIVE Safari redirect with multiple methods
   */
  export const redirectToSafari = (url: string = window.location.href): void => {
    try {
      sessionStorage.setItem('instagram_redirect_attempted', 'true');
      sessionStorage.setItem('instagram_redirect_time', Date.now().toString());
    } catch (e) {
      // Ignore storage errors
    }
  
    console.log('🚀 AGGRESSIVE Safari redirect starting...');
    
    // Add cache buster
    const cleanUrl = url.split('?')[0].split('#')[0];
    const cacheBuster = `?_t=${Date.now()}&_src=instagram`;
    const targetUrl = cleanUrl + cacheBuster;
    
    // Show immediate feedback
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.95);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    `;
    overlay.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <div style="font-size: 48px; margin-bottom: 20px;">🚀</div>
        <div style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">
          Opening in Safari...
        </div>
        <div style="font-size: 16px; opacity: 0.8; margin-bottom: 20px;">
          For the best AR experience
        </div>
        <div style="font-size: 14px; opacity: 0.6;">
          If nothing happens, manually copy the URL to Safari
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Method 1: Direct Safari scheme (most reliable)
    setTimeout(() => {
      const safariUrl = `x-safari-https://${targetUrl.replace(/^https?:\/\//, '')}`;
      console.log('🍎 Trying Safari scheme:', safariUrl);
      window.location.href = safariUrl;
    }, 100);
    
    // Method 2: Alternative Safari scheme
    setTimeout(() => {
      const altSafari = `safari-https://${targetUrl.replace(/^https?:\/\//, '')}`;
      console.log('🦁 Trying alternative Safari scheme:', altSafari);
      window.location.href = altSafari;
    }, 500);
    
    // Method 3: Mobile Safari tab scheme
    setTimeout(() => {
      const tabScheme = `com-apple-mobilesafari-tab:${targetUrl}`;
      console.log('📱 Trying mobile Safari tab:', tabScheme);
      window.location.href = tabScheme;
    }, 1000);
    
    // Method 4: Try window.open with _system
    setTimeout(() => {
      try {
        console.log('🔗 Trying window.open _system');
        window.open(targetUrl, '_system');
      } catch (e) {
        console.log('❌ window.open failed');
      }
    }, 1500);
    
    // Method 5: Direct location change as last resort
    setTimeout(() => {
      console.log('🔄 Last resort: direct location change');
      window.location.href = targetUrl;
    }, 2500);
    
    // Remove overlay after attempts
    setTimeout(() => {
      if (document.body.contains(overlay)) {
        overlay.remove();
      }
    }, 4000);
  };
  
  /**
   * Check if we should redirect and do it immediately
   */
  export const checkAndRedirect = (): boolean => {
    const isInstagram = isInstagramBrowser();
    const isIOS = isIOSDevice();
    const hasAttempted = hasRedirectAttempted();
    
    console.log('🔍 Redirect check:', { isInstagram, isIOS, hasAttempted });
    
    if (isInstagram && !hasAttempted) {
      console.log('📱 Instagram detected - starting redirect...');
      redirectToSafari();
      return true; // Redirecting
    }
    
    return false; // Not redirecting
  };
  
  /**
   * Manual retry function
   */
  export const retryRedirect = (): void => {
    try {
      sessionStorage.removeItem('instagram_redirect_attempted');
      sessionStorage.removeItem('instagram_redirect_time');
    } catch (e) {
      // Ignore
    }
    
    redirectToSafari();
  };
  
  // Export for manual use
  export default {
    isInstagramBrowser,
    isIOSDevice,
    hasRedirectAttempted,
    redirectToSafari,
    checkAndRedirect,
    retryRedirect
  };