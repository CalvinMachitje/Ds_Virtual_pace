// src/pages/SellerDashboard.tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Star, Briefcase, Link as LinkIcon } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

type DashboardData = {
  activeBookings: number;
  rating: number;
  monthlyEarnings: number;
};

const fetchSellerDashboard = async (userId: string) => {
  // Active bookings count
  const { count: activeCount, error: activeError } = await supabase
    .from("bookings")
    .select("count", { count: "exact" })
    .eq("seller_id", userId)
    .in("status", ["pending", "in_progress"]);

  // Average rating from reviews
  const { data: reviews, error: reviewsError } = await supabase
    .from("reviews")
    .select("rating")
    .eq("reviewed_id", userId);

  const avgRating = reviews?.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  // Monthly earnings (sum of completed bookings this month)
  const { data: earningsData, error: earningsError } = await supabase
    .from("bookings")
    .select("price")
    .eq("seller_id", userId)
    .eq("status", "completed")
    .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

  const monthlyEarnings = earningsData?.reduce((sum, b) => sum + b.price, 0) || 0;

  if (activeError || reviewsError || earningsError) throw new Error("Failed to load dashboard");

  return { activeBookings: activeCount || 0, rating: avgRating, monthlyEarnings };
};

export default function SellerDashboard() {
  const { user } = useAuth();
  const userId = user?.id;

  const { data, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ["seller-dashboard"],
    queryFn: () => fetchSellerDashboard(userId || ""),
    enabled: !!userId,
  });

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-400 p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
        <p className="text-xl mb-4">Failed to load dashboard</p>
        <p className="text-slate-400 mb-6">{(error as Error).message}</p>
        <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">Welcome back</h1>
        <p className="text-slate-400 mb-8">Manage your services & bookings</p>

        {isLoading ? (
          <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <Skeleton height={120} count={3} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton height={200} count={2} />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <Card className="bg-slate-900/80 border-slate-700">
                <CardContent className="p-6 text-center">
                  <div className="text-5xl font-bold text-blue-400 mb-2">{data?.activeBookings}</div>
                  <p className="text-slate-300 flex items-center justify-center gap-2">
                    <Briefcase className="h-5 w-5" /> Active Bookings
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/80 border-slate-700">
                <CardContent className="p-6 text-center">
                  <div className="text-5xl font-bold text-green-400 mb-2">{data?.rating.toFixed(1)}</div>
                  <p className="text-slate-300 flex items-center justify-center gap-2">
                    <Star className="h-5 w-5" /> Current Rating
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/80 border-slate-700">
                <CardContent className="p-6 text-center">
                  <div className="text-5xl font-bold text-yellow-400 mb-2">R{data?.monthlyEarnings.toFixed(2)}</div>
                  <p className="text-slate-300 flex items-center justify-center gap-2">
                    <DollarSign className="h-5 w-5" /> This Month
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick actions */}
              <Card className="bg-gradient-to-br from-indigo-950 to-blue-950 border-indigo-800">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold text-white mb-4">Create New Gig</h3>
                  <p className="text-slate-300 mb-6">List a new service offering</p>
                  <RouterLink to="/CreateGig" className="inline-flex items-center justify-center rounded-md border border-slate-600 px-4 py-2 text-lg hover:bg-slate-800">
                      Create Gig
                  </RouterLink>
                </CardContent>
              </Card>
              <br/>
              <Card className="bg-slate-900/70 border-slate-700">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold text-white mb-4">My Availability</h3>
                  <p className="text-slate-300 mb-6">Update when you're available</p>
                  <RouterLink to="/CreateGig" className="inline-flex items-center justify-center rounded-md border border-slate-600 px-4 py-2 text-lg hover:bg-slate-800">
                    Manage Calendar
                  </RouterLink>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    );
}