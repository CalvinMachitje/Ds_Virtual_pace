// src/pages/admin/AnalyticsAdmin.tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Pie } from "react-chartjs-2";
import { toast } from "sonner";
import Skeleton from "react-loading-skeleton";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

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
  const { 
    data: analyticsRaw, 
    isLoading, 
    error, 
    refetch 
  } = useQuery<AnalyticsData, Error>({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to fetch analytics");
      }

      const json = await res.json();

      // Type guard / runtime validation
      if (
        typeof json.total_users !== "number" ||
        !Array.isArray(json.role_distribution)
      ) {
        throw new Error("Invalid analytics response format");
      }

      return json as AnalyticsData;
    },
  });

  // Safe analytics object with defaults
  const analytics = analyticsRaw ?? {
    total_users: 0,
    total_sellers: 0,
    total_buyers: 0,
    total_bookings: 0,
    total_revenue: 0,
    role_distribution: [
      { role: "buyer", count: 0 },
      { role: "seller", count: 0 },
      { role: "admin", count: 0 },
    ],
  };

  // Show toast on error
  useEffect(() => {
    if (error) {
      toast.error(error.message || "Could not load analytics data");
    }
  }, [error]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-red-400 p-6">
        <AlertCircle className="h-16 w-16 mb-6" />
        <h2 className="text-2xl font-bold mb-4">Failed to load analytics</h2>
        <p className="text-slate-400 mb-8 max-w-md text-center">
          {error.message || "An unexpected error occurred."}
        </p>
        <Button 
          onClick={() => refetch()} 
          className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  const pieData = {
    labels: analytics.role_distribution.map((r) => r.role),
    datasets: [{
      data: analytics.role_distribution.map((r) => r.count),
      backgroundColor: ["#3B82F6", "#10B981", "#EAB308"],
      borderColor: ["#1e40af", "#065f46", "#ca8a04"],
      borderWidth: 1,
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
              <p className="text-4xl font-bold text-white">{analytics.total_users}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Total Sellers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-white">{analytics.total_sellers}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Total Buyers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-white">{analytics.total_buyers}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Total Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-white">{analytics.total_bookings}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-white">
                R{(analytics.total_revenue ?? 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">User Role Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-md mx-auto">
              {analytics.role_distribution.length > 0 ? (
                <Pie data={pieData} />
              ) : (
                <div className="text-center py-12 text-slate-400">
                  No role distribution data available yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}