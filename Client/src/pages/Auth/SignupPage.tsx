// src/pages/Auth/SignupPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Lock, Eye, EyeOff, ArrowLeft, Phone, Facebook, Chrome, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [emailConfirmSent, setEmailConfirmSent] = useState(false);

  const { signUp } = useAuth();
  const navigate = useNavigate();

  // Password strength logic (unchanged)
  const getPasswordStrength = (pwd: string) => {
    let strength = 0;
    if (pwd.length >= 8) strength += 1;
    if (/[A-Z]/.test(pwd)) strength += 1;
    if (/[a-z]/.test(pwd)) strength += 1;
    if (/[0-9]/.test(pwd)) strength += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) strength += 1;

    if (strength <= 2) return { score: 1, text: "Weak", color: "bg-red-500" };
    if (strength === 3) return { score: 2, text: "Fair", color: "bg-orange-500" };
    if (strength === 4) return { score: 3, text: "Good", color: "bg-yellow-500" };
    return { score: 4, text: "Strong", color: "bg-green-500" };
  };

  const passwordStrength = getPasswordStrength(password);
  const passwordStrengthWidth = `${(passwordStrength.score / 4) * 100}%`;

  // Form validation (unchanged)
  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!fullName.trim()) errors.fullName = "Full name is required";
    if (!email.trim()) errors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) errors.email = "Invalid email format";

    const phoneClean = phone.replace(/\s+/g, "");
    if (phoneClean && !/^(?:0|\+27)[1-9][0-9]{8}$/.test(phoneClean)) {
      errors.phone = "Please enter a valid South African phone number";
    }

    if (password.length < 8) errors.password = "Password must be at least 8 characters";
    else if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match";

    if (!acceptedTerms) errors.terms = "You must accept the terms and privacy policy";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setError(null);
    setLoading(true);

    try {
      // Sign up with metadata (type assertion to match extended AuthContext type)
      const { data: signUpData, error: signUpError } = await signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim() || null,
            role,
          } as { full_name: string; phone: string | null; role: "buyer" | "seller" },
        },
      });

      if (signUpError) throw signUpError;

      // If email confirmation required (recommended for production)
      if (!signUpData.session) {
        setEmailConfirmSent(true);
        toast.info("Check your email for confirmation link");
        return;
      }

      // Auto-confirmed (dev mode)
      toast.success("Account created successfully!");
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Signup error:", err);
      setError(err.message || "Failed to create account");
      toast.error(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: "google" | "facebook") => {
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || "OAuth login failed");
    } finally {
      setLoading(false);
    }
  };

  if (emailConfirmSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4">
        <Card className="w-full max-w-md border-slate-800 bg-slate-900/70 backdrop-blur-md shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white">Confirm Your Email</CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              We sent a confirmation link to <strong>{email}</strong>.<br />
              Please check your inbox (and spam folder) and click the link to activate your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Button
              onClick={async () => {
                const { error } = await supabase.auth.resend({
                  type: "signup",
                  email: email.trim(),
                });
                if (error) {
                  toast.error(error.message);
                } else {
                  toast.success("Confirmation email resent!");
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 w-full"
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Resend Confirmation Email
            </Button>
            <Button variant="outline" onClick={() => navigate("/login")} className="w-full">
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
          <Link to="/" className="absolute left-4 top-4 text-slate-400 hover:text-white">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <CardTitle className="text-3xl font-bold text-white">Create Account</CardTitle>
          <CardDescription className="text-slate-400">
            Join D's Virtual Space and start collaborating.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-200 px-4 py-3 rounded-md text-center">
              {error}
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-slate-200">
              Full Name <span className="text-red-400">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                id="fullName"
                autoComplete="name"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={`pl-11 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-blue-500 ${
                  fieldErrors.fullName ? "border-red-500" : ""
                }`}
              />
            </div>
            {fieldErrors.fullName && <p className="text-red-400 text-xs mt-1">{fieldErrors.fullName}</p>}
          </div>

          {/* Cell Number */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-slate-200">Cell Number (optional)</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                id="phone"
                autoComplete="tel"
                placeholder="082 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`pl-11 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-blue-500 ${
                  fieldErrors.phone ? "border-red-500" : ""
                }`}
              />
            </div>
            {fieldErrors.phone && <p className="text-red-400 text-xs mt-1">{fieldErrors.phone}</p>}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-200">
              Email Address <span className="text-red-400">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`pl-11 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-blue-500 ${
                  fieldErrors.email ? "border-red-500" : ""
                }`}
              />
            </div>
            {fieldErrors.email && <p className="text-red-400 text-xs mt-1">{fieldErrors.email}</p>}
          </div>

          {/* Role Selection */}
          <div className="space-y-2">
            <Label className="text-slate-200">I want to...</Label>
            <div className="grid grid-cols-2 gap-4">
              <label className={`flex flex-col items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                role === "buyer" ? "border-blue-500 bg-blue-950/30" : "border-slate-700 hover:border-slate-500"
              }`}>
                <input
                  type="radio"
                  name="role"
                  value="buyer"
                  checked={role === "buyer"}
                  onChange={() => setRole("buyer")}
                  className="sr-only"
                />
                <span className="text-lg font-medium">Find Help</span>
                <span className="text-sm text-slate-400">I'm looking for assistants</span>
              </label>

              <label className={`flex flex-col items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                role === "seller" ? "border-blue-500 bg-blue-950/30" : "border-slate-700 hover:border-slate-500"
              }`}>
                <input
                  type="radio"
                  name="role"
                  value="seller"
                  checked={role === "seller"}
                  onChange={() => setRole("seller")}
                  className="sr-only"
                />
                <span className="text-lg font-medium">Offer Services</span>
                <span className="text-sm text-slate-400">I want to provide assistance</span>
              </label>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-200">
              Password <span className="text-red-400">*</span>
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`pl-11 pr-11 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-blue-500 ${
                  fieldErrors.password ? "border-red-500" : ""
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {fieldErrors.password && <p className="text-red-400 text-xs mt-1">{fieldErrors.password}</p>}

            {/* Password Strength Meter */}
            {password && (
              <div className="mt-2">
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: passwordStrengthWidth }}
                  />
                </div>
                <p className={`text-xs mt-1 ${passwordStrength.color.replace("bg-", "text-")}`}>
                  Password strength: {passwordStrength.text}
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-slate-200">
              Confirm Password <span className="text-red-400">*</span>
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`pl-11 pr-11 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-blue-500 ${
                  fieldErrors.confirmPassword ? "border-red-500" : ""
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p className="text-red-400 text-xs">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          {/* Terms & Privacy */}
          <div className="flex items-start space-x-2">
            <Checkbox
              id="terms"
              checked={acceptedTerms}
              onCheckedChange={(checked) => setAcceptedTerms(!!checked)}
              className="border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
            />
            <div className="grid gap-0.5 leading-none">
              <Label
                htmlFor="terms"
                className="text-sm text-slate-300 cursor-pointer"
              >
                I accept the{" "}
                <a href="/terms" className="text-blue-400 hover:underline" target="_blank">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" className="text-blue-400 hover:underline" target="_blank">
                  Privacy Policy
                </a>
              </Label>
              {fieldErrors.terms && <p className="text-red-400 text-xs">{fieldErrors.terms}</p>}
            </div>
          </div>

          <Button
            onClick={handleEmailSignup}
            disabled={loading || !acceptedTerms}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-6 text-lg disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Account"}
          </Button>

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
              disabled={loading}
              className="border-slate-700 text-white hover:bg-slate-800"
            >
              <Facebook className="mr-2 h-5 w-5" /> Facebook
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOAuthSignIn("google")}
              disabled={loading}
              className="border-slate-700 text-white hover:bg-slate-800"
            >
              <Chrome className="mr-2 h-5 w-5" /> Google
            </Button>
          </div>
        </CardContent>

        <CardFooter className="text-center text-sm text-slate-400 pt-6 border-t border-slate-800">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-400 hover:text-blue-300 hover:underline ml-1">
            Log In
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}