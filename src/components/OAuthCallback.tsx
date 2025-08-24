// src/components/OAuthCallback.tsx
import React, { useEffect, useState } from 'react';

export const OAuthCallback: React.FC = () => {
  const [status, setStatus] = useState('Processing login...');
  const [subStatus, setSubStatus] = useState('Please wait');

  useEffect(() => {
    const processOAuth = async () => {
      try {
        setStatus('Processing OAuth response...');
        setSubStatus('');

        const urlParams = new URLSearchParams(window.location.search);
        const hash = window.location.hash;

        // Check for error
        const error = urlParams.get('error');
        if (error) {
          setStatus('Login failed');
          setSubStatus(error);
          setTimeout(() => redirectToMain(), 2000);
          return;
        }

        // Parse token from hash
        if (hash && hash.includes('access_token')) {
          const hashParams = new URLSearchParams(hash.substring(1));
          
          const access_token = hashParams.get('access_token');
          const state = hashParams.get('state');
          const expires_in = hashParams.get('expires_in');

          if (!access_token) {
            throw new Error('No access token received');
          }

          // Validate state
          const storedState = localStorage.getItem('snapchat_oauth_state');
          if (storedState && storedState !== state) {
            throw new Error('Invalid state - security issue');
          }

          setStatus('Login successful!');
          setSubStatus('Connecting to Push2Web...');
          
          // Store token
          sessionStorage.setItem('snap_oauth_result', JSON.stringify({
            access_token,
            state,
            expires_in: parseInt(expires_in || '3600'),
            timestamp: Date.now()
          }));

          redirectToMain();
          return;
        }

        throw new Error('No authorization data received');

      } catch (error) {
        console.error('OAuth error:', error);
        setStatus('Login failed');
        setSubStatus(error instanceof Error ? error.message : 'Unknown error');
        
        sessionStorage.setItem('snap_oauth_error', 
          error instanceof Error ? error.message : 'OAuth failed'
        );
        
        setTimeout(() => redirectToMain(), 3000);
      }
    };

    const redirectToMain = () => {
      setStatus('Redirecting...');
      setSubStatus('Taking you back to the app');
      setTimeout(() => {
        window.location.href = window.location.origin;
      }, 1000);
    };

    processOAuth();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 flex items-center justify-center">
      <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl border border-white/20 text-center">
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <div className="text-white text-lg mb-2">{status}</div>
        <div className="text-white/80 text-sm">{subStatus}</div>
      </div>
    </div>
  );
};