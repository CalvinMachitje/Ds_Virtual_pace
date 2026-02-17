// src/pages/shared/Settings.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut, User, Mail, Clock, Shield, Key } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import ChangePasswordForm from "@/components/settings/ChangePasswordForm";

export default function Settings() {
  const { user, session } = useAuth();
  const navigate = useNavigate();

  const [lastSignIn, setLastSignIn] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<string>("Email + Password");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    const fetchSessionDetails = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          // Use user timestamps instead of session.created_at which is not present on the Session type
          const createdAt = new Date(
            data.session.user?.last_sign_in_at ?? data.session.user?.created_at ?? Date.now()
          );
          setLastSignIn(formatDistanceToNow(createdAt, { addSuffix: true }));

          if (data.session.user?.app_metadata?.provider) {
            const provider = data.session.user.app_metadata.provider;
            setAuthMethod(provider.charAt(0).toUpperCase() + provider.slice(1));
          }
        }
      } catch (err) {
        console.error("Failed to load session info:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSessionDetails();
  }, [user, navigate]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logged out", { duration: 2000 });
      navigate("/login", { replace: true });
    } catch (err: any) {
      toast.error("Logout failed");
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-slate-400">Manage your account and security preferences</p>

        {/* Account Information */}
        <Card className="bg-slate-900/70 border-slate-700 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-3">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback>{user.email?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-medium text-white">
                  {user.user_metadata?.full_name || "User"}
                </h3>
                <p className="text-slate-400 text-sm">{user.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 text-slate-300 mb-1">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">Email</span>
                </div>
                <p className="text-white">{user.email}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-slate-300 mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">Last sign-in</span>
                </div>
                <p className="text-white">
                  {loading ? "Loading..." : lastSignIn || "Unknown"}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-slate-300 mb-1">
                  <Shield className="h-4 w-4" />
                  <span className="text-sm">Method</span>
                </div>
                <Badge variant="outline" className="bg-slate-800 text-slate-200">
                  {authMethod}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password Section */}
        <ChangePasswordForm />

        {/* Logout & Danger Zone */}
        <Card className="bg-slate-900/70 border-slate-700 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-3">
              <LogOut className="h-5 w-5" />
              Sign Out
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={handleLogout}
            >
              Log out from this device
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}