// src/pages/shared/ForgotPassword.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send reset link");
      }

      setSuccess(true);
      toast.success("Reset link sent! Check your email.");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      toast.error(err.message || "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4">
        <Card className="w-full max-w-md border-slate-800 bg-slate-900/70 backdrop-blur-md shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white">Check Your Email</CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              We sent a password reset link to <strong>{email}</strong>.<br />
              Please check your inbox (and spam folder) and click the link to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/login")} className="mt-6 bg-blue-600 hover:bg-blue-700 w-full">
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900/70 backdrop-blur-md shadow-2xl">
        <CardHeader className="space-y-1 text-center relative">
          <Link to="/login" className="absolute left-4 top-4 text-slate-400 hover:text-white">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <CardTitle className="text-3xl font-bold text-white">Forgot Password?</CardTitle>
          <CardDescription className="text-slate-400">
            Don't worry, it happens. Please enter the email address associated with your account.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-200 px-4 py-3 rounded-md text-center">
              {error}
            </div>
          )}

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
                className="pl-11 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <Button
            onClick={handleReset}
            disabled={loading || !email.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-6 text-lg disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </Button>
        </CardContent>

        <CardFooter className="text-center text-sm text-slate-400 pt-6 border-t border-slate-800">
          Remember your password?{" "}
          <Link to="/login" className="text-blue-400 hover:text-blue-300 hover:underline ml-1">
            Log In
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}