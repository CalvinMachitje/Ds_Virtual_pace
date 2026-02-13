// src/pages/BuyerDashboard.tsx
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { supabase } from "@/lib/supabase";

type DashboardData = {
  trendingCategories: { name: string; pros: number }[];
  featuredVAs: { title: string; rating: number; img: string }[];
};

const fetchBuyerDashboard = async () => {
  // Fetch trending categories (mock or from categories table)
  const { data: categories, error: catError } = await supabase
    .from("gigs")
    .select("category")
    .limit(4); // Group by category in real app

  // Featured VAs (top rated profiles)
  const { data: vas, error: vaError } = await supabase
    .from("profiles")
    .select("full_name, rating, avatar_url")
    .eq("role", "seller")
    .order("rating", { ascending: false })
    .limit(4);

  if (catError || vaError) throw new Error("Failed to load dashboard");

  return {
    trendingCategories: categories?.map(c => ({ name: c.category, pros: 100 })) || [],
    featuredVAs: vas?.map(v => ({ title: v.full_name, rating: v.rating || 4.5, img: v.avatar_url })) || [],
  } as DashboardData;
};

export default function BuyerDashboard() {
  const { data, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ["buyer-dashboard"],
    queryFn: fetchBuyerDashboard,
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
        <p className="text-slate-400 mb-8">What do you need help with today?</p>

        {/* Search bar */}
        <div className="relative mb-10">
          <Input
            placeholder="Search for virtual assistants, tasks, categories..."
            className="pl-12 py-7 text-lg bg-slate-900/60 border-slate-700"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400" />
        </div>

        {isLoading ? (
          <div className="space-y-12">
            <Skeleton height={40} className="mb-6" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Skeleton height={120} count={4} />
            </div>
            <Skeleton height={40} className="mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton height={200} count={2} />
            </div>
          </div>
        ) : (
          <>
            {/* Trending categories */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-6">Trending Categories</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {data?.trendingCategories.map((cat) => (
                  <Card key={cat.name} className="bg-slate-900/70 border-slate-700 hover:border-blue-600 transition-colors">
                    <CardContent className="p-6 text-center">
                      <h3 className="font-medium text-white">{cat.name}</h3>
                      <p className="text-sm text-slate-400 mt-1">{cat.pros}+ pros</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Featured VAs */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-6">Featured VAs</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data?.featuredVAs.map((va) => (
                  <Card key={va.title} className="bg-slate-900/70 border-slate-700">
                    <img src={va.img} alt={va.title} className="w-full h-40 object-cover rounded-t-lg" />
                    <CardContent className="p-6">
                      <h3 className="font-medium text-white">{va.title}</h3>
                      <p className="text-sm text-yellow-400 mt-1">★ {va.rating}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Quick actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-blue-950 to-indigo-950 border-indigo-800">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold text-white mb-4">Instant Match</h3>
                  <p className="text-slate-300 mb-6">Get matched with a VA in under 5 minutes</p>
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                    Try Instant Match
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/70 border-slate-700">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold text-white mb-4">My Bookings</h3>
                  <p className="text-slate-300 mb-6">View and manage your active & completed bookings</p>
                  <Button variant="outline" size="lg" className="border-slate-600 hover:bg-slate-800">
                    Go to Bookings
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