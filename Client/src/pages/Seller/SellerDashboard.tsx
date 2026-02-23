// src/pages/seller/SellerDashboard.tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Star, Briefcase, Calendar, Users, CreditCard, AlertCircle } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";

type SellerStats = {
  activeGigs: number;
  activeBookings: number;
  completedBookings: number;
  rating: number;
  reviewCount: number;
  monthlyEarnings: number;
};

export default function SellerDashboard() {
  const { user } = useAuth();
  const userId = user?.id;

  const { data: stats, isLoading, error, refetch } = useQuery<SellerStats>({
    queryKey: ["seller-dashboard", userId],
    queryFn: async () => {
      if (!userId) throw new Error("Not logged in");

      const res = await fetch("/api/seller/dashboard", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load dashboard");
      }

      return res.json();
    },
    enabled: !!userId,
  });

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-400 p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 md:ml-64">
        <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
        <h2 className="text-2xl font-bold mb-2">Failed to load dashboard</h2>
        <p className="text-slate-400 mb-6">{(error as Error).message}</p>
        <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 md:ml-64">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">Seller Dashboard</h1>
        <p className="text-slate-400 mb-8">Manage your gigs, bookings & earnings</p>

        {isLoading ? (
          <div className="space-y-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <Skeleton height={140} count={4} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton height={200} count={2} />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <Card className="bg-slate-900/70 border-slate-700">
                <CardContent className="p-6 text-center">
                  <Briefcase className="h-10 w-10 text-blue-400 mx-auto mb-4" />
                  <p className="text-4xl font-bold text-white">{stats?.activeGigs}</p>
                  <p className="text-slate-400 mt-2">Active Gigs</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/70 border-slate-700">
                <CardContent className="p-6 text-center">
                  <Users className="h-10 w-10 text-green-400 mx-auto mb-4" />
                  <p className="text-4xl font-bold text-white">{stats?.activeBookings}</p>
                  <p className="text-slate-400 mt-2">Active Bookings</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/70 border-slate-700">
                <CardContent className="p-6 text-center">
                  <Star className="h-10 w-10 text-yellow-400 mx-auto mb-4" />
                  <p className="text-4xl font-bold text-white">{stats?.rating.toFixed(1)}</p>
                  <p className="text-slate-400 mt-2">
                    Rating ({stats?.reviewCount})
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/70 border-slate-700">
                <CardContent className="p-6 text-center">
                  <CreditCard className="h-10 w-10 text-emerald-400 mx-auto mb-4" />
                  <p className="text-4xl font-bold text-emerald-400">
                    R{stats?.monthlyEarnings.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-slate-400 mt-2">This Month</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-slate-900/70 border-slate-700">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold text-white mb-4">Manage Availability</h3>
                  <p className="text-slate-300 mb-6">Update your calendar and availability slots</p>
                  <Button variant="outline" size="lg" className="border-slate-600 hover:bg-slate-800 w-full">
                    Update Calendar
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}