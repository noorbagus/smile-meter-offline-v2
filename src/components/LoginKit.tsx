// src/components/LoginKit.tsx - Fixed DOM timing
import React, { useEffect, useState, useRef } from 'react';

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
  const [sdkReady, setSdkReady] = useState(false);
  const [buttonMounted, setButtonMounted] = useState(false);
  const mountAttempted = useRef(false);

  const clientId = import.meta.env.VITE_SNAPCHAT_CLIENT_ID;
  const redirectURI = import.meta.env.VITE_SNAPCHAT_REDIRECT_URI;

  // Load SDK
  useEffect(() => {
    if (window.snap?.loginkit) {
      setSdkReady(true);
      return;
    }

    window.snapKitInit = () => {
      addLog?.('SDK loaded');
      setSdkReady(true);
    };

    const script = document.createElement('script');
    script.src = 'https://sdk.snapkit.com/js/v1/login.js';
    script.onload = () => addLog?.('SDK script loaded');
    script.onerror = () => {
      setTimeout(() => setError('SDK load failed'), 100);
    };
    document.head.appendChild(script);

    return () => document.getElementById('loginkit-sdk')?.remove();
  }, [addLog]);

  // Mount button when SDK ready
  useEffect(() => {
    if (sdkReady && !mountAttempted.current) {
      mountAttempted.current = true;
      
      // Delay mounting to ensure DOM is ready
      setTimeout(() => {
        mountButton();
      }, 100);
    }
  }, [sdkReady]);

  // Listen for OAuth messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'SNAPCHAT_OAUTH_SUCCESS') {
        addLog?.('OAuth success via postMessage');
        onLogin(event.data.access_token, event.data.user_info);
        setIsLoading(false);
        setError(null);
      } else if (event.data.type === 'SNAPCHAT_OAUTH_ERROR') {
        addLog?.(`OAuth error: ${event.data.error}`);
        setError(`OAuth error: ${event.data.error}`);
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLogin, addLog]);

  const mountButton = () => {
    if (!window.snap?.loginkit) {
      setTimeout(() => setError('SDK not available'), 100);
      return;
    }

    if (!clientId || !redirectURI) {
      setTimeout(() => setError('Missing config'), 100);
      return;
    }

    try {
      window.snap.loginkit.mountButton('snap-login-button', {
        clientId,
        redirectURI,
        scopeList: [
          'user.display_name',
          'user.external_id',
          'user.bitmoji.avatar',
          'camkit_lens_push_to_device'
        ],
        handleResponseCallback: async () => {
          addLog?.('Login callback triggered');
          setIsLoading(true);
          setError(null);
          
          try {
            // Add delay before fetchUserInfo
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const result = await window.snap!.loginkit.fetchUserInfo();
            const userInfo = result?.data?.me;
            
            if (!userInfo) {
              throw new Error('No user info received');
            }
            
            addLog?.(`Login success: ${userInfo.displayName}`);
            const mockToken = `snap_${userInfo.externalId}_${Date.now()}`;
            onLogin(mockToken, userInfo);
            
          } catch (err: any) {
            addLog?.(`Login error: ${err?.message || err}`);
            // Delay error to prevent immediate override
            setTimeout(() => {
              setError('Authentication failed');
            }, 500);
          } finally {
            setIsLoading(false);
          }
        }
      });
      
      setButtonMounted(true);
      addLog?.('Button mounted successfully');
      
    } catch (err: any) {
      addLog?.(`Mount error: ${err?.message || err}`);
      setTimeout(() => setError('Button mount failed'), 100);
    }
  };

  // Show loading state while SDK loads and button mounts
  const showLoading = !sdkReady || (sdkReady && !buttonMounted && !error);

  return (
    <div className="space-y-4">
      <div id="snap-login-button" className="min-h-[44px]">
        {showLoading && (
          <div className="p-3 bg-gray-600 rounded-lg text-center">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-white text-sm">Loading Snapchat Login...</span>
          </div>
        )}
        
        {buttonMounted && !error && (
          <div className="text-center text-green-300 text-xs">
            Button ready - should appear above
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
        <div className="p-3 bg-red-500/20 rounded-lg">
          <div className="text-red-300 text-sm">{error}</div>
        </div>
      )}

      <div className="text-xs text-white/60 space-y-1">
        <div>Client ID: {clientId ? '✅' : '❌'}</div>
        <div>Redirect: {redirectURI ? '✅' : '❌'}</div>
        <div>SDK: {sdkReady ? '✅' : '⏳'}</div>
        <div>Button: {buttonMounted ? '✅' : '⏳'}</div>
      </div>
    </div>
  );
};