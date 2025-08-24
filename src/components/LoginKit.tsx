// src/components/LoginKit.tsx - Proper OAuth Implementation
import React, { useEffect, useState } from 'react';

interface LoginKitProps {
  onLogin: (accessToken: string) => void;
  onError?: (error: string) => void;
  addLog?: (message: string) => void;
}

declare global {
  interface Window {
    snapKitInit?: () => void;
    snap?: {
      loginkit: {
        mountButton: (elementId: string, config: any, accessToken?: string) => void;
        fetchUserInfo: () => Promise<any>;
      };
    };
  }
}

export const LoginKit: React.FC<LoginKitProps> = ({ onLogin, addLog }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSDKReady, setIsSDKReady] = useState(false);

  // Load Snap Login Kit SDK
  useEffect(() => {
    const loadSDK = () => {
      // Check if SDK already loaded
      if (window.snap?.loginkit) {
        setIsSDKReady(true);
        return;
      }

      // Define callback for SDK initialization
      window.snapKitInit = () => {
        addLog?.('✅ Snap Login Kit SDK loaded');
        setIsSDKReady(true);
        mountLoginButton();
      };

      // Load SDK script
      const script = document.createElement('script');
      script.id = 'loginkit-sdk';
      script.src = 'https://sdk.snapkit.com/js/v1/login.js';
      script.async = true;
      script.onload = () => addLog?.('📦 Login Kit script loaded');
      script.onerror = () => setError('Failed to load Snap Login Kit SDK');

      document.head.appendChild(script);
    };

    loadSDK();

    return () => {
      // Cleanup
      const existingScript = document.getElementById('loginkit-sdk');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [addLog]);

  const mountLoginButton = () => {
    if (!window.snap?.loginkit) {
      addLog?.('❌ Snap Login Kit not available');
      return;
    }

    const clientId = import.meta.env.VITE_SNAPCHAT_CLIENT_ID;
    const redirectURI = import.meta.env.VITE_SNAPCHAT_REDIRECT_URI;

    if (!clientId || !redirectURI) {
      setError('Missing Snapchat configuration in environment');
      return;
    }

    addLog?.('🔗 Mounting Snap Login button...');

    try {
      window.snap.loginkit.mountButton('snap-login-button', {
        clientId: clientId,
        redirectURI: redirectURI,
        scopeList: [
          'user.display_name',
          'user.bitmoji.avatar', 
          'user.external_id'
        ],
        handleResponseCallback: handleLoginSuccess
      });

      addLog?.('✅ Login button mounted successfully');
    } catch (error) {
      addLog?.(`❌ Failed to mount login button: ${error}`);
      setError('Failed to setup login button');
    }
  };

  const handleLoginSuccess = async () => {
    setIsLoading(true);
    setError(null);
    addLog?.('🔐 Login callback triggered...');

    try {
      const result = await window.snap!.loginkit.fetchUserInfo();
      const userInfo = result.data.me;
      
      addLog?.(`✅ Login successful: ${userInfo.displayName}`);
      addLog?.(`👤 User ID: ${userInfo.externalId}`);
      
      // In real implementation, you'd get access token from backend
      // For now, we'll use a mock token with user info
      const mockAccessToken = `snap_token_${userInfo.externalId}_${Date.now()}`;
      
      onLogin(mockAccessToken);
      
    } catch (error) {
      addLog?.(`❌ Failed to fetch user info: ${error}`);
      setError('Failed to get user information');
    } finally {
      setIsLoading(false);
    }
  };

  // Re-mount button when SDK becomes ready
  useEffect(() => {
    if (isSDKReady) {
      mountLoginButton();
    }
  }, [isSDKReady]);

  return (
    <div className="space-y-4">
      {/* Login Button Container */}
      <div id="snap-login-button" className="min-h-[44px]">
        {!isSDKReady && (
          <div className="flex items-center justify-center p-3 bg-gray-600 rounded-lg">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            <span className="text-white text-sm">Loading Snapchat Login...</span>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg">
          <div className="text-blue-300 text-sm font-medium flex items-center">
            <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin mr-2" />
            Authenticating...
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
          <div className="text-red-300 text-sm font-medium">Login Error</div>
          <div className="text-red-400 text-xs mt-1">{error}</div>
        </div>
      )}

      {/* Development Info */}
      {import.meta.env.DEV && (
        <div className="text-xs text-white/60 space-y-1 p-3 bg-black/20 rounded">
          <p><strong>Dev Info:</strong></p>
          <p>• Client ID: {import.meta.env.VITE_SNAPCHAT_CLIENT_ID ? '✅ Set' : '❌ Missing'}</p>
          <p>• Redirect URI: {import.meta.env.VITE_SNAPCHAT_REDIRECT_URI ? '✅ Set' : '❌ Missing'}</p>
          <p>• SDK Ready: {isSDKReady ? '✅' : '⏳'}</p>
        </div>
      )}
    </div>
  );
};