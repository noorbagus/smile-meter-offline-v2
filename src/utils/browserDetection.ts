// src/utils/browserDetection.ts - Firefox camera orientation detection
export interface BrowserInfo {
    isFirefox: boolean;
    isChrome: boolean;
    isSafari: boolean;
    isEdge: boolean;
    isMobile: boolean;
    isAndroid: boolean;
    isIOS: boolean;
    version: string;
    platform: string;
  }
  
  export interface CameraOrientationFix {
    type: 'normal' | 'rotate-180' | 'flip-vertical' | 'flip-horizontal' | 'flip-both';
    cssClass: string;
    description: string;
  }
  
  /**
   * Detect browser information
   */
  export const detectBrowser = (): BrowserInfo => {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform?.toLowerCase() || '';
    
    // Browser detection
    const isFirefox = /firefox/.test(userAgent);
    const isChrome = /chrome/.test(userAgent) && !/edg/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
    const isEdge = /edg/.test(userAgent);
    
    // Mobile detection
    const isMobile = /android|iphone|ipad|mobile|tablet/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    
    // Version extraction
    let version = 'unknown';
    if (isFirefox) {
      const match = userAgent.match(/firefox\/([0-9.]+)/);
      version = match ? match[1] : 'unknown';
    } else if (isChrome) {
      const match = userAgent.match(/chrome\/([0-9.]+)/);
      version = match ? match[1] : 'unknown';
    }
    
    return {
      isFirefox,
      isChrome,
      isSafari,
      isEdge,
      isMobile,
      isAndroid,
      isIOS,
      version,
      platform
    };
  };
  
  /**
   * Firefox-specific camera orientation issues detection
   */
  export const detectFirefoxCameraIssues = (): CameraOrientationFix => {
    const browserInfo = detectBrowser();
    
    if (!browserInfo.isFirefox) {
      return {
        type: 'normal',
        cssClass: '',
        description: 'No Firefox-specific fixes needed'
      };
    }
    
    // Firefox mobile often has upside-down camera
    if (browserInfo.isMobile) {
      return {
        type: 'rotate-180',
        cssClass: 'firefox-rotate-180',
        description: 'Firefox mobile camera upside-down fix'
      };
    }
    
    // Firefox desktop with specific webcams
    const commonProblematicWebcams = [
      'microsoft lifecam',
      'logitech',
      'hp basic starter camera',
      'integrated camera'
    ];
    
    // Check if it's a known problematic setup
    if (browserInfo.platform.includes('win')) {
      return {
        type: 'flip-vertical',
        cssClass: 'firefox-flip-vertical',
        description: 'Firefox Windows webcam flip fix'
      };
    }
    
    // Default to normal
    return {
      type: 'normal',
      cssClass: '',
      description: 'No orientation fix detected'
    };
  };
  
  /**
   * Test camera orientation by creating a temporary stream
   */
  export const testCameraOrientation = async (
    addLog: (message: string) => void
  ): Promise<CameraOrientationFix> => {
    try {
      const browserInfo = detectBrowser();
      
      if (!browserInfo.isFirefox) {
        addLog('🔍 Not Firefox - no orientation fix needed');
        return {
          type: 'normal',
          cssClass: '',
          description: 'Non-Firefox browser'
        };
      }
      
      addLog(`🦊 Firefox ${browserInfo.version} detected`);
      
      // Quick test stream to detect issues
      const testStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      
      const videoTrack = testStream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      
      // Stop test stream immediately
      testStream.getTracks().forEach(track => track.stop());
      
      addLog(`📹 Test resolution: ${settings.width}x${settings.height}`);
      
      // Detect orientation fix based on browser and platform
      const orientationFix = detectFirefoxCameraIssues();
      
      addLog(`🔄 Orientation fix: ${orientationFix.description}`);
      
      return orientationFix;
      
    } catch (error) {
      addLog(`❌ Camera orientation test failed: ${error}`);
      
      // Fallback to browser-based detection
      return detectFirefoxCameraIssues();
    }
  };
  
  /**
   * Apply camera orientation fix to element
   */
  export const applyCameraOrientationFix = (
    element: HTMLElement,
    fix: CameraOrientationFix
  ): void => {
    // Remove all existing orientation classes
    const orientationClasses = [
      'firefox-rotate-180',
      'firefox-flip-vertical', 
      'firefox-flip-horizontal',
      'firefox-flip-both'
    ];
    
    orientationClasses.forEach(cls => {
      element.classList.remove(cls);
    });
    
    // Apply new fix class
    if (fix.cssClass) {
      element.classList.add(fix.cssClass);
    }
  };
  
  /**
   * Get all available orientation fixes for testing
   */
  export const getAllOrientationFixes = (): CameraOrientationFix[] => {
    return [
      {
        type: 'normal',
        cssClass: '',
        description: 'Normal orientation'
      },
      {
        type: 'rotate-180',
        cssClass: 'firefox-rotate-180',
        description: 'Rotate 180 degrees (upside-down fix)'
      },
      {
        type: 'flip-vertical',
        cssClass: 'firefox-flip-vertical',
        description: 'Flip vertically (mirror top-bottom)'
      },
      {
        type: 'flip-horizontal',
        cssClass: 'firefox-flip-horizontal',
        description: 'Flip horizontally (mirror left-right)'
      },
      {
        type: 'flip-both',
        cssClass: 'firefox-flip-both',
        description: 'Flip both directions'
      }
    ];
  };
  
  /**
   * Check if current session needs camera orientation fix
   */
  export const needsCameraOrientationFix = (): boolean => {
    const browserInfo = detectBrowser();
    
    // Only Firefox has known camera orientation issues
    return browserInfo.isFirefox;
  };
  
  /**
   * Get browser-specific camera constraints
   */
  export const getBrowserOptimizedConstraints = (
    facingMode: 'user' | 'environment' = 'user'
  ): MediaStreamConstraints => {
    const browserInfo = detectBrowser();
    
    if (browserInfo.isFirefox) {
      // Firefox-optimized constraints
      return {
        video: {
          facingMode,
          width: { ideal: 1280, min: 640, max: 1920 },
          height: { ideal: 720, min: 480, max: 1080 },
          frameRate: { ideal: 30, min: 15, max: 30 } // Firefox can be unstable with high FPS
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };
    }
    
    // Standard constraints for other browsers
    return {
      video: {
        facingMode,
        width: { ideal: 2560, min: 1280, max: 3840 },
        height: { ideal: 1440, min: 720, max: 2160 },
        frameRate: { ideal: 30, min: 15, max: 60 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: { ideal: 48000 },
        channelCount: { ideal: 2 }
      }
    };
  };
  
  // Default export
  export default {
    detectBrowser,
    detectFirefoxCameraIssues,
    testCameraOrientation,
    applyCameraOrientationFix,
    getAllOrientationFixes,
    needsCameraOrientationFix,
    getBrowserOptimizedConstraints
  };