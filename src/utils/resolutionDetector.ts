// src/utils/resolutionDetector.ts - Auto-detect max capabilities

export interface ResolutionCapability {
    camera: { width: number; height: number; fps: number };
    display: { width: number; height: number };
    canvas: { width: number; height: number };
    devicePixelRatio: number;
    orientation: 'portrait' | 'landscape';
    needsRotation: boolean;
  }
  
  // Camera resolution presets (descending priority)
  const CAMERA_PRESETS = [
    { width: 3840, height: 2160, name: '4K' },
    { width: 2560, height: 1440, name: '1440p' },
    { width: 1920, height: 1080, name: '1080p' },
    { width: 1280, height: 720, name: '720p' },
    { width: 640, height: 480, name: '480p' }
  ];
  
  // Display resolution presets
  const DISPLAY_PRESETS = [
    { width: 3840, height: 2160, name: '4K' },
    { width: 2560, height: 1440, name: '1440p' },
    { width: 1920, height: 1080, name: '1080p' },
    { width: 1280, height: 720, name: '720p' }
  ];
  
  export const detectMaxCameraResolution = async (
    facingMode: 'user' | 'environment' = 'user',
    addLog: (msg: string) => void
  ): Promise<{ width: number; height: number; fps: number }> => {
    addLog('🔍 Detecting maximum camera resolution...');
    
    for (const preset of CAMERA_PRESETS) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: preset.width },
            height: { ideal: preset.height },
            frameRate: { ideal: 30 }
          }
        });
        
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        
        // Stop test stream
        stream.getTracks().forEach(t => t.stop());
        
        const actualRes = {
          width: settings.width || preset.width,
          height: settings.height || preset.height,
          fps: settings.frameRate || 30
        };
        
        addLog(`✅ Max camera: ${actualRes.width}x${actualRes.height}@${actualRes.fps}fps (${preset.name})`);
        return actualRes;
        
      } catch (error) {
        addLog(`❌ ${preset.name} (${preset.width}x${preset.height}) not supported`);
        continue;
      }
    }
    
    // Fallback
    return { width: 640, height: 480, fps: 30 };
  };
  
  export const detectMaxDisplayResolution = (addLog: (msg: string) => void) => {
    const screen = window.screen;
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    const dpr = window.devicePixelRatio || 1;
    
    // Physical screen resolution
    const physical = {
      width: screen.width * dpr,
      height: screen.height * dpr
    };
    
    addLog(`📱 Screen: ${screen.width}x${screen.height}, DPR: ${dpr}`);
    addLog(`🖥️ Physical: ${physical.width}x${physical.height}`);
    addLog(`📺 Viewport: ${viewport.width}x${viewport.height}`);
    
    // Find best display preset that fits
    for (const preset of DISPLAY_PRESETS) {
      if (physical.width >= preset.width && physical.height >= preset.height) {
        addLog(`✅ Max display: ${preset.width}x${preset.height} (${preset.name})`);
        return preset;
      }
    }
    
    // Use viewport size as fallback
    return {
      width: viewport.width,
      height: viewport.height,
      name: 'Viewport'
    };
  };
  
  export const detectCameraRotationNeeded = (userAgent: string = navigator.userAgent): boolean => {
    // Detect Brio or external cameras that need rotation
    const needsRotation = /brio|logitech/i.test(userAgent) || 
                         window.location.search.includes('rotate=true');
    
    return needsRotation;
  };
  
  export const getOptimalConfiguration = async (
    facingMode: 'user' | 'environment' = 'user',
    addLog: (msg: string) => void
  ): Promise<ResolutionCapability> => {
    const isPortrait = window.innerHeight > window.innerWidth;
    const needsRotation = detectCameraRotationNeeded();
    
    addLog(`🔄 Camera rotation needed: ${needsRotation ? 'YES' : 'NO'}`);
    
    const [maxCamera, maxDisplay] = await Promise.all([
      detectMaxCameraResolution(facingMode, addLog),
      Promise.resolve(detectMaxDisplayResolution(addLog))
    ]);
    
    return {
      camera: maxCamera,
      display: maxDisplay,
      canvas: maxDisplay, // Canvas matches display capability
      devicePixelRatio: window.devicePixelRatio || 1,
      orientation: isPortrait ? 'portrait' : 'landscape',
      needsRotation
    };
  };