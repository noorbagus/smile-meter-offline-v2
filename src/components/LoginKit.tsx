// src/components/LoginKit.tsx - Single OAuth login with debug
import React, { useEffect, useState } from 'react';

interface LoginKitProps {
  onLogin: (accessToken: string, userInfo?: any) => void;
  onError?: (error: string) => void;
  addLog?: (message: string) => void;
}

export const LoginKit: React.FC<LoginKitProps> = ({ onLogin, onError, addLog }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listen for OAuth messages from popup
  useEffect(() => {
    const messageListener = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      addLog?.(`📨 Message: ${event.data.type}`);

      if (event.data.type === 'SNAPCHAT_OAUTH_SUCCESS') {
        const { access_token, user_info } = event.data;
        addLog?.(`✅ Token received: ${access_token?.substring(0, 20)}...`);
        onLogin(access_token, user_info);
        setIsLoading(false);
        setError(null);
      } else if (event.data.type === 'SNAPCHAT_OAUTH_ERROR') {
        setError(`OAuth error: ${event.data.error}`);
        setIsLoading(false);
      }
    };

    window.addEventListener('message', messageListener);
    return () => window.removeEventListener('message', messageListener);
  }, [onLogin, addLog]);

  // Check sessionStorage fallback
  useEffect(() => {
    const checkResult = () => {
      const result = sessionStorage.getItem('snap_oauth_result');
      if (result) {
        const data = JSON.parse(result);
        addLog?.('📦 SessionStorage token found');
        onLogin(data.access_token, data.user_info);
        sessionStorage.removeItem('snap_oauth_result');
      }
    };

    const interval = setInterval(checkResult, 1000);
    return () => clearInterval(interval);
  }, [onLogin, addLog]);

  const handleLogin = () => {
    setIsLoading(true);
    setError(null);
    
    const clientId = import.meta.env.VITE_SNAPCHAT_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_SNAPCHAT_REDIRECT_URI || `${window.location.origin}/oauth-callback`;

    if (!clientId) {
      setError('Missing CLIENT_ID');
      setIsLoading(false);
      return;
    }

    const state = btoa(Math.random().toString()).substring(0, 12);
    sessionStorage.setItem('snapchat_oauth_state', state);

    const scopes = [
      'https://auth.snapchat.com/oauth2/api/user.display_name',
      'https://auth.snapchat.com/oauth2/api/user.bitmoji.avatar',
      'https://auth.snapchat.com/oauth2/api/user.external_id'
    ].join(' ');

    const authUrl = `https://accounts.snapchat.com/accounts/oauth2/auth?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      state: state
    })}`;
    
    addLog?.(`🚀 Opening popup: ${redirectUri}`);

    const popup = window.open(authUrl, 'snapchat-oauth', 'width=500,height=600');
    
    if (!popup) {
      setError('Popup blocked');
      setIsLoading(false);
      return;
    }

    // Monitor popup close
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        if (isLoading) {
          setError('Login cancelled');
          setIsLoading(false);
        }
      }
    }, 1000);
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleLogin}
        disabled={isLoading}
        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-600 text-black font-semibold rounded-lg transition-colors"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            <span>Connecting...</span>
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
          <div className="text-red-300 text-sm">{error}</div>
        </div>
      )}

      {import.meta.env.DEV && (
        <div className="text-xs text-white/60 p-3 bg-black/20 rounded">
          <p>Redirect: {import.meta.env.VITE_SNAPCHAT_REDIRECT_URI || `${window.location.origin}/oauth-callback`}</p>
        </div>
      )}
    </div>
  );
};