// src/utils/popupOAuthHandler.ts - Handle OAuth popup communication

export interface OAuthResult {
    access_token: string;
    token_type: string;
    expires_in: number;
    state: string;
  }
  
  /**
   * Open OAuth popup and wait for token
   */
  export const openOAuthPopup = (authUrl: string): Promise<OAuthResult> => {
    return new Promise((resolve, reject) => {
      // Open popup
      const popup = window.open(
        authUrl, 
        'snapchat-oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes,status=yes,location=yes'
      );
  
      if (!popup) {
        reject(new Error('Popup blocked - please allow popups'));
        return;
      }
  
      // Listen for messages from popup
      const messageHandler = (event: MessageEvent) => {
        // Security: verify origin
        if (event.origin !== window.location.origin) {
          return;
        }
  
        if (event.data.type === 'SNAPCHAT_OAUTH_SUCCESS') {
          window.removeEventListener('message', messageHandler);
          popup.close();
          resolve(event.data.token);
        } else if (event.data.type === 'SNAPCHAT_OAUTH_ERROR') {
          window.removeEventListener('message', messageHandler);
          popup.close();
          reject(new Error(event.data.error));
        }
      };
  
      window.addEventListener('message', messageHandler);
  
      // Check if popup was closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageHandler);
          reject(new Error('OAuth cancelled by user'));
        }
      }, 1000);
  
      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(checkClosed);
        window.removeEventListener('message', messageHandler);
        if (!popup.closed) {
          popup.close();
        }
        reject(new Error('OAuth timeout'));
      }, 300000);
    });
  };
  
  /**
   * Parse OAuth hash in popup and send to parent
   * Call this in popup window (or main window if OAuth redirects there)
   */
  export const handleOAuthCallback = (): void => {
    const hash = window.location.hash;
    
    if (!hash || !hash.includes('access_token')) {
      // Send error to parent
      if (window.opener) {
        window.opener.postMessage({
          type: 'SNAPCHAT_OAUTH_ERROR',
          error: 'No access token in callback'
        }, window.location.origin);
      }
      return;
    }
  
    try {
      // Parse hash parameters
      const params = new URLSearchParams(hash.substring(1));
      
      const access_token = params.get('access_token');
      const token_type = params.get('token_type');
      const expires_in = params.get('expires_in');
      const state = params.get('state');
  
      if (!access_token || !state) {
        throw new Error('Missing required OAuth parameters');
      }
  
      // Validate state
      const storedState = localStorage.getItem('snapchat_oauth_state');
      if (storedState !== state) {
        throw new Error('Invalid state parameter - possible CSRF attack');
      }
  
      const tokenData: OAuthResult = {
        access_token,
        token_type: token_type || 'BEARER',
        expires_in: parseInt(expires_in || '3600'),
        state
      };
  
      // Send token to parent window
      if (window.opener) {
        window.opener.postMessage({
          type: 'SNAPCHAT_OAUTH_SUCCESS',
          token: tokenData
        }, window.location.origin);
      } else {
        // If no opener, we're in main window - store directly
        sessionStorage.setItem('snap_oauth_token', JSON.stringify(tokenData));
        
        // Trigger custom event for components to listen
        window.dispatchEvent(new CustomEvent('snapchat-oauth-success', {
          detail: tokenData
        }));
      }
  
      // Clean URL
      window.history.replaceState('', '', window.location.pathname + window.location.search);
  
    } catch (error) {
      // Send error to parent
      if (window.opener) {
        window.opener.postMessage({
          type: 'SNAPCHAT_OAUTH_ERROR',
          error: error instanceof Error ? error.message : 'OAuth failed'
        }, window.location.origin);
      }
    }
  };
  
  /**
   * Generate OAuth URL
   */
  export const generateOAuthUrl = (): string => {
    const clientId = import.meta.env.VITE_SNAPCHAT_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_SNAPCHAT_REDIRECT_URI;
  
    if (!clientId || !redirectUri) {
      throw new Error('Missing OAuth configuration');
    }
  
    // Generate and store state
    const state = btoa(Math.random().toString()).substring(0, 12);
    localStorage.setItem('snapchat_oauth_state', state);
  
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'token', // Implicit flow
      scope: 'https://auth.snapchat.com/oauth2/api/user.display_name',
      state: state
    });
  
    return `https://accounts.snapchat.com/accounts/oauth2/auth?${params}`;
  };