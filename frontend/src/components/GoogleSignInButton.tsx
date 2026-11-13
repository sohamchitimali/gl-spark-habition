import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleSignInButtonProps {
  mode?: 'signin' | 'signup';
  onError?: (message: string) => void;
  onSuccess?: () => void;
  className?: string;
}

export const GoogleSignInButton = ({
  mode = 'signin',
  onError,
  onSuccess,
  className = '',
}: GoogleSignInButtonProps) => {
  const { googleLogin } = useAuth();
  const [loading, setLoading] = useState(false);
  const tokenClientRef = useRef<any>(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    // If client ID is configured and Google script is available, initialize
    if (!clientId) return;

    const initClient = () => {
      if (!window.google?.accounts) return;

      try {
        // Initialize token client for user-click popup OAuth flow
        if (window.google.accounts.oauth2) {
          tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'email profile openid',
            callback: async (response: any) => {
              if (response.error) {
                setLoading(false);
                onError?.(response.error_description || response.error || 'Google sign-in was cancelled');
                return;
              }
              if (response.access_token) {
                try {
                  await googleLogin({ accessToken: response.access_token });
                  onSuccess?.();
                } catch (err: any) {
                  const msg = err?.response?.data?.message || 'Google sign-in failed. Please try again.';
                  onError?.(msg);
                } finally {
                  setLoading(false);
                }
              }
            },
          });
        }

        // Initialize ID client for optional One Tap or credential responses
        if (window.google.accounts.id) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: any) => {
              if (response.credential) {
                try {
                  setLoading(true);
                  await googleLogin({ credential: response.credential });
                  onSuccess?.();
                } catch (err: any) {
                  const msg = err?.response?.data?.message || 'Google sign-in failed. Please try again.';
                  onError?.(msg);
                } finally {
                  setLoading(false);
                }
              }
            },
          });
        }
      } catch (err) {
        console.error('Failed to initialize Google Sign-In:', err);
      }
    };

    if (window.google?.accounts) {
      initClient();
    } else {
      // Retry in case script is loading async
      const interval = setInterval(() => {
        if (window.google?.accounts) {
          initClient();
          clearInterval(interval);
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [clientId, googleLogin, onError, onSuccess]);

  const handleClick = () => {
    if (!clientId) {
      onError?.('Google Sign-In is not configured. Please add VITE_GOOGLE_CLIENT_ID in your environment.');
      return;
    }

    if (!window.google?.accounts) {
      onError?.('Google Sign-In services could not be loaded. Please check your internet connection.');
      return;
    }

    setLoading(true);

    if (tokenClientRef.current) {
      // Trigger OAuth2 popup
      tokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
    } else if (window.google?.accounts?.id) {
      // Fallback: prompt One Tap / account chooser
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setLoading(false);
        }
      });
    } else {
      setLoading(false);
      onError?.('Google authentication is currently unavailable. Please try again.');
    }
  };

  const buttonText = loading
    ? 'Signing in...'
    : mode === 'signup'
    ? 'Sign up with Google'
    : 'Sign in with Google';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`w-full py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-3 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{
        background: '#363634',
        border: '1px solid #424240',
        color: '#FFFFFF',
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          e.currentTarget.style.background = '#40403D';
          e.currentTarget.style.borderColor = '#555552';
        }
      }}
      onMouseLeave={(e) => {
        if (!loading) {
          e.currentTarget.style.background = '#363634';
          e.currentTarget.style.borderColor = '#424240';
        }
      }}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      ) : (
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
      )}
      <span className="text-sm tracking-wide">{buttonText}</span>
    </button>
  );
};
