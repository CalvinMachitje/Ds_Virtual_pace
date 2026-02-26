// src/pages/shared/Settings.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut, User, Mail, Clock, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import ChangePasswordForm from "@/components/settings/ChangePasswordForm";

export default function Settings() {
  const { user } = useAuth(); // Assuming your AuthContext still provides user
  const navigate = useNavigate();

  const [lastSignIn, setLastSignIn] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<string>("Email + Password");
  const [loading, setLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    const fetchSessionDetails = async () => {
      try {
        const res = await fetch("/api/auth/session", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch session details");
        }

        const data = await res.json();

        // Format last sign-in time
        if (data.last_sign_in_at) {
          const date = new Date(data.last_sign_in_at);
          setLastSignIn(formatDistanceToNow(date, { addSuffix: true }));
        }

        // Determine auth method/provider
        if (data.provider) {
          const provider = data.provider;
          setAuthMethod(
            provider.charAt(0).toUpperCase() + provider.slice(1).replace(/_/g, " ")
          );
        }
      } catch (err) {
        console.error("Failed to load session info:", err);
        toast.error("Could not load account details");
      } finally {
        setLoading(false);
      }
    };

    fetchSessionDetails();
  }, [user, navigate]);

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      // Clear token regardless of response
      localStorage.removeItem("access_token");

      if (!res.ok) {
        throw new Error("Logout failed on server");
      }

      toast.success("Logged out successfully", { duration: 2000 });
      navigate("/login", { replace: true });
    } catch (err: any) {
      toast.error("Logout failed – please try again");
      console.error(err);
    } finally {
      setLogoutLoading(false);
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
                  {user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
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
                <p className="text-white">{user.email || "Not available"}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-slate-300 mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">Last sign-in</span>
                </div>
                <p className="text-white">
                  {loading ? (
                    <span className="italic">Loading...</span>
                  ) : lastSignIn || "Unknown"}
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
              disabled={logoutLoading}
            >
              {logoutLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Logging out...
                </>
              ) : (
                "Log out from this device"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}