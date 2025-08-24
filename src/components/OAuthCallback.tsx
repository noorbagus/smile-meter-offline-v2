// src/components/OAuthCallback.tsx - Silent processor
import React, { useEffect } from 'react';

export const OAuthCallback: React.FC = () => {
  useEffect(() => {
    const processOAuth = () => {
      try {
        const hash = window.location.hash;
        
        if (hash && hash.includes('access_token')) {
          const params = new URLSearchParams(hash.substring(1));
          const access_token = params.get('access_token');
          
          if (access_token) {
            // Send token via BroadcastChannel
            const channel = new BroadcastChannel('snapchat_oauth');
            channel.postMessage({
              type: 'oauth_success',
              token: access_token,
              timestamp: Date.now()
            });
            
            // Show success message
            document.body.innerHTML = `
              <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,#667eea,#764ba2);color:white;font-family:system-ui">
                <div style="text-align:center">
                  <div style="font-size:4rem;margin-bottom:1rem">✅</div>
                  <h2>Login Successful!</h2>
                  <p>You can close this window</p>
                </div>
              </div>
            `;
            
            // Auto-close after 2 seconds
            setTimeout(() => {
              window.close();
            }, 2000);
          }
        } else {
          throw new Error('No access token found');
        }
      } catch (error) {
        // Send error via BroadcastChannel
        const channel = new BroadcastChannel('snapchat_oauth');
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        channel.postMessage({
          type: 'oauth_error',
          error: errorMessage,
          timestamp: Date.now()
        });
        
        document.body.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#dc2626;color:white;font-family:system-ui">
            <div style="text-align:center">
              <div style="font-size:4rem;margin-bottom:1rem">❌</div>
              <h2>Login Failed</h2>
              <p>${errorMessage}</p>
              <p style="margin-top:1rem">You can close this window</p>
            </div>
          </div>
        `;
      }
    };

    processOAuth();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center">
      <div className="text-center text-white">
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p>Processing login...</p>
      </div>
    </div>
  );
};