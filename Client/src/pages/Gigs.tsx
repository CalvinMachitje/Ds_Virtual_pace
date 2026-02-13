// src/pages/Gigs.tsx (New file: List of available gigs for buyers)
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, Star } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { supabase } from "@/lib/supabase";

type Gig = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  seller_name: string;
  rating: number;
  review_count: number;
  image_url?: string;
};

const fetchGigs = async () => {
  const { data, error } = await supabase
    .from("gigs")
    .select("id, title, description, price, category, seller_id (full_name as seller_name, rating, review_count)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as unknown as Gig[] || [];
};

export default function Gigs() {
  const { data: gigs = [], isLoading, error, refetch } = useQuery<Gig[]>({
    queryKey: ["gigs"],
    queryFn: fetchGigs,
  });

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-400 p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
        <p className="text-xl mb-4">Failed to load gigs</p>
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
        <h1 className="text-4xl font-bold text-white mb-8">Available Gigs</h1>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} height={300} className="rounded-xl" />
            ))}
          </div>
        ) : gigs.length === 0 ? (
          <div className="text-center py-16 text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
            <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-xl font-medium">No gigs available yet</p>
            <p className="mt-2">Check back soon or search for specific services.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gigs.map((gig) => (
              <Card key={gig.id} className="bg-slate-900/70 border-slate-700 hover:border-blue-600 transition-colors overflow-hidden">
                <img
                  src={gig.image_url || "/placeholder-gig.jpg"}
                  alt={gig.title}
                  className="w-full h-48 object-cover"
                />
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold text-white mb-2">{gig.title}</h3>
                  <p className="text-slate-300 text-sm mb-4 line-clamp-3">{gig.description}</p>
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-slate-300">{gig.rating.toFixed(1)} ({gig.review_count})</span>
                  </div>
                  <p className="text-blue-400 font-medium">${gig.price.toFixed(2)} / hr</p>
                </CardContent>
                <CardFooter className="p-6 pt-0">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">View & Book</Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}