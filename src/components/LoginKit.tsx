// src/components/LoginKit.tsx - Updated untuk Push2Web
import React, { useEffect, useState } from 'react';

interface LoginKitProps {
  onLogin: (accessToken: string) => void;
  onError?: (error: string) => void;
}

export const LoginKit: React.FC<LoginKitProps> = ({ onLogin, onError }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const state = urlParams.get('state');

    if (error) {
      const errorMsg = `OAuth error: ${error}`;
      setError(errorMsg);
      onError?.(errorMsg);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (code && state) {
      console.log('OAuth callback received:', { code, state });
      // Exchange code for token (requires backend)
      exchangeCodeForToken(code, state);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [onLogin, onError]);

  const exchangeCodeForToken = async (code: string, state: string) => {
    try {
      setIsLoading(true);
      
      // This would be your backend endpoint
      const response = await fetch('/api/snapchat/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state })
      });

      const data = await response.json();
      
      if (data.access_token) {
        onLogin(data.access_token);
      } else {
        throw new Error('No access token received');
      }
    } catch (err) {
      const errorMsg = `Token exchange failed: ${err}`;
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

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

    // PASTIKAN redirect_uri adalah HTTPS
    if (!redirectUri.startsWith('https://')) {
      setError('Redirect URI must use HTTPS');
      setIsLoading(false);
      return;
    }

    // Generate secure state
    const state = btoa(Math.random().toString()).substring(0, 12);
    localStorage.setItem('snapchat_oauth_state', state);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      // PERBAIKAN: Gunakan scope tanpa full URI
      scope: 'user.display_name user.bitmoji.avatar user.external_id',
      state: state
    });

    const authUrl = `https://accounts.snapchat.com/accounts/oauth2/auth?${params}`;
    window.location.href = authUrl;
  };

  const handleMockLogin = () => {
    const mockToken = `mock_token_${Date.now()}`;
    console.log('Using mock token for development:', mockToken);
    onLogin(mockToken);
  };

  return (
    <div className="space-y-3">
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

      {import.meta.env.DEV && (
        <button
          onClick={handleMockLogin}
          className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
        >
          🧪 Mock Login (Dev Only)
        </button>
      )}

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
          <div className="text-red-300 text-sm font-medium">Login Error</div>
          <div className="text-red-400 text-xs mt-1">{error}</div>
        </div>
      )}

      {/* PENTING: Troubleshooting checklist */}
      <div className="text-xs text-white/60 space-y-1">
        <p><strong>Troubleshooting Checklist:</strong></p>
        <p>✅ Redirect URI menggunakan HTTPS</p>
        <p>✅ Username ditambahkan sebagai Demo User</p>
        <p>✅ Scope tanpa full URI path</p>
        <p>✅ Client ID menggunakan staging credential</p>
      </div>
    </div>
  );
};