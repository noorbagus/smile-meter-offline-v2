// src/context/RemoteApiContext.tsx
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { setGlobalStateRef } from '../utils/RemoteApiService';

interface RemoteApiState {
  hadiahAvailable: boolean;
  stockCount: number;
  currentScore: number;
  recordingId: string | null;
}

interface RemoteApiContextValue extends RemoteApiState {
  updateHadiahStatus: (available: boolean, count: number) => void;
  setRecordingId: (id: string | null) => void;
  setScore: (score: number) => void;
}

const RemoteApiContext = createContext<RemoteApiContextValue | undefined>(undefined);

export const RemoteApiProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [state, setState] = useState<RemoteApiState>({
    hadiahAvailable: true,
    stockCount: 100,
    currentScore: 0,
    recordingId: null
  });
  
  const updateHadiahStatus = useCallback((available: boolean, count: number) => {
    setState(prev => ({ ...prev, hadiahAvailable: available, stockCount: count }));
    console.log(`[RemoteAPI Context] Hadiah status updated: Available=${available}, Stock=${count}`);
  }, []);
  
  const setRecordingId = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, recordingId: id }));
    console.log(`[RemoteAPI Context] Recording ID updated: ${id}`);
  }, []);
  
  const setScore = useCallback((score: number) => {
    setState(prev => ({ ...prev, currentScore: score }));
    console.log(`[RemoteAPI Context] Score updated: ${score}`);
  }, []);
  
  // Create a ref that includes both state and functions
  const contextRef = useRef<RemoteApiContextValue>({
    ...state,
    updateHadiahStatus,
    setRecordingId,
    setScore
  });
  
  // Update the ref whenever state or callbacks change
  useEffect(() => {
    contextRef.current = {
      ...state,
      updateHadiahStatus,
      setRecordingId,
      setScore
    };
    
    // Share the ref with the RemoteApiService
    setGlobalStateRef(contextRef);
  }, [state, updateHadiahStatus, setRecordingId, setScore]);
  
  const value: RemoteApiContextValue = {
    ...state,
    updateHadiahStatus,
    setRecordingId,
    setScore
  };
  
  return (
    <RemoteApiContext.Provider value={value}>
      {children}
    </RemoteApiContext.Provider>
  );
};

export const useRemoteApi = () => {
  const context = useContext(RemoteApiContext);
  if (context === undefined) {
    throw new Error('useRemoteApi must be used within a RemoteApiProvider');
  }
  return context;
};