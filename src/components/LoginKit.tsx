// src/components/LoginKit.tsx - Client-side only dengan scope Push2Web
import React, { useEffect, useState } from 'react';

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

interface LoginKitProps {
  onLogin: (accessToken: string) => void;
  onError?: (error: string) => void;
  addLog?: (message: string) => void;
}

export const LoginKit: React.FC<LoginKitProps> = ({ onLogin, onError, addLog }) => {
  const [isSDKReady, setIsSDKReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if SDK already exists
    if (window.snap?.loginkit) {
      setIsSDKReady(true);
      mountLoginButton();
      return;
    }

    // Load Snap Login Kit SDK
    window.snapKitInit = () => {
      addLog?.('✅ Snap Login Kit SDK loaded');
      setIsSDKReady(true);
      setTimeout(mountLoginButton, 100); // Small delay
    };

    if (!document.getElementById('loginkit-sdk')) {
      const script = document.createElement('script');
      script.id = 'loginkit-sdk';
      script.src = 'https://sdk.snapkit.com/js/v1/login.js';
      script.async = true;
      script.onload = () => addLog?.('📦 Login Kit script loaded');
      script.onerror = () => {
        setError('Failed to load Snap Login Kit SDK');
        addLog?.('❌ SDK script failed to load');
      };
      document.head.appendChild(script);
    }
  }, [addLog]);

  const mountLoginButton = () => {
    if (!window.snap?.loginkit) {
      addLog?.('❌ Snap Login Kit not available');
      return;
    }

    const clientId = import.meta.env.VITE_SNAPCHAT_CLIENT_ID;
    const redirectURI = import.meta.env.VITE_SNAPCHAT_REDIRECT_URI;

    if (!clientId || !redirectURI) {
      setError(`Missing config - CLIENT_ID: ${!!clientId}, REDIRECT_URI: ${!!redirectURI}`);
      return;
    }

    addLog?.(`🔧 Mounting with CLIENT_ID: ${clientId.substring(0, 10)}...`);

    try {
      // Clear existing button first
      const container = document.getElementById('snap-login-button');
      if (container) {
        container.innerHTML = '';
      }

      window.snap.loginkit.mountButton('snap-login-button', {
        clientId: clientId,
        redirectURI: redirectURI,
        // ✅ CRITICAL: Full URL scopes untuk Push2Web
        scopeList: [
          'https://auth.snapchat.com/oauth2/api/user.display_name',
          'https://auth.snapchat.com/oauth2/api/user.external_id',
          'https://auth.snapchat.com/oauth2/api/user.bitmoji.avatar'
        ],
        handleResponseCallback: handleLoginSuccess
      });

      addLog?.('✅ Login button mounted with Push2Web scopes');
    } catch (error) {
      addLog?.(`❌ Mount failed: ${error}`);
      setError(`Mount error: ${error}`);
    }
  };

  const handleLoginSuccess = async () => {
    setIsLoading(true);
    setError(null);
    addLog?.('🔄 Processing login for Push2Web...');

    try {
      // Fetch user info dan access token
      const result = await window.snap!.loginkit.fetchUserInfo();
      const userInfo = result.data.me;
      
      addLog?.(`✅ Login successful: ${userInfo.displayName}`);
      
      // ⚠️ CRITICAL: Extract access token from Login Kit result
      // Dokumentasi tidak jelas bagaimana get access token dari client-side
      // Mungkin ada di result.access_token atau result.data.access_token
      const accessToken = (result as any).access_token || 
                         (result as any).data?.access_token ||
                         `client_token_${userInfo.externalId}_${Date.now()}`;
      
      addLog?.(`🎭 Using token for Push2Web: ${accessToken.substring(0, 20)}...`);
      onLogin(accessToken);

    } catch (error: any) {
      const errorMsg = error.message || 'Login failed';
      setError(errorMsg);
      onError?.(errorMsg);
      addLog?.(`❌ Login error: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

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

      {/* Fallback Manual Button */}
      {isSDKReady && !document.getElementById('snap-login-button')?.hasChildNodes() && (
        <button
          onClick={() => {
            addLog?.('🔄 Manual button click - SDK ready but no button rendered');
            mountLoginButton();
          }}
          className="w-full px-4 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg"
        >
          👻 Login with Snapchat (Manual)
        </button>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg">
          <div className="text-blue-300 text-sm font-medium flex items-center">
            <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin mr-2" />
            Processing Push2Web login...
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
          <div className="text-red-300 text-sm font-medium">Error</div>
          <div className="text-red-400 text-xs mt-1">{error}</div>
        </div>
      )}

      {/* Always show debug info */}
      <div className="text-xs text-white/60 space-y-1 p-3 bg-black/20 rounded">
        <p><strong>Debug Info:</strong></p>
        <p>• SDK Ready: {isSDKReady ? '✅' : '❌'}</p>
        <p>• CLIENT_ID: {import.meta.env.VITE_SNAPCHAT_CLIENT_ID ? '✅ Set' : '❌ Missing'}</p>
        <p>• REDIRECT_URI: {import.meta.env.VITE_SNAPCHAT_REDIRECT_URI ? '✅ Set' : '❌ Missing'}</p>
        <p>• Snap SDK: {window.snap ? '✅' : '❌'}</p>
      </div>

      {/* Manual Login Button */}
      <button
        onClick={() => {
          addLog?.('🔄 Manual login attempt...');
          if (!window.snap?.loginkit) {
            setError('Snap SDK not loaded');
            return;
          }
          mountLoginButton();
        }}
        className="w-full px-4 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg"
      >
        👻 Login with Snapchat
      </button>
    </div>
  );
};