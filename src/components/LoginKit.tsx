// src/components/LoginKit.tsx - Clean & Simple
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
  const [sdkReady, setSdkReady] = useState(false);

  const clientId = import.meta.env.VITE_SNAPCHAT_CLIENT_ID;
  const redirectURI = import.meta.env.VITE_SNAPCHAT_REDIRECT_URI;

  // Load SDK
  useEffect(() => {
    if (window.snap?.loginkit) {
      setSdkReady(true);
      mountButton();
      return;
    }

    window.snapKitInit = () => {
      addLog?.('SDK loaded');
      setSdkReady(true);
      mountButton();
    };

    const script = document.createElement('script');
    script.src = 'https://sdk.snapkit.com/js/v1/login.js';
    script.onload = () => addLog?.('SDK script loaded');
    script.onerror = () => setError('SDK load failed');
    document.head.appendChild(script);

    return () => document.getElementById('loginkit-sdk')?.remove();
  }, []);

  // Listen for messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'SNAPCHAT_OAUTH_SUCCESS') {
        onLogin(event.data.access_token, event.data.user_info);
        setIsLoading(false);
      } else if (event.data.type === 'SNAPCHAT_OAUTH_ERROR') {
        setError(event.data.error);
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLogin]);

  const mountButton = () => {
    if (!window.snap?.loginkit || !clientId || !redirectURI) {
      setError('Missing config or SDK');
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
          setIsLoading(true);
          try {
            const result = await window.snap!.loginkit.fetchUserInfo();
            const userInfo = result.data.me;
            onLogin(`mock_${userInfo.externalId}_${Date.now()}`, userInfo);
          } catch (err) {
            setError('Login failed');
          } finally {
            setIsLoading(false);
          }
        }
      });
      addLog?.('Button mounted');
    } catch (err) {
      setError('Mount failed');
    }
  };

  return (
    <div className="space-y-4">
      <div id="snap-login-button" className="min-h-[44px]">
        {!sdkReady && (
          <div className="p-3 bg-gray-600 rounded-lg text-center">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-white text-sm">Loading Snapchat SDK...</span>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="p-3 bg-blue-500/20 rounded-lg">
          <div className="text-blue-300 text-sm">Authenticating...</div>
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
      </div>
    </div>
  );
};