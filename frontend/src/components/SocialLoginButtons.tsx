import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import FacebookLogin from "@greatsumini/react-facebook-login";
import toast from "react-hot-toast";
import api from "../api";
import { useAuth } from "../contexts/AuthContext";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
const FACEBOOK_APP_ID  = import.meta.env.VITE_FACEBOOK_APP_ID ?? "";

// Google "G" logo SVG
function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

// Facebook "f" logo SVG
function FacebookIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

interface Props {
  onSuccess: (userId: string) => void;
}

export default function SocialLoginButtons({ onSuccess }: Props) {
  const { login } = useAuth();
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingFacebook, setLoadingFacebook] = useState(false);

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return;
    setLoadingGoogle(true);
    try {
      const res = await api.post<{ access_token: string }>("/auth/google", {
        credential: credentialResponse.credential,
      });
      const me = await login(res.data.access_token);
      toast.success("Welcome to Marketplace.aw!");
      onSuccess(me.id);
    } catch {
      toast.error("Google sign-in failed. Please try again.");
    } finally {
      setLoadingGoogle(false);
    }
  };

  if (!GOOGLE_CLIENT_ID && !FACEBOOK_APP_ID) return null;

  return (
    <div className="space-y-3">
      <div className="relative flex items-center">
        <div className="flex-1 border-t border-gray-200" />
        <span className="px-3 text-xs text-gray-400">or continue with</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      <div className="flex flex-col gap-2">
        {GOOGLE_CLIENT_ID && (
          <div className={loadingGoogle ? "opacity-60 pointer-events-none" : ""}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error("Google sign-in failed")}
              useOneTap={false}
              shape="rectangular"
              theme="outline"
              size="large"
              width="100%"
              text="continue_with"
            />
          </div>
        )}
        {FACEBOOK_APP_ID && (
          <FacebookLogin
            appId={FACEBOOK_APP_ID}
            onSuccess={async (response) => {
              if (!response.accessToken) return;
              setLoadingFacebook(true);
              try {
                const res = await api.post<{ access_token: string }>("/auth/facebook", {
                  access_token: response.accessToken,
                });
                const me = await login(res.data.access_token);
                toast.success("Welcome to Marketplace.aw!");
                onSuccess(me.id);
              } catch (err: unknown) {
                const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
                toast.error(msg ?? "Facebook sign-in failed. Please try again.");
              } finally {
                setLoadingFacebook(false);
              }
            }}
            onFail={() => toast.error("Facebook sign-in was cancelled")}
            render={({ onClick }) => (
              <button
                type="button"
                onClick={onClick}
                disabled={loadingFacebook}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors disabled:opacity-60"
              >
                <FacebookIcon />
                Continue with Facebook
              </button>
            )}
          />
        )}
      </div>
    </div>
  );
}
