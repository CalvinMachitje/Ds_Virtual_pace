// src/pages/Profile.tsx
// Public profile view (tailored for buyer role – viewing a worker/assistant)

import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MessageSquare, Bookmark, ShieldCheck, User } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

type Profile = {
  id: string;
  full_name: string;
  role: string;
  bio: string;
  avatar_url?: string;
  rating: number;
  review_count: number;
  services?: string[];
  is_verified?: boolean;
};

const fetchProfile = async (username: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, bio, avatar_url, is_verified")
    .eq("username", username) // assumes you have a username column
    .single();

  if (error) throw error;

  // Fetch average rating from reviews
  const { data: reviews, error: reviewsError } = await supabase
    .from("reviews")
    .select("rating")
    .eq("reviewed_id", data.id);

  if (reviewsError) throw reviewsError;

  const avgRating = reviews?.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  // Fetch services (gigs offered by this seller)
  const { data: gigs, error: gigsError } = await supabase
    .from("gigs")
    .select("title")
    .eq("seller_id", data.id);

  if (gigsError) throw gigsError;

  return {
    ...data,
    rating: avgRating,
    review_count: reviews?.length || 0,
    services: gigs?.map((g) => g.title) || [],
  } as Profile;
};

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth(); // current logged-in user (buyer)
  const navigate = useNavigate();

  const { data: profile, isLoading, error, refetch } = useQuery<Profile>({
    queryKey: ["profile", username],
    queryFn: () => fetchProfile(username || ""),
    enabled: !!username,
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

  const handleMessage = () => {
    // Navigate to chat – you might want to create a new chat/booking relation
    navigate(`/chat/new?with=${profile?.id}`);
  };

  const handleSave = () => {
    // Placeholder – implement save/favourite logic later
    alert("Saved to favourites! (to be implemented)");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {isLoading ? (
          <div className="space-y-8">
            <div className="flex flex-col items-center">
              <Skeleton circle width={128} height={128} className="mb-4" />
              <Skeleton width="60%" height={40} className="mb-2" />
              <Skeleton width="40%" height={24} className="mb-4" />
            </div>
            <Skeleton height={200} />
            <Skeleton height={150} />
            <Skeleton height={250} />
          </div>
        ) : !profile ? (
          <div className="text-center py-20 text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-xl font-medium">Profile not found</p>
            <p className="mt-2">This user profile doesn't exist or is private.</p>
          </div>
        ) : (
          <>
            {/* Profile Header */}
            <div className="flex flex-col items-center mb-10">
              <div className="relative mb-4">
                <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-slate-700">
                  <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                  <AvatarFallback className="bg-slate-800 text-slate-300">
                    {profile.full_name?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>

                {profile.is_verified && (
                  <div className="absolute -bottom-2 -right-2 bg-green-600 p-1.5 rounded-full border-2 border-slate-900">
                    <ShieldCheck className="h-5 w-5 text-white" />
                  </div>
                )}
              </div>

              <h1 className="text-4xl font-bold text-white mb-2">{profile.full_name}</h1>
              <p className="text-xl text-slate-300 mb-4">{profile.role}</p>

              <div className="flex items-center gap-3 mb-6">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.round(profile.rating || 0)
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-slate-600"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-slate-300">
                  {profile.rating?.toFixed(1)} ({profile.review_count} reviews)
                </span>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={handleMessage}
                  className="bg-blue-600 hover:bg-blue-700 px-8 py-6 text-lg"
                >
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Message
                </Button>

                <Button
                  variant="outline"
                  onClick={handleSave}
                  className="border-slate-600 hover:bg-slate-800 px-8 py-6 text-lg"
                >
                  <Bookmark className="mr-2 h-5 w-5" />
                  Save
                </Button>
              </div>
            </div>

            {/* Bio */}
            <Card className="bg-slate-900/70 border-slate-700 mb-8 backdrop-blur-sm">
              <CardContent className="p-6">
                <h2 className="text-2xl font-semibold text-white mb-4">About Me</h2>
                <p className="text-slate-300 leading-relaxed whitespace-pre-line">
                  {profile.bio || "No bio provided yet."}
                </p>
              </CardContent>
            </Card>

            {/* Services Offered */}
            <Card className="bg-slate-900/70 border-slate-700 mb-8 backdrop-blur-sm">
              <CardContent className="p-6">
                <h2 className="text-2xl font-semibold text-white mb-4">Services Offered</h2>

                {profile.services && profile.services.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {profile.services.map((service, index) => (
                      <div
                        key={index}
                        className="bg-slate-800/60 p-4 rounded-lg text-center border border-slate-700"
                      >
                        <p className="font-medium text-slate-200">{service}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-400 py-8">
                    No services listed yet.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Reviews */}
            <Card className="bg-slate-900/70 border-slate-700 backdrop-blur-sm">
              <CardContent className="p-6">
                <h2 className="text-2xl font-semibold text-white mb-4">
                  Client Reviews ({profile.review_count})
                </h2>

                {profile.review_count > 0 ? (
                  <div className="space-y-6">
                    {/* Example review – in real app fetch from reviews table */}
                    <div className="border-b border-slate-800 pb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">
                          <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                          <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                          <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                          <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                          <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                        </div>
                        <span className="text-slate-300">Excellent service • 1 week ago</span>
                      </div>
                      <p className="text-slate-300">
                        Very professional, fast response, and great communication. Highly recommended!
                      </p>
                    </div>

                    {/* You can add a "View all reviews" link or paginated list */}
                  </div>
                ) : (
                  <p className="text-center text-slate-400 py-8">
                    No reviews yet. Be the first to leave one!
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}