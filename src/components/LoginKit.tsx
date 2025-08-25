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
    if (!window.snap?.loginkit) return;

    const clientId = import.meta.env.VITE_SNAPCHAT_CLIENT_ID;
    const redirectURI = import.meta.env.VITE_SNAPCHAT_REDIRECT_URI;

    if (!clientId || !redirectURI) {
      setError('Missing Snapchat config');
      return;
    }

    try {
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
          try {
            const result = await window.snap!.loginkit.fetchUserInfo();
            const userInfo = result.data.me;
            
            addLog?.(`✅ Login success: ${userInfo.displayName}`);
            
            // For Push2Web, we need actual access token from backend
            const mockToken = `snap_${userInfo.externalId}_${Date.now()}`;
            onLogin(mockToken, userInfo);
          } catch (err) {
            const message = `Login failed: ${err}`;
            setError(message);
            onError?.(message);
          } finally {
            setIsLoading(false);
          }
        }
      });
      
      addLog?.('🔘 Login button mounted');
    } catch (err) {
      setError('Failed to mount login button');
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