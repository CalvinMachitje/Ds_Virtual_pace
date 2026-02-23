// src/pages/admin/AnalyticsAdmin.tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Pie } from "react-chartjs-2";
import { toast } from "sonner";
import Skeleton from "react-loading-skeleton";
import { useEffect } from "react";

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
  const { data: analytics, isLoading, error } = useQuery<AnalyticsData, Error>({
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

      // Type guard / runtime validation (helps TS infer)
      if (
        typeof json.total_users !== "number" ||
        !Array.isArray(json.role_distribution)
      ) {
        throw new Error("Invalid analytics response format");
      }

      return json as AnalyticsData;
    },
  });

  // Handle errors via toast (instead of onError option)
  useEffect(() => {
    if (error) {
      toast.error(error.message || "Could not load analytics");
    }
  }, [error]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="bg-slate-900/70 border-slate-700">
                <CardHeader>
                  <Skeleton className="h-8 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
        <div className="text-center text-red-400">
          <p className="text-xl mb-4">Failed to load analytics</p>
          <p>{error.message}</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return null; // or fallback UI
  }

  const pieData = {
    labels: analytics.role_distribution.map((r) => r.role),
    datasets: [{
      data: analytics.role_distribution.map((r) => r.count),
      backgroundColor: ["#3B82F6", "#10B981", "#EAB308"],
    }],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
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
                R{analytics.total_revenue.toLocaleString()}
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
              <Pie data={pieData} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}