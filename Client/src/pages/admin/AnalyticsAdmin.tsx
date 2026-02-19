// src/pages/admin/AnalyticsAdmin.tsx (Handles analytics)
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Pie } from "react-chartjs-2";
import { toast } from "sonner";
import Skeleton from "react-loading-skeleton";

ChartJS.register(ArcElement, Tooltip, Legend);

type AnalyticsData = {
  total_users: number;
  total_sellers: number;
  total_buyers: number;
  total_bookings: number;
  total_revenue: number;
  role_distribution: { role: string; count: number }[];
};

export default function AnalyticsAdmin() {
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      // Example queries - adjust based on your tables
      const { data: users, error: usersError } = await supabase
        .from("profiles")
        .select("id, role");

      if (usersError) {
        toast.error("Failed to load analytics: " + usersError.message);
        throw usersError;
      }

      const totalUsers = users.length;
      const totalSellers = users.filter((u) => u.role === "seller").length;
      const totalBuyers = users.filter((u) => u.role === "buyer").length;

      const { data: bookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("id, price");

      if (bookingsError) throw bookingsError;

      const totalBookings = bookings.length;
      const totalRevenue = bookings.reduce((sum, b) => sum + b.price, 0);

      const roleDistribution = [
        { role: "Buyers", count: totalBuyers },
        { role: "Sellers", count: totalSellers },
        { role: "Admins", count: users.filter((u) => u.role === "admin").length },
      ];

      return {
        total_users: totalUsers,
        total_sellers: totalSellers,
        total_buyers: totalBuyers,
        total_bookings: totalBookings,
        total_revenue: totalRevenue,
        role_distribution: roleDistribution,
      };
    },
  });

  if (isLoading) {
    return <Skeleton height={500} />;
  }

  const pieData = {
    labels: analytics?.role_distribution.map((r) => r.role),
    datasets: [{
      data: analytics?.role_distribution.map((r) => r.count),
      backgroundColor: ["#3B82F6", "#10B981", "#EAB308"],
    }],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Analytics & Reports</h1>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-white">{analytics?.total_users}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Total Sellers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-white">{analytics?.total_sellers}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Total Buyers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-white">{analytics?.total_buyers}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Total Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-white">{analytics?.total_bookings}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-white">R{analytics?.total_revenue.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">User Role Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-md mx-auto">
              <Pie data={pieData} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}