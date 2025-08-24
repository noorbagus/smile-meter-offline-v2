// src/components/Push2WebManager.tsx - Complete Push2Web integration
import React, { useEffect, useState } from 'react';
import { useCameraContext } from '../context/CameraContext';

interface Push2WebManagerProps {
  onLensReceived?: (lensData: any) => void;
}

export const Push2WebManager: React.FC<Push2WebManagerProps> = ({ onLensReceived }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [push2WebStatus, setPush2WebStatus] = useState({
    available: false,
    subscribed: false,
    session: false,
    repository: false
  });

  const { 
    addLog, 
    subscribePush2Web, 
    getPush2WebStatus,
    isReady 
  } = useCameraContext();

  // Check for OAuth callback on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const state = urlParams.get('state');

    if (error) {
      setLoginError(`OAuth error: ${error}`);
      addLog(`❌ OAuth error: ${error}`);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (code && state) {
      addLog(`✅ OAuth callback received: code=${code.substring(0, 10)}...`);
      
      // Validate state
      const storedState = localStorage.getItem('snapchat_oauth_state');
      if (storedState !== state) {
        setLoginError('Invalid state parameter - possible CSRF attack');
        addLog(`❌ State mismatch: stored=${storedState}, received=${state}`);
        return;
      }

      // Exchange code for access token (requires backend)
      exchangeCodeForToken(code).then(token => {
        if (token) {
          setAccessToken(token);
          setIsLoggedIn(true);
          addLog(`✅ Access token obtained`);
          
          // Subscribe to Push2Web
          if (isReady) {
            subscribeToPush2Web(token);
          }
        }
      }).catch(err => {
        setLoginError(`Token exchange failed: ${err.message}`);
        addLog(`❌ Token exchange failed: ${err.message}`);
      });
      
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Update Push2Web status
    setPush2WebStatus(getPush2WebStatus());
  }, [addLog, isReady, getPush2WebStatus]);

  // Subscribe to Push2Web when camera is ready
  useEffect(() => {
    if (isReady && accessToken && !push2WebStatus.subscribed) {
      subscribeToPush2Web(accessToken);
    }
  }, [isReady, accessToken, push2WebStatus.subscribed]);

  // Mock token exchange (replace with real backend call)
  const exchangeCodeForToken = async (code: string): Promise<string | null> => {
    try {
      // In production, this should call your backend endpoint
      // For development, return a mock token
      if (import.meta.env.DEV) {
        addLog(`🧪 DEV: Using mock token for code ${code.substring(0, 10)}...`);
        return `mock_token_${Date.now()}`;
      }

      // Production: Call your backend
      const response = await fetch('/api/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          redirect_uri: window.location.origin // Main URL
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      addLog(`❌ Token exchange error: ${error}`);
      throw error;
    }
  };

  // Subscribe to Push2Web
  const subscribeToPush2Web = async (token: string) => {
    try {
      addLog('🔗 Subscribing to Push2Web...');
      const success = await subscribePush2Web(token);
      
      if (success) {
        setPush2WebStatus(getPush2WebStatus());
        addLog('✅ Push2Web subscription successful');
      } else {
        addLog('❌ Push2Web subscription failed');
      }
    } catch (error) {
      addLog(`❌ Push2Web subscription error: ${error}`);
    }
  };

  // Handle Snapchat login
  const handleSnapchatLogin = () => {
    setLoginError(null);

    const clientId = import.meta.env.VITE_SNAPCHAT_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_SNAPCHAT_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      setLoginError('Missing Snapchat configuration (CLIENT_ID or REDIRECT_URI)');
      addLog('❌ Missing Snapchat OAuth configuration');
      return;
    }

    // Generate and store state for CSRF protection
    const state = btoa(Math.random().toString()).substring(0, 12);
    localStorage.setItem('snapchat_oauth_state', state);

    // Build OAuth URL - redirect ke main app
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: window.location.origin, // Main URL
      response_type: 'code',
      scope: 'https://auth.snapchat.com/oauth2/api/user.display_name',
      state: state
    });

    const authUrl = `https://accounts.snapchat.com/accounts/oauth2/auth?${params}`;
    
    addLog(`🔐 Redirecting to Snapchat OAuth...`);
    window.location.href = authUrl;
  };

  // Mock login for development
  const handleMockLogin = async () => {
    const mockToken = `mock_token_${Date.now()}`;
    addLog(`🧪 Using mock token: ${mockToken}`);
    
    setAccessToken(mockToken);
    setIsLoggedIn(true);
    
    if (isReady) {
      await subscribeToPush2Web(mockToken);
    }
  };

  // Logout
  const handleLogout = () => {
    setAccessToken(null);
    setIsLoggedIn(false);
    localStorage.removeItem('snapchat_oauth_state');
    addLog('👋 Logged out from Snapchat');
  };

  return (
    <div className="space-y-4">
      {/* Login Status */}
      <div className="bg-black/20 rounded-lg p-4">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <span>👻</span>
          Push2Web Status
        </h3>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-white/70">Snapchat Login:</span>
            <span className={isLoggedIn ? 'text-green-400' : 'text-red-400'}>
              {isLoggedIn ? '✅ Connected' : '❌ Not connected'}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-white/70">Push2Web Available:</span>
            <span className={push2WebStatus.available ? 'text-green-400' : 'text-red-400'}>
              {push2WebStatus.available ? '✅ Ready' : '❌ Not ready'}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-white/70">Subscription:</span>
            <span className={push2WebStatus.subscribed ? 'text-green-400' : 'text-orange-400'}>
              {push2WebStatus.subscribed ? '✅ Subscribed' : '⏳ Waiting'}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-white/70">Camera Session:</span>
            <span className={push2WebStatus.session ? 'text-green-400' : 'text-orange-400'}>
              {push2WebStatus.session ? '✅ Ready' : '⏳ Initializing'}
            </span>
          </div>
        </div>
      </div>

      {/* Login/Logout Buttons */}
      {!isLoggedIn ? (
        <div className="space-y-3">
          <button
            onClick={handleSnapchatLogin}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg transition-colors"
          >
            <span>👻</span>
            <span>Login with Snapchat</span>
          </button>

          {import.meta.env.DEV && (
            <button
              onClick={handleMockLogin}
              className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
            >
              🧪 Mock Login (Dev Only)
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={handleLogout}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          👋 Logout
        </button>
      )}

      {/* Error Display */}
      {loginError && (
        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
          <div className="text-red-300 text-sm font-medium">Login Error</div>
          <div className="text-red-400 text-xs mt-1">{loginError}</div>
        </div>
      )}

      {/* Instructions */}
      <div className="text-xs text-white/60 space-y-2">
        <div className="bg-blue-500/10 rounded p-3">
          <p className="font-medium text-blue-300 mb-1">🎯 How to use Push2Web:</p>
          <ol className="space-y-1 pl-4">
            <li>1. Login with your Snapchat account</li>
            <li>2. Open Lens Studio with same account</li>
            <li>3. Click "Send to Camera Kit" in Lens Studio</li>
            <li>4. Lens will appear in this app automatically!</li>
          </ol>
        </div>
        
        {import.meta.env.DEV && (
          <div className="bg-orange-500/10 rounded p-3">
            <p className="font-medium text-orange-300 mb-1">🔧 Development Notes:</p>
            <ul className="space-y-1 pl-4 text-xs">
              <li>• Use mock login for testing</li>
              <li>• Real OAuth requires backend token exchange</li>
              <li>• Check VITE_SNAPCHAT_CLIENT_ID in .env</li>
              <li>• Only staging OAuth tokens supported</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};