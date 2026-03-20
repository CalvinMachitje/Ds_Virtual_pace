// Client/src/pages/Auth/OAuthCallback.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

type OAuthUser = {
  id: string;
  email: string;
  full_name?: string;
  role: "buyer" | "seller" | "admin";
  phone?: string;
  avatar_url?: string;
  email_confirmed?: boolean;
};

type OAuthSuccess = {
  success: true;
  access_token: string;
  refresh_token: string;
  user: OAuthUser;
};

type OAuthError = {
  success: false;
  error: string;
};

type OAuthResponse = OAuthSuccess | OAuthError;

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleOAuthLogin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function isOAuthError(data: any): data is OAuthError {
    return data && typeof data === "object" && "success" in data && data.success === false;
  }

  useEffect(() => {
    const code = searchParams.get("code");
    const provider = searchParams.get("provider") || "google";

    if (!code) {
      setError("No authorization code received.");
      toast.error("OAuth login failed: missing code");
      setLoading(false);
      return;
    }

    const exchangeCode = async () => {
      try {
        const res = await fetch(`/api/auth/oauth/callback?code=${code}&provider=${provider}`, {
          method: "GET",
          credentials: "include",
        });

        const data: OAuthResponse = await res.json();

        if (!res.ok || isOAuthError(data)) {
          const msg = isOAuthError(data) ? data.error : `HTTP error ${res.status}`;
          throw new Error(msg);
        }

        // Success: update AuthContext
        handleOAuthLogin({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          user: data.user,
        });

        toast.success(`Logged in with ${provider[0].toUpperCase() + provider.slice(1)}!`);
        navigate("/dashboard");
      } catch (err: any) {
        console.error("OAuth callback error:", err);
        setError(err.message || "OAuth login failed.");
        setLoading(false);
        toast.error(err.message || "OAuth login failed.");
      }
    };

    exchangeCode();
  }, [searchParams, navigate, handleOAuthLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4">
      {loading ? (
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-500" />
          <h2 className="text-2xl font-bold text-white">Completing OAuth login...</h2>
          <p className="text-slate-400">Please wait while we authenticate your account.</p>
        </div>
      ) : error ? (
        <div className="text-center space-y-4 p-6 bg-red-900/40 border border-red-700 rounded-md">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h2 className="text-xl font-bold text-white">Login Failed</h2>
          <p className="text-red-200">{error}</p>
          <button
            onClick={() => navigate("/login")}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded"
          >
            Back to Login
          </button>
        </div>
      ) : null}
    </div>
  );
}