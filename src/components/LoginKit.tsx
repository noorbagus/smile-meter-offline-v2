// src/components/LoginKit.tsx - Direct OAuth without SDK
import React, { useEffect, useState } from 'react';

interface LoginKitProps {
  onLogin: (accessToken: string) => void;
}

export const LoginKit: React.FC<LoginKitProps> = ({ onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for OAuth callback on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const state = urlParams.get('state');

    if (error) {
      setError(`OAuth error: ${error}`);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (code && state) {
      console.log('OAuth callback received:', { code, state });
      // In a real implementation, you'd exchange code for access token
      // For Push2Web testing, you might need a backend endpoint
      setError('Code received but token exchange not implemented');
      
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [onLogin]);

  const handleLogin = () => {
    setIsLoading(true);
    setError(null);

    const clientId = import.meta.env.VITE_SNAPCHAT_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_SNAPCHAT_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      setError('Missing Snapchat configuration');
      setIsLoading(false);
      return;
    }

    // Generate state parameter for security
    const state = btoa(Math.random().toString()).substring(0, 12);
    localStorage.setItem('snapchat_oauth_state', state);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://auth.snapchat.com/oauth2/api/user.display_name',
      state: state
    });

    const authUrl = `https://accounts.snapchat.com/accounts/oauth2/auth?${params}`;
    
    // Redirect to Snapchat OAuth
    window.location.href = authUrl;
  };

  // For development: Mock login with fake token
  const handleMockLogin = () => {
    const mockToken = `mock_token_${Date.now()}`;
    console.log('Using mock token for development:', mockToken);
    onLogin(mockToken);
  };

  return (
    <div className="space-y-3">
      {/* Main login button */}
      <button
        onClick={handleLogin}
        disabled={isLoading}
        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
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
          className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
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
      <div className="text-xs text-white/60 space-y-1">
        <p><strong>Note:</strong> OAuth flow requires backend token exchange</p>
        <p>• Click login → Authorize on Snapchat</p>
        <p>• Returns auth code (needs server conversion)</p>
        <p>• Use mock login for development testing</p>
      </div>
    </div>
  );
};