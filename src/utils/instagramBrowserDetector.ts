// src/utils/instagramBrowserDetector.ts - Updated with Android Chrome deep link

/**
 * Deteksi Android browser
 */
export const isAndroidDevice = (): boolean => {
    return /Android/i.test(navigator.userAgent);
  };
  
  /**
   * Deteksi Instagram browser dengan metode yang lebih agresif
   */
  export const isInstagramBrowser = (): boolean => {
    const userAgent = navigator.userAgent || "";
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
   * Android browser redirect with fallback chain
   */
  export const redirectToChrome = (url: string = window.location.href): void => {
    try {
      sessionStorage.setItem('instagram_redirect_attempted', 'true');
      sessionStorage.setItem('instagram_redirect_time', Date.now().toString());
    } catch (e) {
      // Ignore storage errors
    }
  
    console.log('🚀 Android browser redirect starting...');
    
    // Clean URL and add cache buster
    const cleanUrl = url.split('?')[0].split('#')[0];
    const cacheBuster = `?_t=${Date.now()}&_src=instagram_android`;
    const targetUrl = cleanUrl + cacheBuster;
    const cleanDomain = targetUrl.replace(/^https?:\/\//, '');
    
    // Browser fallback chain
    const browsers = [
      { name: 'Chrome', package: 'com.android.chrome' },
      { name: 'Samsung Internet', package: 'com.sec.android.app.sbrowser' },
      { name: 'Firefox', package: 'org.mozilla.firefox' },
      { name: 'Edge', package: 'com.microsoft.emmx' },
      { name: 'Opera', package: 'com.opera.browser' },
      { name: 'Brave', package: 'com.brave.browser' }
    ];
    
    // Try specific browsers first
    browsers.forEach((browser, index) => {
      setTimeout(() => {
        const intent = `intent://${cleanDomain}#Intent;scheme=https;package=${browser.package};end`;
        console.log(`🌐 ${browser.name} intent:`, intent);
        window.location.href = intent;
      }, 100 + (index * 200));
    });
    
    // Generic browser intent (will use default browser)
    setTimeout(() => {
      const genericIntent = `intent://${cleanDomain}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;
      console.log('🔗 Generic browser intent:', genericIntent);
      window.location.href = genericIntent;
    }, 1500);
    
    // Window.open fallback
    setTimeout(() => {
      try {
        console.log('📱 Window.open attempt');
        window.open(targetUrl, '_system');
      } catch (e) {
        console.log('❌ window.open failed');
      }
    }, 2000);
    
    // Direct location change (last resort)
    setTimeout(() => {
      console.log('🔄 Direct location change');
      window.location.href = targetUrl;
    }, 2500);
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
  
    console.log('🚀 Safari redirect starting...');
    
    // Add cache buster
    const cleanUrl = url.split('?')[0].split('#')[0];
    const cacheBuster = `?_t=${Date.now()}&_src=instagram_ios`;
    const targetUrl = cleanUrl + cacheBuster;
    
    // Method 1: Direct Safari scheme (most reliable)
    setTimeout(() => {
      const safariUrl = `x-safari-https://${targetUrl.replace(/^https?:\/\//, '')}`;
      console.log('🍎 Safari scheme:', safariUrl);
      window.location.href = safariUrl;
    }, 100);
    
    // Method 2: Alternative Safari scheme
    setTimeout(() => {
      const altSafari = `safari-https://${targetUrl.replace(/^https?:\/\//, '')}`;
      console.log('🦁 Alternative Safari:', altSafari);
      window.location.href = altSafari;
    }, 400);
    
    // Method 3: Mobile Safari tab scheme
    setTimeout(() => {
      const tabScheme = `com-apple-mobilesafari-tab:${targetUrl}`;
      console.log('📱 Mobile Safari tab:', tabScheme);
      window.location.href = tabScheme;
    }, 800);
  };
  
  /**
   * Smart redirect based on platform
   */
  export const checkAndRedirect = (): boolean => {
    const isInstagram = isInstagramBrowser();
    const isAndroid = isAndroidDevice();
    const isIOS = isIOSDevice();
    const hasAttempted = hasRedirectAttempted();
    
    console.log('🔍 Platform check:', { isInstagram, isAndroid, isIOS, hasAttempted });
    
    if (isInstagram && !hasAttempted) {
      console.log('📱 Instagram detected - starting platform-specific redirect...');
      
      if (isAndroid) {
        redirectToChrome();
      } else if (isIOS) {
        redirectToSafari();
      } else {
        // Desktop fallback
        redirectToChrome();
      }
      
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
    
    const isAndroid = isAndroidDevice();
    const isIOS = isIOSDevice();
    
    if (isAndroid) {
      redirectToChrome();
    } else if (isIOS) {
      redirectToSafari();
    } else {
      redirectToChrome();
    }
  };
  
  // Export for manual use
  export default {
    isInstagramBrowser,
    isIOSDevice,
    isAndroidDevice,
    hasRedirectAttempted,
    redirectToSafari,
    redirectToChrome,
    checkAndRedirect,
    retryRedirect
  };