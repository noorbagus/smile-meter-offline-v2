// src/utils/resolutionDetector.ts - Auto-detect max capabilities

export interface ResolutionCapability {
    camera: { width: number; height: number; fps: number };
    display: { width: number; height: number };
    canvas: { width: number; height: number };
    devicePixelRatio: number;
    orientation: 'portrait' | 'landscape';
    needsRotation: boolean;
  }
  
  // Camera resolution presets PORTRAIT (9:16 ratio)
  const CAMERA_PRESETS = [
    { width: 2160, height: 3840, name: '4K Portrait' },
    { width: 1440, height: 2560, name: '1440p Portrait' },
    { width: 1080, height: 1920, name: '1080p Portrait' },
    { width: 720, height: 1280, name: '720p Portrait' },
    { width: 480, height: 640, name: '480p Portrait' }
  ];
  
  // Display resolution presets PORTRAIT
  const DISPLAY_PRESETS = [
    { width: 2160, height: 3840, name: '4K Portrait' },
    { width: 1440, height: 2560, name: '1440p Portrait' },
    { width: 1080, height: 1920, name: '1080p Portrait' },
    { width: 720, height: 1280, name: '720p Portrait' }
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
    
    // Fallback to 720p portrait
    return { width: 720, height: 1280, fps: 30 };
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
    
    // Use viewport size as fallback (portrait)
    return {
      width: Math.min(viewport.width, viewport.height),
      height: Math.max(viewport.width, viewport.height),
      name: 'Viewport Portrait'
    };
  };
  
  export const detectCameraRotationNeeded = (): boolean => {
    // ALWAYS need rotation for portrait mode
    return true;
  };
  
  export const getOptimalConfiguration = async (
    facingMode: 'user' | 'environment' = 'user',
    addLog: (msg: string) => void
  ): Promise<ResolutionCapability> => {
    const needsRotation = detectCameraRotationNeeded();
    
    addLog(`🔄 Portrait mode: ALWAYS rotate (${needsRotation ? 'YES' : 'NO'})`);
    
    const [maxCamera, maxDisplay] = await Promise.all([
      detectMaxCameraResolution(facingMode, addLog),
      Promise.resolve(detectMaxDisplayResolution(addLog))
    ]);
    
    return {
      camera: maxCamera,
      display: maxDisplay,
      canvas: maxDisplay, // Canvas matches display capability
      devicePixelRatio: window.devicePixelRatio || 1,
      orientation: 'portrait', // Always portrait
      needsRotation: true // Always rotate
    };
  };