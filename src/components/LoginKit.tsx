// src/components/LoginKit.tsx - Using Official Snap Login Kit SDK
import React, { useEffect, useState } from 'react';

interface LoginKitProps {
  onLogin: (accessToken: string, userInfo?: any) => void;
  onError?: (error: string) => void;
  addLog?: (message: string) => void;
}

declare global {
  interface Window {
    snapKitInit?: () => void;
    snap?: {
      loginkit: {
        mountButton: (elementId: string, config: any) => void;
        fetchUserInfo: () => Promise<any>;
      };
    };
  }
}

export const LoginKit: React.FC<LoginKitProps> = ({ onLogin, onError, addLog }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSDKReady, setIsSDKReady] = useState(false);

  useEffect(() => {
    // Check if SDK already loaded
    if (window.snap?.loginkit) {
      setIsSDKReady(true);
      mountButton();
      return;
    }

    // Define SDK init callback
    window.snapKitInit = () => {
      addLog?.('✅ Snap SDK loaded');
      setIsSDKReady(true);
      mountButton();
    };

    // Load official SDK
    const script = document.createElement('script');
    script.id = 'loginkit-sdk';
    script.src = 'https://sdk.snapkit.com/js/v1/login.js';
    script.async = true;
    script.onerror = () => setError('Failed to load Snap SDK');

    document.head.appendChild(script);

    return () => {
      const existingScript = document.getElementById('loginkit-sdk');
      if (existingScript) existingScript.remove();
    };
  }, [addLog]);

  const mountButton = () => {
    addLog?.(`🔧 Attempting to mount button...`);
    
    if (!window.snap?.loginkit) {
      addLog?.('❌ Snap SDK not available');
      return;
    }

    const clientId = import.meta.env.VITE_SNAPCHAT_CLIENT_ID;
    const redirectURI = import.meta.env.VITE_SNAPCHAT_REDIRECT_URI;
    
    addLog?.(`🔑 ClientID: ${clientId ? 'present' : 'missing'}`);
    addLog?.(`🔗 RedirectURI: ${redirectURI || 'missing'}`);

    if (!clientId || !redirectURI) {
      setError('Missing CLIENT_ID or REDIRECT_URI');
      return;
    }

    try {
      addLog?.(`📍 Mounting to element: snap-login-button`);
      window.snap.loginkit.mountButton('snap-login-button', {
        clientId,
        redirectURI,
        scopeList: [
          'user.display_name',
          'user.bitmoji.avatar', 
          'user.external_id'
        ],
        handleResponseCallback: async () => {
          setIsLoading(true);
          addLog?.('🔄 Login callback triggered');
          
          try {
            addLog?.('📡 Calling fetchUserInfo...');
            const result = await window.snap!.loginkit.fetchUserInfo();
            
            addLog?.(`📋 Raw result: ${JSON.stringify(result)}`);
            
            if (!result || !result.data || !result.data.me) {
              throw new Error('Invalid user info response');
            }
            
            const userInfo = result.data.me;
            addLog?.(`✅ User: ${userInfo.displayName || 'Unknown'}`);
            
            const mockToken = `snap_${userInfo.externalId || Date.now()}_${Date.now()}`;
            onLogin(mockToken, userInfo);
            
          } catch (err: any) {
            addLog?.(`❌ Error details: ${JSON.stringify(err)}`);
            addLog?.(`❌ Error name: ${err?.name}`);
            addLog?.(`❌ Error message: ${err?.message}`);
            
            const message = `fetchUserInfo failed: ${err?.message || 'Unknown error'}`;
            setError(message);
            onError?.(message);
          } finally {
            setIsLoading(false);
          }
        }
      });
      
      addLog?.(`✅ Button mount successful`);
    } catch (err: any) {
      addLog?.(`❌ Mount failed: ${JSON.stringify(err)}`);
      setError(`Mount failed: ${err}`);
    }
  };

  return (
    <div className="space-y-4">
      <div id="snap-login-button" className="min-h-[44px]">
        {!isSDKReady && (
          <div className="flex items-center justify-center p-3 bg-gray-600 rounded-lg">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            <span className="text-white text-sm">Loading Snapchat SDK...</span>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="p-3 bg-blue-500/20 rounded-lg">
          <div className="text-blue-300 text-sm flex items-center">
            <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin mr-2" />
            Authenticating...
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
          <div className="text-red-300 text-sm">{error}</div>
        </div>
      )}

      {import.meta.env.DEV && (
        <div className="text-xs text-white/60 p-3 bg-black/20 rounded">
          <p>Client ID: {import.meta.env.VITE_SNAPCHAT_CLIENT_ID ? '✅' : '❌'}</p>
          <p>Redirect: {import.meta.env.VITE_SNAPCHAT_REDIRECT_URI ? '✅' : '❌'}</p>
          <p>SDK Ready: {isSDKReady ? '✅' : '⏳'}</p>
        </div>
      )}
    </div>
  );
};