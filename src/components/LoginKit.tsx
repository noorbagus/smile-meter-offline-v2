// src/components/LoginKit.tsx - Complete OAuth implementation for Push2Web
import React, { useEffect, useState } from 'react';

interface LoginKitProps {
  onLogin: (accessToken: string) => void;
  onError?: (error: string) => void;
  addLog: (message: string) => void;
}

interface SnapchatUserInfo {
  displayName: string;
  externalId: string;
  bitmoji?: {
    avatar: string;
  };
}

export const LoginKit: React.FC<LoginKitProps> = ({ onLogin, onError, addLog }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<SnapchatUserInfo | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check for OAuth callback on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    const state = urlParams.get('state');

    if (error) {
      const errorMsg = `OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`;
      setError(errorMsg);
      onError?.(errorMsg);
      addLog(`❌ OAuth error: ${errorMsg}`);
      
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (accessToken && state) {
      addLog(`✅ OAuth callback received with access token`);
      
      // Validate state parameter
      const storedState = sessionStorage.getItem('snapchat_oauth_state');
      if (storedState && storedState === state) {
        addLog(`✅ State validation successful`);
        handleAccessToken(accessToken);
      } else {
        const stateError = 'Invalid state parameter - possible CSRF attack';
        setError(stateError);
        onError?.(stateError);
        addLog(`❌ ${stateError}`);
      }
      
      // Clean URL and session storage
      window.history.replaceState({}, '', window.location.pathname);
      sessionStorage.removeItem('snapchat_oauth_state');
    }
  }, [onLogin, onError, addLog]);

  // Handle received access token
  const handleAccessToken = async (accessToken: string) => {
    try {
      setIsLoading(true);
      addLog('📱 Fetching user info with access token...');
      
      // Fetch user info from Snapchat API
      const userInfo = await fetchSnapchatUserInfo(accessToken);
      
      if (userInfo) {
        setUserInfo(userInfo);
        setIsLoggedIn(true);
        addLog(`✅ Login successful: ${userInfo.displayName}`);
        onLogin(accessToken);
      } else {
        throw new Error('Failed to fetch user info');
      }
      
    } catch (error) {
      const errorMsg = `Failed to process access token: ${error}`;
      setError(errorMsg);
      onError?.(errorMsg);
      addLog(`❌ ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch user information from Snapchat API
  const fetchSnapchatUserInfo = async (accessToken: string): Promise<SnapchatUserInfo | null> => {
    try {
      const response = await fetch('https://kit.snapchat.com/v1/me?query={me{displayName,externalId,bitmoji{avatar}}}', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data?.me || null;
      
    } catch (error) {
      addLog(`❌ Failed to fetch user info: ${error}`);
      return null;
    }
  };

  // Start OAuth login flow
  const handleLogin = () => {
    setIsLoading(true);
    setError(null);

    const clientId = import.meta.env.VITE_SNAPCHAT_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_SNAPCHAT_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      const configError = 'Missing Snapchat OAuth configuration';
      setError(configError);
      onError?.(configError);
      addLog(`❌ ${configError}`);
      setIsLoading(false);
      return;
    }

    // Generate state parameter for security
    const state = btoa(Math.random().toString()).substring(0, 16);
    sessionStorage.setItem('snapchat_oauth_state', state);

    // OAuth parameters
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'token', // Implicit flow for client-side
      scope: 'https://auth.snapchat.com/oauth2/api/user.display_name https://auth.snapchat.com/oauth2/api/user.external_id https://auth.snapchat.com/oauth2/api/user.bitmoji.avatar',
      state: state
    });

    const authUrl = `https://accounts.snapchat.com/accounts/oauth2/auth?${params}`;
    
    addLog('🚀 Starting Snapchat OAuth flow...');
    addLog(`📱 Redirect URI: ${redirectUri}`);
    
    // Redirect to Snapchat OAuth
    window.location.href = authUrl;
  };

  // Logout function
  const handleLogout = () => {
    setUserInfo(null);
    setIsLoggedIn(false);
    setError(null);
    
    // Clear any stored tokens
    sessionStorage.removeItem('snapchat_access_token');
    sessionStorage.removeItem('snapchat_oauth_state');
    
    addLog('👋 Logged out from Snapchat');
  };

  // Mock login for development
  const handleMockLogin = () => {
    const mockToken = `mock_snapchat_token_${Date.now()}`;
    const mockUser: SnapchatUserInfo = {
      displayName: 'Test User',
      externalId: 'mock_external_id',
      bitmoji: {
        avatar: 'https://via.placeholder.com/100x100?text=👻'
      }
    };
    
    setUserInfo(mockUser);
    setIsLoggedIn(true);
    addLog('🧪 Mock login successful for development');
    onLogin(mockToken);
  };

  // If already logged in, show user info
  if (isLoggedIn && userInfo) {
    return (
      <div className="space-y-4">
        {/* User Info Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-4">
          <div className="flex items-center space-x-3">
            {userInfo.bitmoji?.avatar && (
              <img 
                src={userInfo.bitmoji.avatar} 
                alt="Bitmoji" 
                className="w-12 h-12 rounded-full"
              />
            )}
            <div>
              <div className="text-white font-medium">👻 {userInfo.displayName}</div>
              <div className="text-white/60 text-sm">Connected to Push2Web</div>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm rounded-lg transition-colors"
        >
          Logout
        </button>

        {/* Push2Web Status */}
        <div className="text-xs text-white/60 bg-green-500/20 border border-green-500/30 rounded-lg p-3">
          <div className="text-green-300 font-medium mb-1">🔗 Push2Web Ready</div>
          <div>• Login to Lens Studio with same account</div>
          <div>• Send lens via "Send to Camera Kit"</div>
          <div>• Lens will appear automatically here</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main login button */}
      <button
        onClick={handleLogin}
        disabled={isLoading}
        className="w-full flex items-center justify-center space-x-3 px-4 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <span>👻</span>
            <span>Login with Snapchat</span>
          </>
        )}
      </button>

      {/* Development mock button */}
      {import.meta.env.DEV && (
        <button
          onClick={handleMockLogin}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          🧪 Mock Login (Dev Only)
        </button>
      )}

      {/* Error display */}
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
          <div className="text-red-300 text-sm font-medium">Login Error</div>
          <div className="text-red-400 text-xs mt-1">{error}</div>
        </div>
      )}

      {/* Instructions */}
      <div className="text-xs text-white/60 bg-black/20 rounded-lg p-3 space-y-1">
        <p><strong>Push2Web Setup:</strong></p>
        <p>1. Login with your Snapchat account</p>
        <p>2. Login to Lens Studio with same account</p>
        <p>3. Send lens via "Send to Camera Kit"</p>
        <p>4. Lens will appear automatically!</p>
      </div>

      {/* Technical info */}
      <details className="text-xs text-white/50">
        <summary className="cursor-pointer hover:text-white/70">Technical Details</summary>
        <div className="mt-2 p-2 bg-black/30 rounded">
          <p>Client ID: {import.meta.env.VITE_SNAPCHAT_CLIENT_ID?.substring(0, 20)}...</p>
          <p>Redirect: {import.meta.env.VITE_SNAPCHAT_REDIRECT_URI}</p>
          <p>Flow: OAuth 2.0 Implicit Grant</p>
          <p>Scopes: display_name, external_id, bitmoji.avatar</p>
        </div>
      </details>
    </div>
  );
};