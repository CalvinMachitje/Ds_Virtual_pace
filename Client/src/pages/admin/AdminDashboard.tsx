// src/pages/admin/AdminDashboard.tsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Users, Briefcase, FileText, ShieldCheck, DollarSign, BarChart, Settings, MessageSquare, History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardStats {
  total_users: number;
  pending_verifications: number;
  open_tickets: number;
  active_gigs: number;
  // Add more stats as your backend returns them
}

export default function AdminDashboard() {
  const { isAdmin, userRole, loading } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!isAdmin || userRole !== "admin") {
      toast.error("Access denied. Admin only.");
      navigate("/dashboard");
      return;
    }

    // Fetch real stats from backend
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) throw new Error("No auth token");

        const res = await fetch("/api/admin/dashboard", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to load stats");
        }

        const data = await res.json();
        setStats(data);
      } catch (err: any) {
        console.error(err);
        setStatsError(err.message || "Could not load dashboard stats");
        toast.error("Failed to load stats");
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, [isAdmin, userRole, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="bg-slate-900/70 border-slate-700">
                <CardHeader>
                  <Skeleton className="h-8 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-6 w-24 mb-2" />
                  <Skeleton className="h-4 w-40" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin || userRole !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
          <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold mb-2 text-white">Access Denied</h2>
          <p className="text-slate-400 mb-6">This page is restricted to administrators only.</p>
          <Button onClick={() => navigate("/dashboard")}>Return to Dashboard</Button>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-indigo-400" />
            Admin Dashboard
          </h1>
          {statsLoading && <Skeleton className="h-10 w-40" />}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <Card className="bg-slate-900/70 border-slate-700 hover:border-indigo-500/50 transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-blue-400" />
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : statsError ? (
                <p className="text-red-400">Error</p>
              ) : (
                <p className="text-3xl font-bold text-white">{stats?.total_users?.toLocaleString() ?? "—"}</p>
              )}
              <p className="text-sm text-slate-400 mt-1">Registered accounts</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700 hover:border-yellow-500/50 transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5 text-yellow-400" />
                Pending Verifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : statsError ? (
                <p className="text-red-400">Error</p>
              ) : (
                <p className="text-3xl font-bold text-white">{stats?.pending_verifications ?? "—"}</p>
              )}
              <p className="text-sm text-slate-400 mt-1">Awaiting approval</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700 hover:border-red-500/50 transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5 text-red-400" />
                Open Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : statsError ? (
                <p className="text-red-400">Error</p>
              ) : (
                <p className="text-3xl font-bold text-white">{stats?.open_tickets ?? "—"}</p>
              )}
              <p className="text-sm text-slate-400 mt-1">Pending support</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700 hover:border-green-500/50 transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <Briefcase className="h-5 w-5 text-green-400" />
                Active Gigs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : statsError ? (
                <p className="text-red-400">Error</p>
              ) : (
                <p className="text-3xl font-bold text-white">{stats?.active_gigs ?? "—"}</p>
              )}
              <p className="text-sm text-slate-400 mt-1">Published listings</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <Card className="bg-slate-900/70 border-slate-700 hover:border-blue-500/50 transition-all duration-300 group">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-400" />
                Manage Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">View, edit, ban users</p>
              <Button 
                onClick={() => navigate("/admin/users")} 
                className="w-full bg-blue-600 hover:bg-blue-700 group-hover:scale-105 transition-transform"
              >
                Go to Users
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700 hover:border-indigo-500/50 transition-all duration-300 group">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-indigo-400" />
                Manage Gigs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">Review, edit listings</p>
              <Button 
                onClick={() => navigate("/admin/gigs")} 
                className="w-full bg-indigo-600 hover:bg-indigo-700 group-hover:scale-105 transition-transform"
              >
                Go to Gigs
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700 hover:border-green-500/50 transition-all duration-300 group">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-400" />
                Manage Bookings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">View, resolve bookings</p>
              <Button 
                onClick={() => navigate("/admin/bookings")} 
                className="w-full bg-green-600 hover:bg-green-700 group-hover:scale-105 transition-transform"
              >
                Go to Bookings
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700 hover:border-yellow-500/50 transition-all duration-300 group">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-yellow-400" />
                Verifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">Approve seller credentials</p>
              <Button 
                onClick={() => navigate("/admin/verifications")} 
                className="w-full bg-yellow-600 hover:bg-yellow-700 group-hover:scale-105 transition-transform"
              >
                Go to Verifications
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700 hover:border-purple-500/50 transition-all duration-300 group">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-purple-400" />
                Payments & Finances
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">Transactions, payouts</p>
              <Button 
                onClick={() => navigate("/admin/payments")} 
                className="w-full bg-purple-600 hover:bg-purple-700 group-hover:scale-105 transition-transform"
              >
                Go to Payments
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700 hover:border-cyan-500/50 transition-all duration-300 group">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart className="h-5 w-5 text-cyan-400" />
                Analytics & Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">Stats, revenue, activity</p>
              <Button 
                onClick={() => navigate("/admin/analytics")} 
                className="w-full bg-cyan-600 hover:bg-cyan-700 group-hover:scale-105 transition-transform"
              >
                Go to Analytics
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700 hover:border-orange-500/50 transition-all duration-300 group">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <Settings className="h-5 w-5 text-orange-400" />
                System Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">Fees, categories, config</p>
              <Button 
                onClick={() => navigate("/admin/settings")} 
                className="w-full bg-orange-600 hover:bg-orange-700 group-hover:scale-105 transition-transform"
              >
                Go to Settings
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700 hover:border-pink-500/50 transition-all duration-300 group">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-pink-400" />
                Support Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">User support requests</p>
              <Button 
                onClick={() => navigate("/admin/support")} 
                className="w-full bg-pink-600 hover:bg-pink-700 group-hover:scale-105 transition-transform"
              >
                Go to Support
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700 hover:border-emerald-500/50 transition-all duration-300 group">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <History className="h-5 w-5 text-emerald-400" />
                Audit Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">System activity history</p>
              <Button 
                onClick={() => navigate("/admin/logs")} 
                className="w-full bg-emerald-600 hover:bg-emerald-700 group-hover:scale-105 transition-transform"
              >
                Go to Logs
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}