// src/components/LoginKit.tsx - Official Snapchat Login Kit SDK
import React, { useEffect, useState } from 'react';

interface LoginKitProps {
  onLogin: (accessToken: string, userInfo: any) => void;
  onError?: (error: string) => void;
}

interface SnapchatUserInfo {
  displayName: string;
  externalId: string;
  bitmoji?: {
    avatar: string;
  };
}

declare global {
  interface Window {
    snapKitInit: () => void;
    snap: {
      loginkit: {
        mountButton: (
          elementId: string, 
          options: {
            clientId: string;
            redirectURI: string;
            scopeList: string[];
            handleResponseCallback: () => void;
          }
        ) => void;
        fetchUserInfo: () => Promise<{
          data: {
            me: SnapchatUserInfo;
          };
        }>;
      };
    };
  }
}

export const LoginKit: React.FC<LoginKitProps> = ({ onLogin, onError }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);

  useEffect(() => {
    // Load Snapchat Login Kit SDK
    const loadSDK = () => {
      if (document.getElementById('loginkit-sdk')) {
        setIsSDKLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.id = 'loginkit-sdk';
      script.src = 'https://sdk.snapkit.com/js/v1/login.js';
      script.async = true;
      script.onload = () => {
        setIsSDKLoaded(true);
      };
      script.onerror = () => {
        setError('Failed to load Snapchat SDK');
        onError?.('Failed to load Snapchat SDK');
      };

      document.head.appendChild(script);
    };

    // Initialize when SDK is ready
    window.snapKitInit = function() {
      try {
        const clientId = import.meta.env.VITE_SNAPCHAT_CLIENT_ID;
        const redirectURI = import.meta.env.VITE_SNAPCHAT_REDIRECT_URI;

        if (!clientId || !redirectURI) {
          throw new Error('Missing Snapchat configuration');
        }

        window.snap.loginkit.mountButton('snapchat-login-button', {
          clientId: clientId,
          redirectURI: redirectURI,
          scopeList: [
            'user.display_name',
            'user.external_id'
          ],
          handleResponseCallback: async function() {
            setIsLoading(true);
            setError(null);

            try {
              const result = await window.snap.loginkit.fetchUserInfo();
              const userInfo = result.data.me;
              
              console.log('Snapchat user info:', userInfo);
              
              // For Push2Web, we need access token
              // In client-side flow, token is available in URL hash after redirect
              const urlParams = new URLSearchParams(window.location.hash.substring(1));
              const accessToken = urlParams.get('access_token');
              
              if (accessToken) {
                onLogin(accessToken, userInfo);
              } else {
                throw new Error('No access token received');
              }
              
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : 'Login failed';
              setError(errorMsg);
              onError?.(errorMsg);
              console.error('Login error:', err);
            } finally {
              setIsLoading(false);
            }
          }
        });

        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'SDK initialization failed';
        setError(errorMsg);
        onError?.(errorMsg);
      }
    };

    loadSDK();

    return () => {
      // Cleanup
      window.snapKitInit = () => {};
    };
  }, [onLogin, onError]);

  // Handle OAuth callback from URL
  useEffect(() => {
    const handleOAuthCallback = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      const state = urlParams.get('state');

      if (error) {
        setError(`OAuth error: ${error}`);
        onError?.(`OAuth error: ${error}`);
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

      if (code && state) {
        // Authorization code received - this would need server-side exchange
        console.log('Authorization code received:', { code, state });
        setError('Authorization code flow not implemented - using client-side flow');
        
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    };

    handleOAuthCallback();
  }, [onError]);

  return (
    <div className="space-y-4">
      {/* Login Button Container */}
      <div
        id="snapchat-login-button"
        className={`${!isSDKLoaded ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {!isSDKLoaded && (
          <button
            disabled
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-yellow-400/50 text-black font-semibold rounded-lg"
          >
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            <span>Loading Snapchat SDK...</span>
          </button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center space-x-2 text-white/80 text-sm">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>Authenticating...</span>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
          <div className="text-red-300 text-sm font-medium">Login Error</div>
          <div className="text-red-400 text-xs mt-1">{error}</div>
        </div>
      )}

      {/* Development Mock Button */}
      {import.meta.env.DEV && (
        <button
          onClick={() => {
            const mockToken = `mock_token_${Date.now()}`;
            const mockUser = {
              displayName: 'Test User',
              externalId: 'test_123'
            };
            console.log('Using mock login for development');
            onLogin(mockToken, mockUser);
          }}
          className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
        >
          🧪 Mock Login (Dev)
        </button>
      )}

      {/* Instructions */}
      <div className="text-xs text-white/60 space-y-1">
        <p><strong>For Push2Web:</strong></p>
        <p>• Login with same Snapchat account used in Lens Studio</p>
        <p>• Account must be in Demo Users list</p>
        <p>• After login, you can receive lenses from Lens Studio</p>
      </div>
    </div>
  );
};