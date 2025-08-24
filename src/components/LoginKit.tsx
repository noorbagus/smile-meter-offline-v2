// src/components/LoginKit.tsx - Updated with popup OAuth handling
import React, { useEffect, useState } from 'react';
import { openOAuthPopup, generateOAuthUrl, handleOAuthCallback } from '../utils/popupOAuthHandler';

interface LoginKitProps {
  onLogin: (accessToken: string) => void;
  onError?: (error: string) => void;
  addLog?: (message: string) => void;
}

export const LoginKit: React.FC<LoginKitProps> = ({ onLogin, onError, addLog }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listen for OAuth via BroadcastChannel
  useEffect(() => {
    const channel = new BroadcastChannel('snapchat_oauth');
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'oauth_success') {
        addLog?.(`✅ OAuth token received: ${event.data.token.substring(0, 20)}...`);
        onLogin(event.data.token);
      } else if (event.data.type === 'oauth_error') {
        addLog?.(`❌ OAuth error: ${event.data.error}`);
        setError(event.data.error);
      }
    };
    
    channel.addEventListener('message', handleMessage);
    
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, [addLog, onLogin]);

  const handleSnapchatLogin = async () => {
    setIsLoading(true);
    setError(null);
    addLog?.('🚀 Starting Snapchat OAuth...');

    try {
      const authUrl = generateOAuthUrl();
      addLog?.('🔗 Opening OAuth popup...');
      
      const tokenData = await openOAuthPopup(authUrl);
      
      addLog?.(`✅ OAuth successful: ${tokenData.access_token.substring(0, 20)}...`);
      onLogin(tokenData.access_token);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'OAuth failed';
      addLog?.(`❌ OAuth failed: ${errorMessage}`);
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Login Button */}
      <button
        onClick={handleSnapchatLogin}
        disabled={isLoading}
        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-600 text-black font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
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

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
          <div className="text-red-300 text-sm font-medium">Login Error</div>
          <div className="text-red-400 text-xs mt-1">{error}</div>
          
          {error.includes('Popup blocked') && (
            <div className="text-red-300 text-xs mt-2">
              💡 Please allow popups and try again
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="text-xs text-white/60 space-y-2">
        <div className="bg-blue-500/10 rounded p-3">
          <p className="font-medium text-blue-300 mb-1">🎯 How Push2Web works:</p>
          <ol className="space-y-1 pl-4">
            <li>1. Login with your Snapchat account</li>
            <li>2. Open Lens Studio with same account</li>
            <li>3. Click "Send to Camera Kit" in Lens Studio</li>
            <li>4. Lens appears in this app automatically!</li>
          </ol>
        </div>
        
        {import.meta.env.DEV && (
          <div className="bg-orange-500/10 rounded p-3">
            <p className="font-medium text-orange-300 mb-1">🔧 Dev Notes:</p>
            <ul className="space-y-1 pl-4 text-xs">
              <li>• OAuth uses popup window communication</li>
              <li>• Token extracted from hash fragment</li>
              <li>• PostMessage API for popup → main window</li>
              <li>• Only staging OAuth tokens supported</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};