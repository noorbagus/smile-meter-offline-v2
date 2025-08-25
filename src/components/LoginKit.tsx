// src/components/LoginKit.tsx - Simplified OAuth Redirect in React
import React, { useEffect, useState } from 'react';

interface LoginKitProps {
  onLogin: (accessToken: string, userInfo?: any) => void;
  onError?: (error: string) => void;
  addLog?: (message: string) => void;
}

export const LoginKit: React.FC<LoginKitProps> = ({ onLogin, onError, addLog }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle OAuth redirect login (same window)
  const handleOAuthLogin = () => {
    setIsLoading(true);
    setError(null);
    
    const clientId = import.meta.env.VITE_SNAPCHAT_CLIENT_ID;
    const redirectUri = window.location.origin; // Main app URL

    if (!clientId) {
      setError('Missing Snapchat CLIENT_ID');
      setIsLoading(false);
      return;
    }

    // Generate state for CSRF protection
    const state = btoa(Math.random().toString()).substring(0, 12);
    sessionStorage.setItem('snapchat_oauth_state', state);

    // Full URL scopes
    const scopes = [
      'https://auth.snapchat.com/oauth2/api/user.display_name',
      'https://auth.snapchat.com/oauth2/api/user.bitmoji.avatar',
      'https://auth.snapchat.com/oauth2/api/user.external_id'
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      state: state
    });

    const authUrl = `https://accounts.snapchat.com/accounts/oauth2/auth?${params}`;
    
    addLog?.(`🔐 Redirecting to Snapchat OAuth...`);
    addLog?.(`📋 Redirect URI: ${redirectUri}`);
    
    // Direct redirect to OAuth (same window)
    window.location.href = authUrl;
  };

  // Exchange code for token
  const exchangeCodeForToken = async (code: string) => {
    try {
      addLog?.(`🔄 Exchanging code for token...`);

      if (import.meta.env.DEV) {
        // Mock for development
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mockToken = `mock_access_token_${Date.now()}`;
        const mockUser = {
          displayName: 'Dev User',
          externalId: `dev_user_${Date.now()}`,
          bitmoji: { avatar: '' }
        };
        
        addLog?.(`✅ Mock token: ${mockToken.substring(0, 20)}...`);
        onLogin(mockToken, mockUser);
        setIsLoading(false);
        return;
      }

      // Production: Call backend
      const response = await fetch('/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          redirect_uri: window.location.origin,
          client_id: import.meta.env.VITE_SNAPCHAT_CLIENT_ID,
          grant_type: 'authorization_code'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.access_token) {
        addLog?.(`✅ Access token obtained`);
        onLogin(data.access_token, data.user_info);
      } else {
        throw new Error('No access token received');
      }

    } catch (error) {
      const message = `Token exchange failed: ${error}`;
      addLog?.(`❌ ${message}`);
      setError(message);
      onError?.(message);
    } finally {
      setIsLoading(false);
      sessionStorage.removeItem('snapchat_oauth_state');
    }
  };

  // Check for OAuth callback on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const state = urlParams.get('state');

    if (error) {
      const errorMsg = `OAuth error: ${error}`;
      setError(errorMsg);
      onError?.(errorMsg);
      addLog?.(`❌ ${errorMsg}`);
      
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (code && state) {
      addLog?.(`✅ OAuth callback received: ${code.substring(0, 10)}...`);
      
      // Validate state (CSRF protection)
      const storedState = sessionStorage.getItem('snapchat_oauth_state');
      if (storedState !== state) {
        const errorMsg = 'Invalid state - security error';
        setError(errorMsg);
        addLog?.(`❌ ${errorMsg}`);
        return;
      }

      setIsLoading(true);
      exchangeCodeForToken(code);
      
      // Clean URL after processing
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [addLog, onLogin, onError]);

  return (
    <div className="space-y-4">
      <button
        onClick={handleOAuthLogin}
        disabled={isLoading}
        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-600 text-black font-semibold rounded-lg transition-colors"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            <span>Authenticating...</span>
          </>
        ) : (
          <>
            <span>👻</span>
            <span>Login with Snapchat</span>
          </>
        )}
      </button>

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
          <div className="text-red-300 text-sm font-medium">Error</div>
          <div className="text-red-400 text-xs mt-1">{error}</div>
        </div>
      )}

      {import.meta.env.DEV && (
        <div className="text-xs text-white/60 p-3 bg-black/20 rounded">
          <p><strong>OAuth Config:</strong></p>
          <p>• Client ID: {import.meta.env.VITE_SNAPCHAT_CLIENT_ID ? '✅' : '❌'}</p>
          <p>• Redirect: {window.location.origin}</p>
          <p>• Scopes: display_name, bitmoji, external_id</p>
        </div>
      )}
    </div>
  );
};