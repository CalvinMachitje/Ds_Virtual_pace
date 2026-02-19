// src/pages/admin/AdminDashboard.tsx
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect } from "react";
import { toast } from "sonner";

export default function AdminDashboard() {
  const { isAdmin, userRole, loading } = useAuth(); // ← Use isAdmin and userRole from context
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!isAdmin || userRole !== "admin") {
      toast.error("Access denied. Admin only.");
      navigate("/dashboard");
    }
  }, [isAdmin, userRole, loading, navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-white">Loading admin dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Admin Dashboard</h1>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Manage Users</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 mb-4">View, edit, or ban users (buyers/sellers).</p>
              <Button onClick={() => navigate("/admin/users")} className="bg-blue-600 hover:bg-blue-700">
                Go to Users
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Manage Gigs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 mb-4">Approve, edit, or remove gigs listings.</p>
              <Button onClick={() => navigate("/admin/gigs")} className="bg-blue-600 hover:bg-blue-700">
                Go to Gigs
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Manage Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 mb-4">View bookings, resolve disputes, refunds.</p>
              <Button onClick={() => navigate("/admin/bookings")} className="bg-blue-600 hover:bg-blue-700">
                Go to Bookings
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Verifications</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 mb-4">Approve seller verifications and credentials.</p>
              <Button onClick={() => navigate("/admin/verifications")} className="bg-blue-600 hover:bg-blue-700">
                Go to Verifications
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Payments & Finances</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 mb-4">View transactions, handle payouts, fees.</p>
              <Button onClick={() => navigate("/admin/payments")} className="bg-blue-600 hover:bg-blue-700">
                Go to Payments
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Analytics & Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 mb-4">Platform stats, user activity, revenue reports.</p>
              <Button onClick={() => navigate("/admin/analytics")} className="bg-blue-600 hover:bg-blue-700">
                Go to Analytics
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">System Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 mb-4">Configure categories, fees, site settings.</p>
              <Button onClick={() => navigate("/admin/settings")} className="bg-blue-600 hover:bg-blue-700">
                Go to Settings
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Support Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 mb-4">View and respond to user support requests.</p>
              <Button onClick={() => navigate("/admin/support")} className="bg-blue-600 hover:bg-blue-700">
                Go to Support
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Audit Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 mb-4">View system logs and activity history.</p>
              <Button onClick={() => navigate("/admin/logs")} className="bg-blue-600 hover:bg-blue-700">
                Go to Logs
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}