// src/utils/resolutionDetector.ts - Landscape orientation detection

export interface ResolutionCapability {
    camera: { width: number; height: number; fps: number };
    display: { width: number; height: number };
    canvas: { width: number; height: number };
    devicePixelRatio: number;
    orientation: 'portrait' | 'landscape';
    needsRotation: boolean;
  }
  
  // Camera resolution presets LANDSCAPE (16:9 ratio)
  const CAMERA_PRESETS = [
    { width: 3840, height: 2160, name: '4K Landscape' },
    { width: 2560, height: 1440, name: '1440p Landscape' },
    { width: 1920, height: 1080, name: '1080p Landscape' },
    { width: 1280, height: 720, name: '720p Landscape' },
    { width: 640, height: 480, name: '480p Landscape' }
  ];
  
  // Display resolution presets LANDSCAPE
  const DISPLAY_PRESETS = [
    { width: 3840, height: 2160, name: '4K Landscape' },
    { width: 2560, height: 1440, name: '1440p Landscape' },
    { width: 1920, height: 1080, name: '1080p Landscape' },
    { width: 1280, height: 720, name: '720p Landscape' }
  ];
  
  export const detectMaxCameraResolution = async (
    facingMode: 'user' | 'environment' = 'user',
    addLog: (msg: string) => void
  ): Promise<{ width: number; height: number; fps: number }> => {
    addLog('🔍 Detecting maximum camera resolution (landscape)...');
    
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
    
    // Fallback to 720p landscape
    return { width: 1280, height: 720, fps: 30 };
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
    
    // Find best display preset that fits (landscape)
    for (const preset of DISPLAY_PRESETS) {
      if (physical.width >= preset.width && physical.height >= preset.height) {
        addLog(`✅ Max display: ${preset.width}x${preset.height} (${preset.name})`);
        return preset;
      }
    }
    
    // Use viewport size as fallback (landscape)
    return {
      width: Math.max(viewport.width, viewport.height),
      height: Math.min(viewport.width, viewport.height),
      name: 'Viewport Landscape'
    };
  };
  
  export const detectCameraRotationNeeded = (): boolean => {
    // Check if we need rotation to display properly
    const isPortraitViewport = window.innerHeight > window.innerWidth;
    
    // For landscape camera on portrait screen, rotation needed
    return isPortraitViewport;
  };
  
  export const getOptimalConfiguration = async (
    facingMode: 'user' | 'environment' = 'user',
    addLog: (msg: string) => void
  ): Promise<ResolutionCapability> => {
    const needsRotation = detectCameraRotationNeeded();
    const isPortraitViewport = window.innerHeight > window.innerWidth;
    
    addLog(`🔄 Viewport: ${isPortraitViewport ? 'Portrait' : 'Landscape'}, Rotation needed: ${needsRotation ? 'YES' : 'NO'}`);
    
    const [maxCamera, maxDisplay] = await Promise.all([
      detectMaxCameraResolution(facingMode, addLog),
      Promise.resolve(detectMaxDisplayResolution(addLog))
    ]);
    
    return {
      camera: maxCamera,
      display: maxDisplay,
      canvas: maxDisplay, // Canvas matches display capability
      devicePixelRatio: window.devicePixelRatio || 1,
      orientation: isPortraitViewport ? 'portrait' : 'landscape',
      needsRotation
    };
  };