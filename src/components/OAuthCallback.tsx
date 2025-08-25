// src/components/OAuthCallback.tsx - Handle hash-based tokens
import React, { useEffect, useState } from 'react';

export const OAuthCallback: React.FC = () => {
  const [status, setStatus] = useState('Processing login...');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Parse hash fragment (implicit flow)
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        
        const access_token = params.get('access_token');
        const token_type = params.get('token_type');
        const expires_in = params.get('expires_in');
        const state = params.get('state');
        const error = params.get('error');

        console.log('OAuth callback params:', { access_token: !!access_token, error, state });

        if (error) {
          setStatus(`Login failed: ${error}`);
          setIsError(true);
          
          // Send error to opener
          if (window.opener) {
            window.opener.postMessage({
              type: 'SNAPCHAT_OAUTH_ERROR',
              error
            }, window.location.origin);
            setTimeout(() => window.close(), 2000);
          }
          return;
        }

        if (!access_token) {
          setStatus('No access token received');
          setIsError(true);
          return;
        }

        // Validate state
        const storedState = sessionStorage.getItem('snapchat_oauth_state');
        if (storedState && storedState !== state) {
          setStatus('Security check failed');
          setIsError(true);
          return;
        }

        setStatus('Login successful! Fetching user info...');

        // Fetch user info with access token
        try {
          const userResponse = await fetch('https://kit-api.snapchat.com/v1/me', {
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Content-Type': 'application/json'
            }
          });

          let userInfo = null;
          if (userResponse.ok) {
            userInfo = await userResponse.json();
          }

          // Send success to opener
          if (window.opener) {
            window.opener.postMessage({
              type: 'SNAPCHAT_OAUTH_SUCCESS',
              access_token,
              token_type,
              expires_in: parseInt(expires_in || '3600'),
              user_info: userInfo
            }, window.location.origin);
            
            setStatus('Login complete! Closing...');
            setTimeout(() => window.close(), 1000);
          } else {
            // Fallback: store in sessionStorage
            sessionStorage.setItem('snap_oauth_result', JSON.stringify({
              access_token,
              token_type,
              expires_in,
              user_info: userInfo
            }));
            
            setStatus('Login complete! Redirecting...');
            setTimeout(() => {
              window.location.href = '/';
            }, 1000);
          }

        } catch (userError) {
          console.warn('Failed to fetch user info:', userError);
          
          // Send token anyway
          if (window.opener) {
            window.opener.postMessage({
              type: 'SNAPCHAT_OAUTH_SUCCESS',
              access_token,
              token_type,
              expires_in: parseInt(expires_in || '3600')
            }, window.location.origin);
            setTimeout(() => window.close(), 1000);
          }
        }

      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus('Login processing failed');
        setIsError(true);
        
        if (window.opener) {
          window.opener.postMessage({
            type: 'SNAPCHAT_OAUTH_ERROR',
            error: 'Processing failed'
          }, window.location.origin);
        }
      }
    };

    processCallback();
  }, []);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="text-center text-white p-8">
        <div className="text-6xl mb-4">👻</div>
        <h2 className="text-xl font-bold mb-4">{status}</h2>
        {!isError && (
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        )}
        {isError && (
          <button 
            onClick={() => window.close()}
            className="mt-4 px-4 py-2 bg-red-600 rounded-lg"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
};