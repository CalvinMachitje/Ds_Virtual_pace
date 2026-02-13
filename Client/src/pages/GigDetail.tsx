// src/pages/GigDetail.tsx (New file: Single gig detail page)
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const fetchGigDetail = async (id: string) => {
  const { data, error } = await supabase
    .from("gigs")
    .select("id, title, description, price, category, seller_id (full_name as seller_name, rating, review_count)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as unknown as Gig;
};

export default function GigDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: gig, isLoading, error, refetch } = useQuery<Gig>({
    queryKey: ["gig", id],
    queryFn: () => fetchGigDetail(id || ""),
    enabled: !!id,
  });

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-400 p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
        <p className="text-xl mb-4">Failed to load gig</p>
        <p className="text-slate-400 mb-6">{(error as Error).message}</p>
        <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {isLoading ? (
          <div className="space-y-8">
            <Skeleton height={300} />
            <Skeleton height={150} />
            <Skeleton height={200} />
          </div>
        ) : !gig ? (
          <div className="text-center py-20 text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
            <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-xl font-medium">Gig not found</p>
            <p className="mt-2">This gig doesn't exist or was deleted.</p>
          </div>
        ) : (
          <>
            <img
              src={gig.image_url || "/placeholder-gig-large.jpg"}
              alt={gig.title}
              className="w-full h-64 md:h-96 object-cover rounded-xl mb-8"
            />

            <h1 className="text-4xl font-bold text-white mb-2">{gig.title}</h1>
            <p className="text-slate-300 text-xl mb-4">{gig.category}</p>
            <div className="flex items-center gap-2 mb-8">
              <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
              <span className="text-slate-300">{gig.rating.toFixed(1)} ({gig.review_count} reviews)</span>
              <span className="text-slate-400">• By {gig.seller_name}</span>
            </div>

            <Card className="bg-slate-900/70 border-slate-700 mb-8">
              <CardHeader>
                <CardTitle className="text-2xl text-white">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300 leading-relaxed">{gig.description}</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/70 border-slate-700 mb-8">
              <CardHeader>
                <CardTitle className="text-2xl text-white">Pricing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-400 mb-2">${gig.price.toFixed(2)} / hour</p>
                <p className="text-slate-400">Includes all basic features. Custom packages available.</p>
              </CardContent>
            </Card>

            <Button className="w-full bg-blue-600 hover:bg-blue-700 py-8 text-xl">
              Book Now
            </Button>
          </>
        )}
      </div>
    </div>
  );
}