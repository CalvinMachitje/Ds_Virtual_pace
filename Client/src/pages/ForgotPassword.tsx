// src/pages/ForgotPassword.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900/70 backdrop-blur-md shadow-2xl">
        <CardHeader className="space-y-1 text-center relative">
          <Link to="/login" className="absolute left-4 top-4 text-slate-400 hover:text-white">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-blue-600/20 rounded-full">
              <Mail className="h-12 w-12 text-blue-500" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-white">Forgot Password?</CardTitle>
          <CardDescription className="text-slate-400">
            Don't worry, it happens. Please enter the email address associated with your account.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-200">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                id="email"
                placeholder="name@example.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-11 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-6 text-lg">
            Send Reset Link →
          </Button>

          <div className="text-center text-sm text-slate-400">
            Remember your password?{" "}
            <Link to="/Login_Page" className="text-blue-400 hover:text-blue-300 hover:underline">
              Log In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}