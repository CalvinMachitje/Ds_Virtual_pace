// Client/src/pages/Auth/LoginPage.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Facebook, Chrome, Users, Loader2 } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "facebook" | null>(null);

  /** --- EMAIL LOGIN --- */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password");
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await signIn(email.trim(), password.trim());
      if (signInError) throw signInError;

      toast.success("Logged in successfully");
      navigate("/dashboard");
    } catch (err: any) {
      const msg = err?.message || "Login failed. Check credentials.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /** --- OAUTH LOGIN --- */
  const handleOAuthSignIn = async (provider: "google" | "facebook") => {
    setError(null);
    setOauthLoading(provider);

    try {
      // ✅ Use GET /start to avoid 405 errors
      const res = await fetch(`/api/auth/oauth/${provider}/start`);
      if (!res.ok) throw new Error("Failed to get OAuth URL");

      const data: { oauth_url: string; success: boolean } = await res.json();
      if (!data.success || !data.oauth_url) throw new Error("Invalid OAuth URL returned");

      // Redirect user to Supabase OAuth
      window.location.href = data.oauth_url;
    } catch (err: any) {
      toast.error(err.message || `${provider[0].toUpperCase() + provider.slice(1)} login failed`);
      setError(err.message);
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900/70 backdrop-blur-md shadow-2xl">
        <CardHeader className="space-y-1 text-center relative">
          <Link to="/" className="absolute left-4 top-4 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="h-6 w-6" />
          </Link>

          <div className="flex justify-center mb-4">
            <div className="p-4 bg-blue-600/20 rounded-full">
              <Users className="h-12 w-12 text-blue-500" />
            </div>
          </div>

          <CardTitle className="text-3xl font-bold text-white">D's Virtual Space</CardTitle>
          <CardDescription className="text-slate-400">Access your personal team</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-200 px-4 py-3 rounded-md text-center text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 pr-11 bg-slate-800/60 border-slate-700 text-white focus:ring-blue-500 focus:border-blue-500"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300 hover:underline">
                Forgot Password?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Log In"
              )}
            </Button>
          </form>

          {/* OAuth */}
          <div className="relative my-6">
            <Separator className="bg-slate-700" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-slate-900 px-4 text-xs text-slate-500 uppercase tracking-wider">
                or continue with
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={() => handleOAuthSignIn("facebook")}
              disabled={oauthLoading !== null}
              className="border-slate-700 text-white hover:bg-slate-800 relative"
            >
              {oauthLoading === "facebook" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Facebook className="mr-2 h-5 w-5" />}
              Facebook
            </Button>

            <Button
              variant="outline"
              onClick={() => handleOAuthSignIn("google")}
              disabled={oauthLoading !== null}
              className="border-slate-700 text-white hover:bg-slate-800 relative"
            >
              {oauthLoading === "google" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Chrome className="mr-2 h-5 w-5" />}
              Google
            </Button>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col text-center text-sm text-slate-400 pt-6 border-t border-slate-800">
          <p>Don't have an account?</p>
          <Link to="/signup" className="text-blue-400 hover:text-blue-300 hover:underline font-medium">
            Apply for access →
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}