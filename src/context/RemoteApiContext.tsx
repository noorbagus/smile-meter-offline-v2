// src/context/RemoteApiContext.tsx
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { setGlobalStateRef } from '../utils/RemoteApiService';

/**
 * State interface for Remote API data
 */
interface RemoteApiState {
  // Hadiah status
  hadiahAvailable: boolean;
  stockCount: number;
  
  // Recording
  currentScore: number;
  recordingId: string | null;
  currentScene: string | null;
  recordingStartTime: number | null;
  recordingEndTime: number | null;
  recordingDuration: number | null;
  
  // API status
  lastApiCall: {
    endpoint: string;
    timestamp: number;
    success: boolean;
  } | null;
}

/**
 * Context interface with state and update methods
 */
interface RemoteApiContextValue extends RemoteApiState {
  // Hadiah status methods
  updateHadiahStatus: (available: boolean, count: number) => void;
  
  // Recording methods
  setRecordingId: (id: string | null) => void;
  setScore: (score: number) => void;
  setCurrentScene: (scene: string | null) => void;
  
  // Utility methods
  resetRecordingState: () => void;
  resetAllState: () => void;
}

// Create context
const RemoteApiContext = createContext<RemoteApiContextValue | undefined>(undefined);

/**
 * Custom hook for accessing Remote API context
 */
export const useRemoteApi = () => {
  const context = useContext(RemoteApiContext);
  if (context === undefined) {
    throw new Error('useRemoteApi must be used within a RemoteApiProvider');
  }
  return context;
};

/**
 * Remote API Provider component
 */
export const RemoteApiProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  // State for API data
  const [state, setState] = useState<RemoteApiState>({
    // Default values
    hadiahAvailable: true,
    stockCount: 100,
    currentScore: 0,
    recordingId: null,
    currentScene: null,
    recordingStartTime: null,
    recordingEndTime: null,
    recordingDuration: null,
    lastApiCall: null
  });
  
  // Update methods
  const updateHadiahStatus = useCallback((available: boolean, count: number) => {
    setState(prev => ({ 
      ...prev, 
      hadiahAvailable: available, 
      stockCount: count,
      lastApiCall: {
        endpoint: 'update_hadiah_status',
        timestamp: Date.now(),
        success: true
      }
    }));
    console.log(`[RemoteAPI Context] Hadiah status updated: Available=${available}, Stock=${count}`);
  }, []);
  
  const setRecordingId = useCallback((id: string | null) => {
    setState(prev => ({ 
      ...prev, 
      recordingId: id,
      recordingStartTime: id ? Date.now() : prev.recordingStartTime,
      recordingEndTime: id ? null : Date.now(),
      lastApiCall: {
        endpoint: id ? 'start_recording' : 'stop_recording',
        timestamp: Date.now(),
        success: true
      }
    }));
    console.log(`[RemoteAPI Context] Recording ID ${id ? 'set' : 'cleared'}: ${id}`);
  }, []);
  
  const setScore = useCallback((score: number) => {
    setState(prev => ({ 
      ...prev, 
      currentScore: score,
      lastApiCall: {
        endpoint: 'set_score',
        timestamp: Date.now(),
        success: true
      }
    }));
    console.log(`[RemoteAPI Context] Score updated: ${score}`);
  }, []);
  
  const setCurrentScene = useCallback((scene: string | null) => {
    setState(prev => ({ 
      ...prev, 
      currentScene: scene 
    }));
    console.log(`[RemoteAPI Context] Current scene updated: ${scene}`);
  }, []);
  
  const resetRecordingState = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      currentScore: 0,
      recordingId: null,
      currentScene: null,
      recordingStartTime: null,
      recordingEndTime: null,
      recordingDuration: null
    }));
    console.log('[RemoteAPI Context] Recording state reset');
  }, []);
  
  const resetAllState = useCallback(() => {
    setState({
      hadiahAvailable: true,
      stockCount: 100,
      currentScore: 0,
      recordingId: null,
      currentScene: null,
      recordingStartTime: null,
      recordingEndTime: null,
      recordingDuration: null,
      lastApiCall: null
    });
    console.log('[RemoteAPI Context] All state reset to defaults');
  }, []);
  
  // Create a ref that includes both state and functions
  const contextRef = useRef<RemoteApiContextValue>({
    ...state,
    updateHadiahStatus,
    setRecordingId,
    setScore,
    setCurrentScene,
    resetRecordingState,
    resetAllState
  });
  
  // Update the ref whenever state or callbacks change
  useEffect(() => {
    contextRef.current = {
      ...state,
      updateHadiahStatus,
      setRecordingId,
      setScore,
      setCurrentScene,
      resetRecordingState,
      resetAllState
    };
    
    // Share the ref with the RemoteApiService
    setGlobalStateRef(contextRef);
    
    // Calculate recording duration if recording ended
    if (state.recordingStartTime && state.recordingEndTime && !state.recordingDuration) {
      const durationMs = state.recordingEndTime - state.recordingStartTime;
      const durationSec = Math.round(durationMs / 1000);
      
      // Update duration
      setState(prev => ({
        ...prev,
        recordingDuration: durationSec
      }));
    }
    
  }, [
    state, 
    updateHadiahStatus, 
    setRecordingId, 
    setScore, 
    setCurrentScene, 
    resetRecordingState, 
    resetAllState
  ]);
  
  // Context value
  const value: RemoteApiContextValue = {
    ...state,
    updateHadiahStatus,
    setRecordingId,
    setScore,
    setCurrentScene,
    resetRecordingState,
    resetAllState
  };
  
  return (
    <RemoteApiContext.Provider value={value}>
      {children}
    </RemoteApiContext.Provider>
  );
};

export default RemoteApiContext;