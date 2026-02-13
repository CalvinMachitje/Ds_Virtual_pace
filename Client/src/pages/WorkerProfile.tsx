// src/pages/WorkerProfile.tsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Star, MessageSquare, Bookmark, ShieldCheck, User } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  role: string;
  bio: string;
  avatar_url?: string;
  rating?: number;
  review_count?: number;
  services?: string[];
};

const fetchWorkerProfile = async (id: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, bio, avatar_url")
    .eq("id", id)
    .single();

  if (error) throw error;

  // Fetch rating & services (mock or join queries)
  const { data: reviews, error: reviewsError } = await supabase
    .from("reviews")
    .select("rating")
    .eq("reviewed_id", id);

  if (reviewsError) throw reviewsError;

  const avgRating = reviews?.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const { data: gigs, error: gigsError } = await supabase
    .from("gigs")
    .select("title")
    .eq("seller_id", id);

  if (gigsError) throw gigsError;

  return {
    ...data,
    rating: avgRating,
    review_count: reviews?.length || 0,
    services: gigs?.map((g) => g.title) || [],
  } as Profile;
};

export default function WorkerProfile() {
  const { id } = useParams<{ id: string }>();

  const { data: profile, isLoading, error, refetch } = useQuery<Profile>({
    queryKey: ["worker-profile", id],
    queryFn: () => fetchWorkerProfile(id || ""),
    enabled: !!id,
  });

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-400 p-6 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
        <p className="text-xl mb-4">Failed to load profile</p>
        <p className="text-slate-400 mb-6">{(error as Error).message}</p>
        <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        {isLoading ? (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <Skeleton circle width={160} height={160} />
              <div className="text-center md:text-left flex-1">
                <Skeleton width="60%" height={40} className="mb-2" />
                <Skeleton width="40%" height={24} className="mb-2" />
                <Skeleton width="30%" height={20} />
              </div>
            </div>
            <Skeleton height={200} />
            <Skeleton height={150} />
            <Skeleton height={250} />
          </div>
        ) : !profile ? (
          <div className="text-center py-20 text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-xl font-medium">Profile not found</p>
            <p className="mt-2">This worker profile doesn't exist or was deleted.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-8">
              <div className="relative">
                <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-blue-600">
                  <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                  <AvatarFallback>{profile.full_name?.[0] || "?"}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-2 -right-2 bg-green-600 p-1.5 rounded-full border-2 border-slate-900">
                  <ShieldCheck className="h-5 w-5 text-white" />
                </div>
              </div>

              <div className="text-center md:text-left">
                <div className="flex items-center gap-3 justify-center md:justify-start">
                  <h1 className="text-3xl font-bold text-white">{profile.full_name}</h1>
                  <Badge className="bg-blue-600 hover:bg-blue-600">VERIFIED PRO</Badge>
                </div>
                <p className="text-xl text-slate-300 mt-1">{profile.role}</p>
                <div className="flex items-center gap-2 mt-2 justify-center md:justify-start">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-5 w-5 ${
                          i < Math.floor(profile.rating || 0) ? "text-yellow-400 fill-yellow-400" : "text-slate-600 fill-slate-600"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-slate-300">
                    {profile.rating?.toFixed(1)} ({profile.review_count} reviews)
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 py-6 text-lg">
                <MessageSquare className="mr-2 h-5 w-5" /> Message
              </Button>
              <Button variant="outline" className="flex-1 border-slate-600 hover:bg-slate-800 py-6 text-lg">
                <Bookmark className="mr-2 h-5 w-5" /> Save
              </Button>
            </div>

            {/* About */}
            <Card className="bg-slate-900/70 border-slate-700 mb-6 backdrop-blur-sm">
              <CardContent className="p-6">
                <h2 className="text-2xl font-semibold text-white mb-4">About Me</h2>
                <p className="text-slate-300 leading-relaxed">{profile.bio || "No bio available yet."}</p>
              </CardContent>
            </Card>

            {/* Services */}
            <Card className="bg-slate-900/70 border-slate-700 mb-6 backdrop-blur-sm">
              <CardContent className="p-6">
                <h2 className="text-2xl font-semibold text-white mb-4">Services Offered</h2>
                {profile.services?.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {profile.services.map((service) => (
                      <div key={service} className="bg-slate-800/60 p-4 rounded-lg text-center border border-slate-700">
                        <p className="font-medium text-slate-200">{service}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-400 py-6">No services listed yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Reviews */}
            <Card className="bg-slate-900/70 border-slate-700 backdrop-blur-sm">
              <CardContent className="p-6">
                <h2 className="text-2xl font-semibold text-white mb-4">Client Reviews</h2>
                {profile.review_count ? (
                  <div className="space-y-6">
                    {/* Placeholder - fetch real reviews in production */}
                    <div className="border-b border-slate-800 pb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">
                          <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                          <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                          <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                          <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                          <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                        </div>
                        <span className="text-slate-300">Mark T. • 2 days ago</span>
                      </div>
                      <p className="text-slate-300">
                        Sarah organized my entire inbox in two days! She is incredibly efficient and easy to communicate with. Highly recommend for any busy professional.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-slate-400 py-6">No reviews yet.</p>
                )}
                <Button variant="ghost" className="mt-4 text-blue-400 hover:text-blue-300">
                  View all {profile.review_count} reviews →
                </Button>
              </CardContent>
            </Card>

            {/* Book button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-950 to-transparent md:static md:mt-8 md:p-0 md:bg-none">
              <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 py-7 text-lg">
                Book Now • Starting at $30/hr
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}