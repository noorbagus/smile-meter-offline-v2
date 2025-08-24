// src/hooks/useFullscreen.ts
import { useState, useEffect, useCallback } from 'react';

export interface FullscreenState {
  isFullscreen: boolean;
  showExitButton: boolean;
  isSupported: boolean;
}

export const useFullscreen = (addLog: (message: string) => void) => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showExitButton, setShowExitButton] = useState<boolean>(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [exitButtonTimer, setExitButtonTimer] = useState<NodeJS.Timeout | null>(null);
  const [tapCount, setTapCount] = useState<number>(0);

  const isSupported = typeof document !== 'undefined' && 
    'requestFullscreen' in document.documentElement;

  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      
      // Lock orientation to portrait
      if ('orientation' in screen && 'lock' in screen.orientation) {
        try {
          await (screen.orientation as any).lock('portrait');
          addLog('🔒 Portrait orientation locked');
        } catch (orientationError) {
          addLog(`⚠️ Orientation lock failed: ${orientationError}`);
        }
      }
      
      // Apply fullscreen lock class
      document.body.classList.add('fullscreen-locked');
      
      setIsFullscreen(true);
      addLog('🖥️ Fullscreen mode activated');
      
    } catch (error) {
      addLog(`❌ Fullscreen failed: ${error}`);
    }
  }, [addLog]);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      
      // Remove fullscreen lock class
      document.body.classList.remove('fullscreen-locked');
      
      // Unlock orientation
      if ('orientation' in screen && 'unlock' in screen.orientation) {
        try {
          (screen.orientation as any).unlock();
          addLog('🔓 Orientation unlocked');
        } catch (orientationError) {
          addLog(`⚠️ Orientation unlock failed: ${orientationError}`);
        }
      }
      
      setIsFullscreen(false);
      setShowExitButton(false);
      addLog('🖥️ Fullscreen mode exited');
      
    } catch (error) {
      addLog(`❌ Exit fullscreen failed: ${error}`);
    }
  }, [addLog]);

  const handleLongPress = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isFullscreen) return;
    
    e.preventDefault();
    
    const timer = setTimeout(() => {
      setShowExitButton(true);
      addLog('📱 Long press detected - showing exit button');
      
      // Auto-hide exit button after 5 seconds
      const hideTimer = setTimeout(() => {
        setShowExitButton(false);
        addLog('⏰ Exit button auto-hidden');
      }, 5000);
      
      setExitButtonTimer(hideTimer);
    }, 1500); // 1.5 second long press
    
    setLongPressTimer(timer);
  }, [isFullscreen, addLog]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }, [longPressTimer]);

  const handleDoubleTap = useCallback(() => {
    if (!isFullscreen) return;
    
    setTapCount(prev => {
      if (prev === 0) {
        // First tap
        setTimeout(() => setTapCount(0), 500); // Reset after 500ms
        return 1;
      } else if (prev === 1) {
        // Second tap - show exit button
        setShowExitButton(true);
        addLog('👆 Double tap detected - showing exit button');
        
        // Auto-hide exit button after 5 seconds
        const hideTimer = setTimeout(() => {
          setShowExitButton(false);
          addLog('⏰ Exit button auto-hidden');
        }, 5000);
        
        setExitButtonTimer(hideTimer);
        return 0;
      }
      return 0;
    });
  }, [isFullscreen, addLog]);

  // Monitor fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      
      if (isCurrentlyFullscreen !== isFullscreen) {
        setIsFullscreen(isCurrentlyFullscreen);
        
        if (isCurrentlyFullscreen) {
          document.body.classList.add('fullscreen-locked');
          addLog('🖥️ Fullscreen activated by system');
        } else {
          document.body.classList.remove('fullscreen-locked');
          setShowExitButton(false);
          addLog('🖥️ Fullscreen deactivated by system');
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isFullscreen, addLog]);

  // Prevent gestures in fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const preventGestures = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const preventScroll = (e: TouchEvent) => {
      e.preventDefault();
    };

    const preventWheel = (e: WheelEvent) => {
      e.preventDefault();
    };

    const preventKeyboard = (e: KeyboardEvent) => {
      if (e.key === 'F11' || e.key === 'Escape') {
        e.preventDefault();
      }
    };

    document.addEventListener('touchstart', preventGestures, { passive: false });
    document.addEventListener('touchmove', preventScroll, { passive: false });
    document.addEventListener('wheel', preventWheel, { passive: false });
    document.addEventListener('keydown', preventKeyboard);

    return () => {
      document.removeEventListener('touchstart', preventGestures);
      document.removeEventListener('touchmove', preventScroll);
      document.removeEventListener('wheel', preventWheel);
      document.removeEventListener('keydown', preventKeyboard);
    };
  }, [isFullscreen]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
      if (exitButtonTimer) {
        clearTimeout(exitButtonTimer);
      }
    };
  }, [longPressTimer, exitButtonTimer]);

  return {
    isFullscreen,
    showExitButton,
    isSupported,
    enterFullscreen,
    exitFullscreen,
    handleLongPress,
    handleTouchEnd,
    handleDoubleTap
  };
};