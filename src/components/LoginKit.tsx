// src/components/LoginKit.tsx
import React, { useEffect, useRef } from 'react';

interface LoginKitProps {
  onLogin: (accessToken: string) => void;
  onError?: (error: string) => void;
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

export const LoginKit: React.FC<LoginKitProps> = ({ onLogin, onError }) => {
  const isInitialized = useRef(false);
  const buttonId = 'snapchat-login-button';

  useEffect(() => {
    if (isInitialized.current) return;

    const initializeSnapKit = () => {
      // Check if script already loaded
      if (window.snap?.loginkit) {
        mountLoginButton();
        return;
      }

      // Load Snap Kit SDK
      const script = document.createElement('script');
      script.src = 'https://sdk.snapkit.com/js/v1/login.js';
      script.id = 'snapkit-sdk';
      script.async = true;

      script.onload = () => {
        console.log('📱 Snap Kit SDK loaded');
        if (window.snapKitInit) {
          window.snapKitInit();
        }
      };

      script.onerror = () => {
        console.error('❌ Failed to load Snap Kit SDK');
        onError?.('Failed to load Snapchat SDK');
      };

      // Don't add duplicate scripts
      if (!document.getElementById('snapkit-sdk')) {
        document.head.appendChild(script);
      }
    };

    const mountLoginButton = () => {
      if (!window.snap?.loginkit) {
        console.warn('⚠️ Snap Kit not ready, retrying...');
        setTimeout(mountLoginButton, 500);
        return;
      }

      try {
        window.snap.loginkit.mountButton(buttonId, {
          clientId: import.meta.env.VITE_SNAPCHAT_CLIENT_ID,
          redirectURI: import.meta.env.VITE_SNAPCHAT_REDIRECT_URI,
          scopeList: [
            'user.display_name',
            'user.bitmoji.avatar'
          ],
          handleResponseCallback: async () => {
            try {
              console.log('📱 Snapchat login callback triggered');
              
              const result = await window.snap!.loginkit.fetchUserInfo();
              console.log('✅ User info fetched:', result.data.me.displayName);
              
              // Extract access token from result
              const accessToken = result.data.me.externalId || 'mock-token-for-development';
              
              onLogin(accessToken);
            } catch (error) {
              console.error('❌ Login callback error:', error);
              onError?.(`Login failed: ${error}`);
            }
          }
        });

        console.log('✅ Snapchat login button mounted');
        isInitialized.current = true;
      } catch (error) {
        console.error('❌ Failed to mount login button:', error);
        onError?.(`Button mount failed: ${error}`);
      }
    };

    // Set global callback
    window.snapKitInit = () => {
      console.log('🎉 Snap Kit initialized');
      mountLoginButton();
    };

    initializeSnapKit();

    // Cleanup
    return () => {
      const script = document.getElementById('snapkit-sdk');
      if (script) {
        script.remove();
      }
      delete window.snapKitInit;
    };
  }, [onLogin, onError]);

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20">
      <div className="text-white text-sm mb-3 text-center">
        <div className="text-lg mb-1">👨‍💻</div>
        <div className="font-medium">Developer Mode</div>
        <div className="text-xs text-white/60">Login for Push2Web</div>
      </div>
      
      <div
        id={buttonId}
        className="flex items-center justify-center min-h-[40px]"
      />
      
      <div className="text-xs text-white/50 mt-2 text-center">
        Connect with Lens Studio
      </div>
    </div>
  );
};