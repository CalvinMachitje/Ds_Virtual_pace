// src/pages/Auth/OAuthCallback.tsx
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api";

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      toast.error("OAuth login failed: " + error);
      navigate("/login");
      return;
    }

    if (!code) {
      toast.error("No authorization code received");
      navigate("/login");
      return;
    }

    const exchangeCode = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/oauth/callback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, provider: "google" }),
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Failed to complete login");

        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token || "");

        toast.success("Logged in with Google!");
        navigate("/dashboard");
      } catch (err: any) {
        toast.error(err.message || "Login failed");
        navigate("/login");
      }
    };

    exchangeCode();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-500" />
        <h2 className="text-2xl font-bold text-white">Completing Google Login...</h2>
      </div>
    </div>
  );
}