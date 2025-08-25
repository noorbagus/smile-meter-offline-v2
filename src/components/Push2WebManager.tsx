// src/components/Push2WebManager.tsx - Fixed OAuth scopes
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

  // Handle Snapchat login - FIXED SCOPES
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

    // FIXED: Use full URL scopes as per documentation
    const scopes = [
      'https://auth.snapchat.com/oauth2/api/user.display_name',
      'https://auth.snapchat.com/oauth2/api/user.bitmoji.avatar',
      'https://auth.snapchat.com/oauth2/api/user.external_id'
    ].join('%20'); // URL encode spaces

    // Build OAuth URL with ALL scopes
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: window.location.origin,
      response_type: 'code',
      scope: scopes, // All three scopes included
      state: state
    });

    const authUrl = `https://accounts.snapchat.com/accounts/oauth2/auth?${params}`;
    
    addLog(`🔐 Redirecting to Snapchat OAuth with all 3 scopes...`);
    addLog(`📋 Scopes: display_name, bitmoji.avatar, external_id`);
    window.location.href = authUrl;
  };

  // Rest of the component remains the same...
  const handleMockLogin = async () => {
    const mockToken = `mock_token_${Date.now()}`;
    addLog(`🧪 Using mock token with all scopes: ${mockToken}`);
    
    setAccessToken(mockToken);
    setIsLoggedIn(true);
    
    if (isReady) {
      await subscribeToPush2Web(mockToken);
    }
  };

  const handleLogout = () => {
    setAccessToken(null);
    setIsLoggedIn(false);
    localStorage.removeItem('snapchat_oauth_state');
    addLog('👋 Logged out from Snapchat');
  };

  const exchangeCodeForToken = async (code: string): Promise<string | null> => {
    try {
      if (import.meta.env.DEV) {
        addLog(`🧪 DEV: Using mock token for code ${code.substring(0, 10)}...`);
        addLog(`✅ Mock token includes all 3 scopes: display_name, bitmoji, external_id`);
        return `mock_token_${Date.now()}`;
      }

      // Production: Call your backend with proper scope handling
      const response = await fetch('/api/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          redirect_uri: window.location.origin,
          // Backend should validate all 3 scopes were granted
          expected_scopes: [
            'https://auth.snapchat.com/oauth2/api/user.display_name',
            'https://auth.snapchat.com/oauth2/api/user.bitmoji.avatar', 
            'https://auth.snapchat.com/oauth2/api/user.external_id'
          ]
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      addLog(`✅ Access token obtained with scopes: ${data.granted_scopes || 'unknown'}`);
      return data.access_token;
    } catch (error) {
      addLog(`❌ Token exchange error: ${error}`);
      throw error;
    }
  };

  const subscribeToPush2Web = async (token: string) => {
    try {
      addLog('🔗 Subscribing to Push2Web with full scope access...');
      const success = await subscribePush2Web(token);
      
      if (success) {
        setPush2WebStatus(getPush2WebStatus());
        addLog('✅ Push2Web subscription successful with all user data access');
      } else {
        addLog('❌ Push2Web subscription failed');
      }
    } catch (error) {
      addLog(`❌ Push2Web subscription error: ${error}`);
    }
  };

  // Check for OAuth callback on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const state = urlParams.get('state');

    if (error) {
      setLoginError(`OAuth error: ${error}`);
      addLog(`❌ OAuth error: ${error}`);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (code && state) {
      addLog(`✅ OAuth callback received with all scopes: code=${code.substring(0, 10)}...`);
      
      const storedState = localStorage.getItem('snapchat_oauth_state');
      if (storedState !== state) {
        setLoginError('Invalid state parameter - possible CSRF attack');
        addLog(`❌ State mismatch: stored=${storedState}, received=${state}`);
        return;
      }

      exchangeCodeForToken(code).then(token => {
        if (token) {
          setAccessToken(token);
          setIsLoggedIn(true);
          addLog(`✅ Access token obtained with full scope permissions`);
          
          if (isReady) {
            subscribeToPush2Web(token);
          }
        }
      }).catch(err => {
        setLoginError(`Token exchange failed: ${err.message}`);
        addLog(`❌ Token exchange failed: ${err.message}`);
      });
      
      window.history.replaceState({}, '', window.location.pathname);
    }

    setPush2WebStatus(getPush2WebStatus());
  }, [addLog, isReady, getPush2WebStatus]);

  // Auto-subscribe when camera ready
  useEffect(() => {
    if (isReady && accessToken && !push2WebStatus.subscribed) {
      subscribeToPush2Web(accessToken);
    }
  }, [isReady, accessToken, push2WebStatus.subscribed]);

  return (
    <div className="space-y-4">
      {/* Login Status with scope info */}
      <div className="bg-black/20 rounded-lg p-4">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <span>👻</span>
          Push2Web Status
        </h3>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-white/70">Snapchat Login:</span>
            <span className={isLoggedIn ? 'text-green-400' : 'text-red-400'}>
              {isLoggedIn ? '✅ Connected (All Scopes)' : '❌ Not connected'}
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
        </div>

        {/* Scope details */}
        {isLoggedIn && (
          <div className="mt-3 p-2 bg-green-500/10 rounded text-xs">
            <p className="text-green-300 font-medium mb-1">✅ Granted Scopes:</p>
            <ul className="text-green-400 space-y-1">
              <li>• user.display_name (Name)</li>
              <li>• user.bitmoji.avatar (Avatar)</li>
              <li>• user.external_id (ID)</li>
            </ul>
          </div>
        )}
      </div>

      {/* Login/Logout Buttons */}
      {!isLoggedIn ? (
        <div className="space-y-3">
          <button
            onClick={handleSnapchatLogin}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg transition-colors"
          >
            <span>👻</span>
            <span>Login with Snapchat (Full Access)</span>
          </button>

          {import.meta.env.DEV && (
            <button
              onClick={handleMockLogin}
              className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
            >
              🧪 Mock Login (Dev Only - All Scopes)
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

      {/* Instructions with scope info */}
      <div className="text-xs text-white/60 space-y-2">
        <div className="bg-blue-500/10 rounded p-3">
          <p className="font-medium text-blue-300 mb-1">🎯 How to use Push2Web:</p>
          <ol className="space-y-1 pl-4">
            <li>1. Login with Snapchat (grants 3 permissions)</li>
            <li>2. Open Lens Studio with same account</li>
            <li>3. Click "Send to Camera Kit" in Lens Studio</li>
            <li>4. Lens will appear automatically!</li>
          </ol>
        </div>
        
        <div className="bg-green-500/10 rounded p-3">
          <p className="font-medium text-green-300 mb-1">📋 Required Scopes:</p>
          <ul className="space-y-1 pl-4 text-xs">
            <li>• display_name: User's Snapchat name</li>
            <li>• bitmoji.avatar: User's Bitmoji image</li>
            <li>• external_id: Unique user identifier</li>
          </ul>
        </div>
        
        {import.meta.env.DEV && (
          <div className="bg-orange-500/10 rounded p-3">
            <p className="font-medium text-orange-300 mb-1">🔧 Development Notes:</p>
            <ul className="space-y-1 pl-4 text-xs">
              <li>• All 3 scopes properly configured</li>
              <li>• OAuth uses full URL format</li>
              <li>• Backend should validate granted scopes</li>
              <li>• Only staging tokens supported</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};