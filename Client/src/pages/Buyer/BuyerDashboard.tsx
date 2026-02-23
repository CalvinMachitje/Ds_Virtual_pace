// src/pages/Buyer/BuyerDashboard.tsx
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Zap, Briefcase, Star } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@radix-ui/react-avatar";

type Category = { name: string; count: number };
type FeaturedVA = {
  id: string;
  full_name: string;
  rating: number;
  avatar_url?: string;
  starting_price?: number;
};

const fetchBuyerDashboard = async () => {
  // Trending categories (count of gigs per category)
  const { data: categoriesData } = await supabase
    .from("gigs")
    .select("category");

  const categoryCount = categoriesData?.reduce((acc, gig) => {
    acc[gig.category] = (acc[gig.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const trendingCategories: Category[] = Object.entries(categoryCount || {})
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Featured VAs (top-rated sellers with starting price in Rand)
  const { data: vas } = await supabase
    .from("profiles")
    .select("id, full_name, rating, avatar_url")
    .eq("role", "seller")
    .order("rating", { ascending: false })
    .limit(6);

  const featuredVAs: FeaturedVA[] = await Promise.all(
    (vas || []).map(async (va) => {
      const { data: minPrice } = await supabase
        .from("gigs")
        .select("price")
        .eq("seller_id", va.id)
        .order("price", { ascending: true })
        .limit(1)
        .maybeSingle();

      return {
        ...va,
        starting_price: minPrice?.price || 250,
      };
    })
  );

  return { trendingCategories, featuredVAs };
};

export default function BuyerDashboard() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["buyer-dashboard"],
    queryFn: fetchBuyerDashboard,
  });

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-400 p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 md:ml-64">
        <p className="text-xl mb-4">Failed to load dashboard</p>
        <p className="text-slate-400 mb-6">{(error as Error).message}</p>
        <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 pb-24 md:ml-64">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">Welcome back</h1>
        <p className="text-slate-400 mb-8">What do you need help with today?</p>

        {/* Search bar */}
        <div className="relative mb-10">
          <Input
            placeholder="Search for virtual assistants, tasks, categories..."
            className="pl-12 py-7 text-lg bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500 focus:ring-blue-500"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400" />
        </div>

        {isLoading ? (
          <div className="space-y-12">
            <Skeleton height={40} className="mb-6 w-64" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Skeleton height={120} count={8} />
            </div>
            <Skeleton height={40} className="mb-6 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Skeleton height={220} count={6} />
            </div>
          </div>
        ) : (
          <>
            {/* Trending Categories */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-6">Trending Categories</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {data?.trendingCategories.map((cat) => (
                  <Link
                    key={cat.name}
                    to={`/category/${encodeURIComponent(cat.name.toLowerCase())}`}
                    className="block"
                  >
                    <Card className="bg-slate-900/70 border-slate-700 hover:border-blue-600 transition-colors h-full">
                      <CardContent className="p-6 text-center">
                        <h3 className="font-medium text-white">{cat.name}</h3>
                        <p className="text-sm text-slate-400 mt-1">{cat.count}+ assistants</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>

            {/* Featured Virtual Assistants */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-white mb-6">Featured VAs</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {data?.featuredVAs.map((va) => (
                  <Link key={va.id} to={`/worker/${va.id}`} className="block">
                    <Card className="bg-slate-900/70 border-slate-700 hover:border-blue-600 transition-colors overflow-hidden">
                      <Avatar className="w-full h-48 rounded-none">
                        <AvatarImage src={va.avatar_url} alt={va.full_name} className="object-cover" />
                        <AvatarFallback>{va.full_name?.[0]}</AvatarFallback>
                      </Avatar>
                      <CardContent className="p-5">
                        <h3 className="font-semibold text-white truncate">{va.full_name}</h3>
                        <div className="flex items-center gap-1 mt-2">
                          <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                          <span className="text-slate-300">{va.rating?.toFixed(1)}</span>
                        </div>
                        <p className="text-sm text-emerald-400 mt-2">
                          Starts at R{va.starting_price?.toFixed(0) || "250"}/hr
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>

            {/* Quick actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-blue-950 to-indigo-950 border-indigo-800">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold text-white mb-4">Instant Match</h3>
                  <p className="text-slate-300 mb-6">Get matched with a VA in under 5 minutes</p>
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700 w-full">
                    <Zap className="mr-2 h-5 w-5" /> Try Instant Match
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